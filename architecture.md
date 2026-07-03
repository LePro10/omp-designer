# omp-designer v5 architecture

## Design constraints

The runtime should improve design work without becoming the work. It therefore:

- injects one concise prompt,
- exposes four package-relative skills,
- never gates ordinary tools,
- never mutates MCP configuration,
- keeps project state per working directory,
- runs only bounded delivery checks,
- records enough trace data to diagnose duplicate registration.

## Runtime flow

```text
/designer
    │
    ├─ persist enabled state for cwd
    │
before_agent_start
    ├─ remove an older v5 prompt from the prompt array
    └─ append one current v5 prompt
    │
resources_discover
    └─ expose four conditional skills
    │
agent work
    ├─ local inspection
    ├─ optional, task-driven MCP use
    └─ proportional artifacts and implementation
    │
session_stop
    ├─ quality validator
    ├─ layout validator
    ├─ project build
    └─ at most one repair continuation
```

The model also runs and reports delivery checks itself. The session-stop hook is
a backstop, not a state machine and not proof of browser QA.

## Duplicate-load defense

OMP can discover the same source through a plugin and an explicit path. Separate
loader realms can isolate both `globalThis` and environment writes, so
registration uses three layers:

- a realm-local `Symbol.for` marker,
- a process-wide PID marker in the environment,
- an atomic process-scoped lock file for isolated Bun loader realms.

`/designer-doctor` separately reports an old manual-copy risk. Installation
documentation requires one install mechanism.

## State

`~/.omp/agent/designer-state.json` maps absolute working directories to booleans.
Writes use a temporary file and atomic rename. A legacy global state is read for
migration. Automation can override state with `OMP_DESIGNER_MODE`.

## Skills

| Skill | Loaded when |
| --- | --- |
| designer-master | substantive design work |
| design-md | new visual language or major redesign |
| animate | meaningful motion is requested or present |
| review-skill | delivery review |

No skill-read order is technically enforced. Prompt contract tests protect the
important behavior: immediate-build requests do not trigger questionnaires, small
edits remain proportional, and MCP use is optional.

## MCP boundary

The extension reads MCP configuration only for the doctor summary. Server
installation, credentials, enablement, retries, and lifecycle remain owned by the
agent host and user. A reference-server failure cannot stop local implementation.

## Validators

`fix-ai-slop.mjs` separates:

- blockers: unsupported visible claims and concrete commerce promises,
- warnings: cadence, vague language, and remote placeholder risk.

For automatic delivery checks, the extension passes the original user prompt in
memory as `DESIGNER_USER_FACTS`. This trusted input overrides model-authored
ledgers, preventing the agent from labelling its own invented claim as user-supplied.

`analyze-layout.mjs` checks a selected palette, documented source colors, contrast,
responsive signals, and reduced motion. Missing documentation and style drift are
warnings unless they produce an objective accessibility failure.

`audit-data.mjs` validates CSV structure and contrast centrally so malformed
reference rows fail package tests.

## Evaluation

`real-agent-eval.mjs` launches the actual `omp` CLI with a chosen model in an
isolated child of `test-output/`. It builds and validates candidate and baseline,
counts screenshots by prefix or `screenshots/` directory, requires at least two
created after the latest source change, and reports composition risk signals.
Visual inspection remains mandatory because deterministic checks cannot measure
hierarchy, originality, or whether a screenshot proves the claimed viewport.

## Release boundary

`check-release.mjs` inspects `npm pack --dry-run --ignore-scripts`, verifies the
v5 runtime files, rejects legacy gate/MCP mutation strings, and scans the packed
artifact for secret patterns. Tests and generated output are not published.

## Installation boundary

The package exposes a dry-run-first `omp-designer` lifecycle CLI:

- `uninstall` delegates registered-plugin removal to omp, then removes only the
  known v2 extension and 12 known managed-skill directories;
- `install-local` validates and links the current checkout;
- `install-local --clean` composes both operations for pre-publish testing.

A normal uninstall also removes state, traces, and obsolete gate/phase data.
`--keep-data` is an explicit local-reinstall exception. MCP files, credentials,
general OMP sessions, and unrelated memory are outside the package ownership
boundary. Lifecycle regression tests use a temporary HOME and fake omp binary so
they cannot mutate the developer's real installation.
