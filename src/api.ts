import * as github from '@actions/github'

export interface WorkflowRun {
  id: number
  run_number: number
  head_sha: string
  status: string
  conclusion: string | null
}

export interface RunFilter {
  status?: 'completed' | 'in_progress' | 'queued'
  conclusion?: 'success' | 'failure' | 'cancelled'
  per_page?: number
}

export class GitHubApi {
  private octokit: ReturnType<typeof github.getOctokit>
  private owner: string
  private repo: string
  private workflowId: string | number

  constructor(
    token: string,
    owner: string,
    repo: string,
    workflowId: string | number
  ) {
    this.octokit = github.getOctokit(token)
    this.owner = owner
    this.repo = repo
    this.workflowId = workflowId
  }

  async getTreeHash(sha: string): Promise<string> {
    const { data } = await this.octokit.rest.git.getCommit({
      owner: this.owner,
      repo: this.repo,
      commit_sha: sha,
    })
    return data.tree.sha
  }

  async getWorkflowRuns(filter: RunFilter): Promise<WorkflowRun[]> {
    const { data } = await this.octokit.rest.actions.listWorkflowRuns({
      owner: this.owner,
      repo: this.repo,
      workflow_id: this.workflowId,
      status: filter.status,
      per_page: filter.per_page || 20,
    })

    let runs = data.workflow_runs.map((run) => ({
      id: run.id,
      run_number: run.run_number,
      head_sha: run.head_sha,
      status: run.status ?? 'unknown',
      conclusion: run.conclusion,
    }))

    if (filter.conclusion) {
      runs = runs.filter((run) => run.conclusion === filter.conclusion)
    }

    return runs
  }
}
