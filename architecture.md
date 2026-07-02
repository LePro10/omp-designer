# System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         omp (oh-my-pi)                                │
│  ~/.bun/bin/omp                                                      │
│  Wrapper: omp() in .bashrc/.zshrc                                    │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ -e / --extension
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│              OMP Extension (extension/index.ts)                       │
│                                                                       │
│  Full enforcement: 9 hooks, pre-execution tool blocking,              │
│  session-stop validation, trace logging, phase inference              │
│                                                                       │
│  ┌─ Commands ──────────────────────────────────────────────────────┐ │
│  │ registerCommand("designer")        toggle ON/OFF                │ │
│  │ registerCommand("designer-doctor") health diagnostics           │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─ Event Hooks ──────────────────────────────────────────────────┐  │
│  │ resources_discover   inject 12 skill paths into agent context   │  │
│  │ before_agent_start   inject PROMPT_INJECT + gate prompt         │  │
│  │ agent_start          initialize SkillGate instance              │  │
│  │ agent_end            persist gate report + trace                │  │
│  │ tool_call            block gated tools, track skill reads       │  │
│  │ tool_result          verify skill-read completion, coverage     │  │
│  │ session_stop         gate validation + auto-validators          │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└──────────┬──────────┬──────────────────────┬──────────────────────────┘
           │          │                      │
           ▼          ▼                      ▼
┌──────────────┐ ┌──────────┐ ┌──────────────────────────────────────┐
│  12 Skills   │ │ 4 MCPs   │ │ PROMPT_INJECT + SkillGate prompt     │
│ (shared/     │ │ (mcp.json│ │                                      │
│  skill-gate  │ │  config) │ │ 10-phase workflow                    │
│  .mjs        │ │          │ │ + Anti-Slop Rules                    │
│  manifest)   │ │ • 21st-  │ │ + MCP Tool List                     │
│              │ │   dev-   │ │ + Gate Status                        │
│ see manifest │ │   magic  │ │ + Consequences                       │
│ below        │ │ • design │ └──────────────────────────────────────┘
│              │ │   md     │
│              │ │ • ui-    │
│              │ │   layouts│
│              │ │ • chrome │
│              │ │   devtool│
└──────────────┘ └──────────┘
```

## Skill Manifest (Single Source of Truth)

`shared/skill-gate.mjs` exports `REQUIRED_DESIGNER_SKILLS` — the definitive list used by both OMP and Pi extensions. No separate skill lists exist.

| #  | Skill               | URI                        |
|----|----------------------|----------------------------|
| 0  | designer-master      | `skill://designer-master`  |
| 1  | ai-slop              | `skill://ai-slop`          |
| 2  | product-md           | `skill://product-md`       |
| 3  | taste-skill          | `skill://taste-skill`      |
| 4  | design-md            | `skill://design-md`        |
| 5  | ui-ux-pro-max        | `skill://ui-ux-pro-max`    |
| 6  | reference-study      | `skill://reference-study`  |
| 7  | copywriting          | `skill://copywriting`      |
| 8  | scroll-choreography  | `skill://scroll-choreography` |
| 9  | animate              | `skill://animate`          |
| 10 | visual-critique      | `skill://visual-critique`  |
| 11 | review-skill         | `skill://review-skill`     |

All 12 are `required: true`. The manifest hash (SHA-256 of canonical skill list) is included in session reports to detect divergence.

## State Machine

10 phases + 1 error state, defined in `shared/skill-gate.mjs`:

```
idle → loading_skills → skills_ready → discovery → brief_ready → plan_ready → approved → building → validating → done
                                                                                                                                                                     
                                          error_order_violation  (terminal — designer-master must be read first)
```

- **idle** — initial state, no skills read
- **loading_skills** — skills being read; gate locked
- **skills_ready** — all 12 skills verified read; gate opens, tools unblocked
- **discovery** — MCP research, reference study
- **brief_ready** — PRODUCT.md captured
- **plan_ready** — DESIGN.md created
- **approved** — user approved the plan
- **building** — implementation in progress
- **validating** — post-build validators running
- **done** — session complete
- **error_order_violation** — a skill was read before designer-master; gate resets required

Phase transitions are forward-only (except rollback to `loading_skills` on stale-read detection). `transitionTo()` validates ordering.

## Tool Gating

10 tools blocked until `skills_ready` (defined in `GATED_TOOLS`):

| Tool             | Purpose                        |
|------------------|--------------------------------|
| write            | File creation/modification     |
| edit             | Surgical file edits            |
| ast_edit         | AST-aware rewrites             |
| bash             | Terminal commands              |
| generate_image   | Image generation               |
| browser          | Browser automation             |
| search_tool_bm25 | BM25 search                    |
| resolve          | Resolve pending actions        |
| task             | Delegate to subagents          |
| ask              | Ask the user                   |

Blocked calls return `DESIGNER_SKILL_GATE_BLOCKED` with the list of missing skills.

## Skill Gate (`shared/skill-gate.mjs`)

The `SkillGate` class is the shared enforcement core:

- **beginRead/completeRead protocol** — `tool_call` triggers `beginRead()` (records pending read with toolCallId), `tool_result` triggers `completeRead()` (verifies content hash, line coverage)
- **Line-coverage verification** — large skills read in multiple passes are tracked by line range; a skill is `complete` only when all lines are covered. Reading only the YAML header counts as `partial`
- **Ordering enforcement** — `designer-master` must be read first. `wasMasterReadFirst()` verifies this. Violations set `error_order_violation` phase
- **Stale-read detection** — `validateReads()` re-checks skill file hashes. If content changed after reading, the skill is demoted to `partial` and the gate re-locks
- **Content hashing** — SHA-256 of each skill file, stored in read records

