# duplicate-run-action

[English](./README.md) | 中文

> **同一份代码，只跑一次 CI。**

PR 合并时，`push` 和 `pull_request` 事件会同时触发，导致相同代码跑两次 CI。这个 Action 通过比较 git tree hash 检测重复，跳过浪费的 run。

## 快速开始

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
        uses: leavesster/duplicate-run-action@v0.1

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

## 工作原理

Git 的每个 commit 都有一个 tree hash，代表文件内容的快照。两个 commit 即使 SHA 不同，只要代码相同，tree hash 就相同：

```
PR head commit:    abc1234  →  tree: 9f8e7d6...
Merge commit:      def5678  →  tree: 9f8e7d6...  ← 同一个 tree = 同一份代码
```

这个 Action 通过 GitHub API 获取 tree hash，与历史成功 run 比较。不需要 checkout，纯 API 调用。

## 输入参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `token` | `${{ github.token }}` | GitHub token，默认 token 即可，已有 `actions:read` 权限。 |
| `max_history` | `10` | 检查最近多少个成功的 run。 |
| `check_concurrent` | `true` | 是否检查正在运行的 run，避免并行重复。 |

## 输出

| 输出 | 说明 |
|------|------|
| `is_duplicate` | 是否重复：`'true'` 或 `'false'`。 |
| `reason` | 人类可读的判断原因。 |
| `matched_run_id` | 匹配到的重复 run ID（无则为空）。 |
| `tree_hash` | 当前 commit 的 tree hash（调试用）。 |

## 检测逻辑

### 历史 Run

查询同一 workflow 最近 `max_history` 个成功的 run。如果有任何一个 tree hash 与当前 commit 相同，则标记为重复。

### 并发 Run

启用 `check_concurrent` 时，也会检查正在运行的 run。只考虑 **run ID 更小**（更早启动）的 run，避免两个 run 互相跳过。

## 不会跳过的情况

| 场景 | 行为 |
|------|------|
| 首次运行 | 无历史可匹配，正常运行。 |
| 代码变更 | tree hash 不同，正常运行。 |
| 上次失败 | 只匹配成功的 run，正常运行。 |
| 不同 workflow | 每个 workflow 独立检查。 |

## 配合 `concurrency` 使用

这个 Action 可以和 GitHub 内置的 `concurrency` 配合，双重保障：

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  check-duplicate:
    # ... 同上配置
```

`concurrency` 处理运行中的取消；`duplicate-run-action` 处理跨事件的去重。

## 开发

```bash
npm install
npm run build    # 通过 ncc 编译到 dist/index.js
```

`dist/` 目录需要提交到仓库 —— 这是 JavaScript GitHub Actions 的要求。

## 许可证

MIT
