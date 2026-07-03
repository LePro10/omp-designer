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
- No tool is blocked, and no skill read is technically enforced. There is no
  `tool_call`/`tool_result` gate and no skill-read hard gate.
- Small edits stay small; artifacts are reserved for new pages and major
  redesigns.
- Product claims require user or source evidence.
- Warnings require judgment; only objective blockers prevent delivery.
- On OMP, delivery checks are a post-execution backstop that runs only after real
  project files change in the session; a chat/planning turn spawns no build.
  Delivery continuation is bounded and must never form an autonomous loop.
- Pi is prompt-only plus plan checks. Pi has no delivery-check backstop. Do not
  document or assume Pi/OMP parity.

## v5 invariants (do not regress)

Future agents working on this package must not:

- Resurrect the v4 skill-read hard gate, the ten-phase state machine, or any
  `tool_call`/`tool_result` tool gating, unless a maintainer explicitly asks. v4
  gating was removed on purpose: it measured ritual skill-read completion rather
  than interface quality. v5 relies on the focused prompt, plan checks,
  post-execution delivery checks, telemetry, and evals instead.
- Claim Pi has technical enforcement or a delivery backstop.
- Treat unit or simulated host-bridge tests as real-model E2E evidence. The
  `test:e2e` suite and `e2e-smoke.mjs` simulate the host contract; they do not
  prove a live OMP run. Real-model runs (`real-agent-eval.mjs`) are manual and may
  be `SKIPPED` without credentials.
- Store live keys anywhere in the repository or working tree. `.env` is gitignored
  and must stay outside the repo; use `.env.example` as the template.
- Reintroduce MCP mutation as a form of enforcement.

Before any release decision, run the P0/P1/P2 checks: `npm test` (includes
`test:e2e`), `npm run check:release`, and confirm the working tree is clean with a
version bump. Skill-read observability is limited unless the host exposes read
events; prove behavior through delivery checks and evals, not "all skills read".

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

Keep generated projects and reports under `test-output/`. Reclaim disk with
`npm run cleanup:artifacts` (dry-run first; `--apply` deletes generated runs and
retains reports/e2e-canary evidence). Inspect at least one desktop and one mobile
screenshot. The automated score covers delivery evidence,
not visual quality; record visual findings separately.

Before a real-agent comparison, ensure `/designer-doctor` reports one package
source, four skills, and no legacy duplicate risk. A full host restart is
required after switching between local and published installations. Do not use a
mixed installation as release evidence.

## Repository rules

- Never read entire CSV datasets when a targeted search and range read is enough.
- Never place API keys, npm tokens, auth headers, or `.env` values in chat, CLI
  arguments, traces, fixtures, or commits. Keep `.env` outside the repo; if a live
  key was ever exposed in the working tree, rotate it.
- Never publish before `npm run check:release`, and never publish from a dirty
  working tree or without a version bump.
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
