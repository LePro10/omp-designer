# AGENTS.md — omp-designer v5

Follow this file when installing, changing, or evaluating the package.

## Purpose

`omp-designer` is a toggleable `/designer` workflow for Pi and oh-my-pi. Version
5 uses four conditional design skills and deterministic delivery checks. MCP
servers are optional and are never toggled by the extension.

## Prerequisites

- Node.js 20.19 or newer
- Pi or omp
- `npm` and `npx`
- a configured model provider

Pi's basic read/write/edit/bash tools are sufficient for core work. Browser,
image-generation, and subagent extensions can help particular tasks, but must not
be presented as installation requirements.

## Install

Use exactly one installation mechanism:

```bash
pi install npm:omp-designer
# or
omp install npm:omp-designer
```

Never combine a plugin install with a manually copied extension. If upgrading
from v4, use the lifecycle cleanup, install v5 once, fully restart the agent, and
run `/designer-doctor`.

Published install:

```bash
npx --yes omp-designer@latest uninstall --apply
omp install npm:omp-designer@latest
```

Local checkout:

```bash
cd /path/to/omp-designer
npm run system:inspect
npm run install:local:clean
```

`npm run` lifecycle commands require the checkout as the current directory. From
any directory, invoke the installed package directly:

```bash
node "$HOME/.omp/plugins/node_modules/omp-designer/scripts/lifecycle-cli.mjs" uninstall --apply
```

Lifecycle commands are dry-run by default. `install:local:clean` is the explicit
exception: it cleans known v2 files, runs package checks, and links the current
checkout. Its internal `--keep-data` preserves comparison traces. A direct
`uninstall --apply` removes all package-owned OMP data by default. Neither path
edits MCP configuration, general sessions, or unrelated memory.

Verify:

1. `/designer` reports `DESIGNER MODE ON`.
2. `/designer` again reports `DESIGNER MODE OFF`.
3. `/designer-doctor` shows four present skills and no duplicate-load risk.

## Optional MCP configuration

Ask before configuring a service that requires a key. Never guess or expose a
key.

- `21st-dev-magic`: optional component/SVG search; requires `API_KEY`
- `designmd`: optional design-system reference; requires `DESIGNMD_API_KEY`
- `chrome-devtools`: optional browser inspection
- `ui-layouts`: optional layout references

The extension does not edit `~/.pi/agent/mcp.json` or
`~/.omp/agent/mcp.json`. Configuration belongs to the user. Prefer pinned package
versions in persistent configuration. An unavailable MCP must degrade to local
inspection rather than block the workflow.

## Runtime contract

- State is per working directory.
- `OMP_DESIGNER_MODE=1` or `0` overrides persisted state for automation.
- Skills and data are read from the installed package.
- No tool is blocked until a skill is read.
- Small edits stay small; artifacts are reserved for new pages and major
  redesigns.
- Product claims require user or source evidence.
- Warnings require judgment; only objective blockers prevent delivery.
- Delivery continuation is bounded and must never form an autonomous loop.

## Required checks for package changes

```bash
npm test
npm run check:release
```

For changes that can affect generated output, also run a real-agent comparison:

```bash
node scripts/real-agent-eval.mjs \
  --run <new-run> \
  --case saas \
  --baseline test-output/<previous-run> \
  --model opencode-go/deepseek-v4-flash:xhigh
```

Keep generated projects and reports under `test-output/`. Inspect at least one
desktop and one mobile screenshot. The automated score covers delivery evidence,
not visual quality; record visual findings separately.

Before a real-agent comparison, ensure `/designer-doctor` reports one package
source, four skills, and no legacy duplicate risk. A full host restart is
required after switching between local and published installations. Do not use a
mixed installation as release evidence.

## Repository rules

- Never read entire CSV datasets when a targeted search and range read is enough.
- Never place API keys, npm tokens, auth headers, or `.env` values in chat, CLI
  arguments, traces, fixtures, or commits.
- Never publish before `npm run check:release`.
- Do not hardcode a user's home directory.
- Preserve unrelated work in a dirty tree.
- Update skills only when model-backed evidence points to a workflow problem.
- Compare the same prompt/case before and after a change.
- Never install a published copy over a local link; uninstall the old source
  first.

## Structure

```text
extension/index.ts               omp runtime
extensions/designer.ts           Pi runtime
skills/                          four conditional skills
data/ui-ux-pro-max/              palette/typography reference data
scripts/__tests__/               runtime and validator regression tests
scripts/install-local.mjs        local checkout linker
scripts/uninstall-system.mjs     plugin and known-v2 cleanup
scripts/real-agent-eval.mjs      DeepSeek/omp comparison harness
test-output/                     generated projects and reports, ignored by npm
```

## Troubleshooting

- Duplicate prompt events: run `/designer-doctor`; remove the second install path.
- MCP unavailable: verify it independently, then continue without it if optional.
- Mode enabled but no prompt: restart/reload and check the current working
  directory and state override.
- Validator warning: inspect the actual usage; do not churn code just to reach
  zero warnings.
- Agent claims QA: require build output and named screenshots from the run.
