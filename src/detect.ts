import * as core from '@actions/core'
import { GitHubApi } from './api'

export interface DetectResult {
  isDuplicate: boolean
  reason: string
  matchedRunId?: number
}

export async function detectDuplicate(
  currentTreeHash: string,
  currentRunId: number,
  maxHistory: number,
  checkConcurrent: boolean,
  api: GitHubApi
): Promise<DetectResult> {
  // 1. Check historical successful runs
  const successfulRuns = await api.getWorkflowRuns({
    status: 'completed',
    conclusion: 'success',
    per_page: maxHistory,
  })

  for (const run of successfulRuns) {
    if (run.id === currentRunId) continue

    let treeHash: string
    try {
      treeHash = await api.getTreeHash(run.head_sha)
    } catch {
      core.debug(`Failed to get tree hash for run #${run.run_number} (${run.head_sha}), skipping`)
      continue
    }

    if (treeHash === currentTreeHash) {
      return {
        isDuplicate: true,
        reason: `Successful run #${run.run_number} (id: ${run.id}) has same tree content`,
        matchedRunId: run.id,
      }
    }
  }

  // 2. Check concurrent in-progress runs
  if (checkConcurrent) {
    const inProgressRuns = await api.getWorkflowRuns({
      status: 'in_progress',
    })

    for (const run of inProgressRuns) {
      // Only check runs started before us to avoid mutual skipping
      if (run.id >= currentRunId) continue

      let treeHash: string
      try {
        treeHash = await api.getTreeHash(run.head_sha)
      } catch {
        core.debug(`Failed to get tree hash for run #${run.run_number} (${run.head_sha}), skipping`)
        continue
      }

      if (treeHash === currentTreeHash) {
        return {
          isDuplicate: true,
          reason: `In-progress run #${run.run_number} (id: ${run.id}) is processing same tree content`,
          matchedRunId: run.id,
        }
      }
    }
  }

  return {
    isDuplicate: false,
    reason: 'No duplicate runs found',
  }
}
