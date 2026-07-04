# omp-designer v5 architecture

## Design constraints

The runtime should improve design work without becoming the work. It therefore:

- injects one concise prompt,
- exposes five package-relative skills,
- never gates ordinary tools,
- never mutates MCP configuration,
- keeps project state per working directory,
- runs only bounded delivery checks,
- records enough trace data to diagnose duplicate registration.

## Runtime flow (OMP)

This flow is OMP-specific. Pi is described separately below.

```text
/designer
    │
    ├─ persist enabled state for cwd
    │
before_agent_start
    ├─ remove an older v5 prompt from the prompt array
    ├─ append one current v5 prompt
    └─ record session start (baseline for change detection + fallback id)
    │
resources_discover
    └─ expose five conditional skills
    │
agent work
    ├─ local inspection
    ├─ optional, task-driven MCP use
    └─ proportional artifacts and implementation
    │
session_stop  (post-execution detection, not pre-execution enforcement)
    ├─ approval plan: objective scope checks, at most one rewrite
    └─ implemented project (only if project files changed this session):
       ├─ quality validator
       ├─ layout validator
       ├─ project build
       └─ at most one repair continuation
```

The model also runs and reports delivery checks itself. The session-stop hook is
a post-execution backstop, not a state machine and not proof of browser QA. It is
gated on real file changes since the recorded session start: a pure chat or
planning turn produces no build spawn and no side effects.

For a user-requested approval turn, the injected prompt omits the delivery-review
skill path and build checks. The runtime reads the final assistant text and checks
only objective plan requirements recoverable from the user prompt. A failed plan
gets one targeted rewrite context; a second failure settles without another
continuation. An explicitly requested detailed specification bypasses the plan
length ceiling; an unrequested overlong plan gets one tightening continuation.

Session ids prefer the host `session_id`. When the host omits it, the adapter
falls back to a monotonic per-session token combined with the cwd so separate
sessions in the same directory do not collide.

## Runtime flow (Pi)

Pi shares `before_agent_start` prompt injection, `resources_discover`, plan-intent
detection, and the bounded plan-only continuation. Pi's `session_stop` runs the
plan check only. Pi has no delivery-check backstop: it never runs the quality,
layout, or build validators and writes no trace files. This is a host capability
difference, not a bug; Pi is prompt-only plus plan checks. Documentation must not
present Pi and OMP as at parity.

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
| expression | choosing the ambition dials and the page's signature moment |
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
hierarchy, originality, or whether a screenshot proves the claimed viewport. This
harness is manual and needs model credentials; it is not part of `npm test`.

`scripts/__tests__/host-bridge.test.ts` and `scripts/e2e-smoke.mjs` provide the
automated adapter evidence. They simulate the documented OMP/Pi host event
contract against the real adapter modules — registration, one-time prompt
injection, five-skill discovery, plan-continuation exactness, delivery-check
gating, duplicate-load, and the OMP/Pi capability difference. This is simulated
evidence: it does not prove a live OMP host emits identical event shapes, and it
does not drive a real model. `e2e-smoke.mjs --real-omp` reports `SKIPPED` (never
`PASS`) when OMP or credentials are absent.

## Release boundary

`check-release.mjs` inspects `npm pack --dry-run --ignore-scripts`, verifies the
v5 runtime files (including `shared/security.mjs`), rejects legacy gate/MCP
mutation strings, and scans for secret patterns in two places: the packed
artifact and the repo working tree (dotfiles, docs, tests, examples). Placeholder
tokens are allowed; real-looking secrets fail. Tests and generated output are not
published. Secret patterns come from the single source `shared/security.mjs`,
shared with runtime trace redaction.

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
