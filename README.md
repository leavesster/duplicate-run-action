# duplicate-run-action

Detect and skip duplicate GitHub Actions workflow runs by comparing git tree hashes.

## The Problem

Workflows triggered by both `push` and `pull_request` fire twice when a PR is merged:

```
PR #42 merged into main
  ├── pull_request (closed, merged=true)   ← run A
  └── push (refs/heads/main)               ← run B  (same code, wasted run)
```

The two commits have different SHAs (merge commit vs PR head), but the actual code content is identical.

## How It Works

Git stores each commit's file tree as a separate hash (`tree.sha`). Two commits with the same code produce the same tree hash, regardless of commit metadata.

```
PR head commit:    abc1234  →  tree: 9f8e7d6...
Merge commit:      def5678  →  tree: 9f8e7d6...  ← same tree = same code
```

This action:

1. Fetches the current commit's tree hash via GitHub API
2. Queries recent successful runs of the same workflow
3. Compares tree hashes — if a match exists, the code already passed
4. Optionally checks concurrent in-progress runs to avoid parallel duplicates
5. Outputs `is_duplicate=true` for downstream jobs to act on

No `actions/checkout` required. Runs entirely through the GitHub API.

## Quick Start

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check-duplicate:
    runs-on: ubuntu-latest
    outputs:
      is_duplicate: ${{ steps.dedup-check.outputs.is_duplicate }}
    steps:
      - name: Check for duplicate runs
        id: dedup-check
        uses: your-name/duplicate-run-action@v1

  build:
    needs: check-duplicate
    if: needs.check-duplicate.outputs.is_duplicate != 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run build

  test:
    needs: check-duplicate
    if: needs.check-duplicate.outputs.is_duplicate != 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test
```

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `token` | `${{ github.token }}` | GitHub token. The default token works — it has `actions:read` by default. |
| `max_history` | `10` | Number of recent successful runs to check. |
| `check_concurrent` | `true` | Also check in-progress runs to skip parallel duplicates. |

## Outputs

| Output | Description |
|--------|-------------|
| `is_duplicate` | `'true'` if a duplicate was found, `'false'` otherwise. |
| `reason` | Human-readable explanation of the decision. |
| `matched_run_id` | Run ID of the duplicate (empty if none). |
| `tree_hash` | Tree hash of the current commit (useful for debugging). |

## Detection Logic

### Historical Runs

Queries the last `max_history` successful runs of the same workflow. If any has the same tree hash as the current commit, the run is marked as a duplicate.

### Concurrent Runs

When `check_concurrent` is enabled, also checks in-progress runs. Only considers runs with a **smaller run ID** (started earlier) to avoid two runs skipping each other.

## When It Does NOT Skip

| Scenario | Behavior |
|----------|----------|
| First run ever | No history to match — runs normally. |
| Code changed | Different tree hash — runs normally. |
| Previous run failed | Only matches successful runs — runs normally. |
| Different workflow | Each workflow is checked independently. |

## Combining with `concurrency`

This action pairs well with GitHub's built-in `concurrency` for defense in depth:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  check-duplicate:
    # ... duplicate-run-action setup as above
```

`concurrency` handles in-flight cancellation; `duplicate-run-action` handles cross-event deduplication.

## Development

```bash
npm install
npm run build    # compiles to dist/index.js via ncc
```

The `dist/` directory is committed to the repository — this is required for JavaScript GitHub Actions.

## License

MIT
