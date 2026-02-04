import * as core from '@actions/core'
import * as github from '@actions/github'
import { GitHubApi } from './api'
import { detectDuplicate } from './detect'

async function run(): Promise<void> {
  try {
    const token = core.getInput('token', { required: true })
    const maxHistory = parseInt(core.getInput('max_history'), 10) || 10
    const checkConcurrent = core.getInput('check_concurrent') !== 'false'

    const { owner, repo } = github.context.repo
    const workflowId = github.context.workflow
    const currentRunId = github.context.runId
    const currentSha = github.context.sha

    core.info(`Checking for duplicate runs...`)
    core.info(`Repository: ${owner}/${repo}`)
    core.info(`Workflow: ${workflowId}`)
    core.info(`Current SHA: ${currentSha}`)

    const api = new GitHubApi(token, owner, repo, workflowId)

    // Get tree hash for current commit
    const currentTreeHash = await api.getTreeHash(currentSha)
    core.info(`Current tree hash: ${currentTreeHash}`)
    core.setOutput('tree_hash', currentTreeHash)

    const result = await detectDuplicate(
      currentTreeHash,
      currentRunId,
      maxHistory,
      checkConcurrent,
      api
    )

    core.setOutput('is_duplicate', String(result.isDuplicate))
    core.setOutput('reason', result.reason)
    core.setOutput('matched_run_id', result.matchedRunId ? String(result.matchedRunId) : '')

    if (result.isDuplicate) {
      core.info(`⏭️ Skip: ${result.reason}`)
    } else {
      core.info(`▶️ Run: ${result.reason}`)
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unexpected error occurred')
    }
  }
}

run()