## OMP Extension vs Pi Extension

### OMP (`extension/index.ts`) — Full Enforcement

9 hooks: 2 commands + 7 event handlers.

| Hook                  | Function                                              |
|-----------------------|-------------------------------------------------------|
| registerCommand       | `/designer` toggle, `/designer-doctor` diagnostics    |
| resources_discover    | Injects 12 skill paths into agent context             |
| before_agent_start    | Appends PROMPT_INJECT + gate prompt to system prompt  |
| agent_start           | Initializes SkillGate, sets phase to idle             |
| agent_end             | Persists gate report + trace event                    |
| tool_call             | Blocks gated tools pre-skills_ready, tracks reads     |
| tool_result           | Verifies read completion, updates coverage            |
| session_stop          | Gate validation + auto-validators (fix-ai-slop, analyze-layout) |

Pre-execution tool blocking is technically enforced — the agent cannot call gated tools until all 12 skills are verified read.

### Pi (`extensions/designer.ts`) — Prompt-Only Enforcement

2 hooks: 1 command + 1 event handler.

| Hook                  | Function                                              |
|-----------------------|-------------------------------------------------------|
| registerCommand       | `/designer` toggle                                    |
| before_agent_start    | Appends PROMPT_INJECT to system prompt                |

Pi's API does not expose `tool_call`, `tool_result`, or `session_stop` hooks. Enforcement relies on prompt instructions only — no technical pre-execution blocking. Both extensions import the same `shared/skill-gate.mjs` for the manifest and gate prompt.

## MCP Servers (4)

Configured in `docs/mcp.json.example`, toggled by `/designer`:

| Server           | Package                    | Purpose                    |
|------------------|----------------------------|----------------------------|
| 21st-dev-magic   | `@21st-dev/magic@latest`   | AI-powered UI generation   |
| designmd         | `designmd-mcp@latest`      | Design system management   |
| ui-layouts       | `@ui-layouts/mcp@latest`   | Layout reference database  |
| chrome-devtools  | `chrome-devtools-mcp@latest` | Headless browser QA       |

All 4 are `enabled: false` by default; `/designer` enables them on toggle.

## Validators

| Script                    | Mode              | Purpose                                     |
|---------------------------|-------------------|---------------------------------------------|
| fix-ai-slop.mjs           | read-only (--check default, --fix explicit) | Anti-slop: em-dashes, buzzwords, fake precision, stock photos |
| analyze-layout.mjs        | read-only         | Layout: palette validation, motion timing, tablet breakpoint |
| audit-trace.mjs           | read-only         | JSONL trace: verifies prompt/skills/validators were executed |
| check-release.mjs         | read-only         | Release gate: version consistency, secret scan |
| eval-suite.mjs            | read-only         | Golden prompt corpus: deterministic coverage validation |

## Session Report & Trace

- **Gate report** — machine-readable JSON per session: sessionId, projectRoot, phase, manifestHash, skills[], missingSkills, ready, masterReadFirst, violations. Persisted to `~/.omp/agent/designer-gates/<cwd-hash>.json`
- **Trace** — JSONL per project under `~/.omp/agent/designer-traces/`. Events: designer_enabled/disabled, skills_discovered, prompt_injected, skill_gate_initialized, tool_call, tool_result, agent_start/end, session_stop_*, auto_validation_*

## Tests

| Test File                    | Coverage                                               |
|------------------------------|--------------------------------------------------------|
| skill-gate.test.mjs          | 29 tests: spec cases, multi-pass, coverage edges, Pi/OMP parity |
| fix-ai-slop.test.mjs         | 11 tests: em-dashes, buzzwords, fake precision, adversarial FPs/FNs |
| analyze-layout.test.mjs      | 5 tests: brand colors, grid breakpoints, palette validation |
| audit-trace.test.mjs         | 3 tests: trace completeness, strict mode               |
| prompt-contract.test.mjs     | 4 tests: interaction modes, approval conflict          |
| eval/prompts.jsonl           | 20 golden prompts across 15 categories                 |

## Data Flow: OMP vs Pi

```
                         OMP Extension                          Pi Extension
                    ┌─────────────────────┐              ┌─────────────────────┐
                    │                     │              │                     │
User types prompt  │ before_agent_start   │              │ before_agent_start   │
──────────────────►│ + PROMPT_INJECT      │              │ + PROMPT_INJECT      │
                    │ + gate prompt        │              │ (no gate prompt)     │
                    │                     │              │                     │
Agent reads skill  │ tool_call: beginRead │              │ (no hook)            │
──────────────────►│ tool_result:         │              │                      │
                    │   completeRead       │              │                      │
                    │                     │              │                      │
Agent calls write  │ tool_call: BLOCKED   │              │ (no hook — prompt    │
before skills_ready│ returns gate error   │              │  compliance only)    │
──────────────────►│                     │              │                      │
                    │                     │              │                      │
Session ends       │ session_stop:        │              │ (no hook)            │
──────────────────►│  gate validation     │              │                      │
                    │  auto-validators    │              │                      │
                    │  persist report     │              │                      │
                    └─────────────────────┘              └─────────────────────┘

                    Both import shared/skill-gate.mjs for:
                    • REQUIRED_DESIGNER_SKILLS (12 skills)
                    • PHASES (10-phase state machine)
                    • SkillGate class
                    • getGatePrompt()
```
