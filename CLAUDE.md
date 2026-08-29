<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes_tool` or `query_graph_tool` instead of Grep
- **Understanding impact**: `get_impact_radius_tool` instead of manually tracing imports
- **Code review**: `detect_changes_tool` + `get_review_context_tool` instead of reading entire files
- **Finding relationships**: `query_graph_tool` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview_tool` + `list_communities_tool`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes_tool` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context_tool` | Need source snippets for review — token-efficient |
| `get_impact_radius_tool` | Understanding blast radius of a change |
| `get_affected_flows_tool` | Finding which execution paths are impacted |
| `query_graph_tool` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes_tool` | Finding functions/classes by name or keyword |
| `get_architecture_overview_tool` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes_tool` for code review.
3. Use `get_affected_flows_tool` to understand impact.
4. Use `query_graph_tool` pattern="tests_for" to check coverage.

<!-- QA loop -->
## QA loop

`bash scripts/qa-check.sh` is this project's QA gate: typecheck → unit tests → production
build. It always runs all three and exits non-zero if any fail; raw output goes to `qa-out/`.
The sibling `turtle-backend` repo has its own `scripts/qa-check.sh` (syntax + API tests);
both are part of one gate and the loop runs them together.

## Two QA modes

- `/qa-loop` — deterministic. Runs the existing suites and fixes what fails.
- `/qa-explore <charter>` — exploratory. Drives the real app in a browser against a
  plain-English brief ("check the morning survey flow on mobile"), finds bugs the suite does
  not cover, writes failing regression tests for them, then hands off to the same fix/verify
  loop. **Read-only by default**: the app points at the production backend
  (`services/Database.ts`), so writes are opt-in via `--write`. Set `VITE_API_URL` to point a
  QA run at a different backend.

The dev server's port 3000 is fixed (`autoPort: false` in `.claude/launch.json`) because the
backend's CORS allowlist names it. On another port the app loads and every API call fails.

Run `/qa-loop` to drive the full cycle: the **qa-tester** subagent runs the gate and writes
`qa-report.json`, the **fixer** subagent repairs what it reports, and qa-tester re-verifies.
Capped at 3 rounds. The fixer must never edit tests, and only a qa-tester `pass` ends the loop.
