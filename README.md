# omp-designer v5

Focused UI/UX workflow for [Pi](https://pi.dev) and
[oh-my-pi](https://github.com/can1357/oh-my-pi).

Version 5 removes the mandatory 12-skill gate and MCP state mutation. It provides
four conditional skills, a concise system prompt, evidence-aware validators, and
a reproducible real-agent comparison harness.

## Install

Install with exactly one mechanism:

```bash
# Pi
pi install npm:omp-designer

# oh-my-pi
omp install npm:omp-designer
```

Do not also copy the extension into an agent extension directory. Duplicate
install paths can register hooks twice. Run `/designer-doctor` if an older manual
copy may still exist.

### Published package

For a normal published installation:

```bash
# Inspect only; this changes nothing
npx --yes omp-designer@latest uninstall

# Remove an existing plugin plus known v2 leftovers
npx --yes omp-designer@latest uninstall --apply

# Install one fresh published copy
omp install npm:omp-designer@latest
```

Fully restart omp after changing the installation. Then run
`/designer-doctor`. A normal uninstall removes plugin registration, known legacy
copies, state, traces, and obsolete gate/phase data. MCP configuration,
credentials, general OMP sessions, and unrelated agent memory are never changed.

### Local checkout before publishing

Use a plugin link when testing this checkout:

```bash
cd /path/to/omp-designer
npm run system:inspect
npm run install:local:clean
```

`install:local:clean` removes the current `omp-designer` registration and the
known v2 manual extension/managed-skill copies, runs `npm test` and
`npm run check:release`, then links this checkout with `omp plugin link`. It
uses the explicit `--keep-data` path so comparison traces survive. Restart omp
and run `/designer-doctor` before a real-agent comparison.

Dry-run and explicit variants:

```bash
# Run these inside the repository
npm run install:local          # preview only
npm run install:local:apply    # link only; refuses a legacy mix
npm run uninstall:system       # preview only
npm run uninstall:system:apply # remove all package-owned OMP data
```

From any directory, address the currently installed OMP package directly:

```bash
# Preview
node "$HOME/.omp/plugins/node_modules/omp-designer/scripts/lifecycle-cli.mjs" uninstall

# Apply full uninstall
node "$HOME/.omp/plugins/node_modules/omp-designer/scripts/lifecycle-cli.mjs" uninstall --apply
```

Do not install the npm package over a local link. Uninstall the local copy first,
then install the published package. See
[docs/install-lifecycle.md](docs/install-lifecycle.md) for the full transition
matrix and retained-data policy.

Toggle the workflow:

```text
/designer
```

The mode is stored per project. `OMP_DESIGNER_MODE=1` and
`OMP_DESIGNER_MODE=0` provide explicit overrides for automation.

## What v5 loads

- `designer-master`: proportional product-design workflow
- `design-md`: visual-system contract for new pages and redesigns
- `animate`: optional motion guidance
- `review-skill`: delivery and browser review

Skills remain package-relative. There is no managed-skill copy and no requirement
to read every skill before using tools. Skill reads are not technically enforced;
v5 relies on the focused prompt, plan checks, delivery checks, and evals rather
than a skill-read gate. Where the host does not emit read events, skill
consumption is not directly observable.

## Hosts: OMP and Pi

The two adapters share prompt injection, four-skill discovery, plan-intent
detection, and one bounded plan-only continuation. They are not at parity:

| Capability | OMP (`extension/index.ts`) | Pi (`extensions/designer.ts`) |
| --- | --- | --- |
| Focused prompt injection | yes | yes |
| Four-skill `resources_discover` | yes | yes |
| Plan-intent detection + bounded plan-only continuation | yes | yes |
| Post-execution delivery checks (quality/layout/build on `session_stop`) | yes | no |
| Trace events under `~/.omp/agent/designer-traces` | yes | no |
| Tool interception / skill-read hard gate | none | none |
| MCP mutation | none | none |

Pi is prompt-only plus plan checks. It has no delivery-check backstop; the OMP
`session_stop` delivery path is host-specific and is not mirrored on Pi.

## Security and key hygiene

- No API key belongs in this repository. `.env` is gitignored; keep real
  credentials outside the repo (for example under `~/.config/…` sourced by your
  shell) and copy `.env.example` when you need a local `.env`.
- If a live key was ever committed or left in the working tree, rotate it.
- `npm run check:release` scans both the packed tarball and the repo working tree
  (including dotfiles) for secret patterns. Placeholders such as
  `<YOUR_OPENAI_API_KEY>` are allowed; real-looking secrets fail the check.
- Runtime trace redaction and the release scanner share one pattern source,
  `shared/security.mjs`.

## MCP policy

MCP servers are optional references, not workflow gates. The extension observes
their configuration in `/designer-doctor` but never edits `mcp.json` and never
enables or disables a server.

Useful optional servers:

- `chrome-devtools`: browser inspection when the built-in browser is insufficient
- `ui-layouts`: relevant layout/component references
- `21st-dev-magic`: component or SVG search; API key required
- `designmd`: external design-system references; API key required

Configure only the servers a team actually uses. Pin versions in shared or
production configuration.

## Validation

```bash
npm test
npm run check:release
```

The quality validator blocks unsupported visible claims and commerce promises.
Stylistic signals such as a single em dash are warnings. The layout validator
checks documented colors and objective contrast failures without requiring a
full design document for a small edit.

During omp delivery checks, claim support comes from the original user prompt
held in extension memory. Agent-generated PRODUCT.md or EVIDENCE.md cannot
self-authorize a fact. Standalone CLI use falls back to those ledgers unless
`DESIGNER_USER_FACTS` is supplied.

Approval-plan turns use a separate read-only prompt without delivery-review
instructions. A bounded plan check catches objective scope failures such as
collapsing requested pages into one page, missing concrete routes, unsolicited
forms or metrics, dead links, and scroll-jacking. It may request one rewrite and
never forms an autonomous loop. An explicitly requested detailed specification is
allowed to exceed the length ceiling; an unrequested overlong plan gets one
tightening continuation, not a hard rejection.

On OMP, `session_stop` delivery checks are a post-execution backstop, not
pre-execution enforcement. They run only after real project files change during a
session; a pure chat or planning turn spawns no build. A failed check yields one
bounded repair continuation. Pi does not run this backstop.

### Simulated host-bridge and optional real smoke

```bash
npm run test:e2e     # simulated OMP/Pi host contract against the real adapters
npm run e2e:smoke    # same, as a reportable smoke run (add --real-omp to attempt)
```

`test:e2e` drives the real adapter hooks through a simulated host (no model, no
live OMP process): registration, one-time prompt injection, skill discovery,
plan continuation exactness, delivery-check gating, duplicate-load, and the
OMP/Pi capability difference. It is simulated evidence, not proof that a live
OMP host emits identical event shapes. `e2e:smoke --real-omp` is optional and
reports `SKIPPED` (never `PASS`) when OMP or model credentials are unavailable.

Run validators against another project:

```bash
node scripts/fix-ai-slop.mjs --check /path/to/project
node scripts/analyze-layout.mjs /path/to/project
```

## Real-agent comparison

Generated projects and reports are kept under `test-output/` (gitignored, never
packed). This directory can grow to gigabytes; reclaim space with a dry-run-first
cleanup that retains the JSON reports and e2e-canary as release evidence:

```bash
npm run cleanup:artifacts             # dry run: lists what it would remove
npm run cleanup:artifacts -- --apply  # delete generated runs, keep evidence
```

Real-agent runs themselves:

```bash
node scripts/real-agent-eval.mjs \
  --run fieldnote-r1 \
  --case saas \
  --baseline test-output/previous-run \
  --model opencode-go/deepseek-v4-flash:xhigh
```

The harness runs the real `omp` agent, builds the result, runs both validators,
counts named screenshots, records composition warning signals, and emits a JSON
comparison in `test-output/reports/`. A run is invalid unless its isolated trace
proves prompt injection, a delivery outcome, and no adjacent duplicate hook event.
Generation refuses to start unless OMP reports this checkout as the sole clean
v5 plugin source. The harness does not add a second explicit extension path.

This harness is a manual tool: it needs a local `omp`, a model provider, and
credentials, and its artifacts live in untracked `test-output/`. It is not part
of `npm test` and is not automated clean-install E2E evidence. The simulated
`test:e2e` host-bridge suite is the automated adapter evidence; a real-model run
here is complementary manual verification.

Its numeric score measures delivery evidence, not visual taste. Screenshots must
still be reviewed. A valid iteration is:

1. establish one clean install source and restart omp,
2. run the same case against a baseline,
3. inspect desktop and mobile screenshots,
4. record concrete failures,
5. change the smallest responsible prompt, skill, validator, or runtime behavior,
6. rerun the same case and compare.

Earlier v5 agent runs were useful runtime and validator comparisons, but the host
still contained a disabled v2 extension and 12 legacy managed-skill directories.
They were therefore not clean-install E2E evidence. Lifecycle behavior is now
covered in an isolated temporary HOME, and the R8 DeepSeek comparison was run
after `install:local:clean` with one v5 plugin source and no explicit extension
double-load.

## Commands

- `/designer`: toggle for the current working directory
- `/designer-doctor`: inspect source path, duplicate-install risk, runtime assets,
  and MCP configuration

## Runtime structure

```text
extension/index.ts               omp extension (prompt, plan checks, delivery backstop)
extensions/designer.ts           Pi extension (prompt + plan checks, no backstop)
shared/security.mjs              shared secret patterns for redaction and release scan
skills/                          four conditional skills
data/ui-ux-pro-max/              palette and typography search data
scripts/fix-ai-slop.mjs          evidence-aware copy validator
scripts/analyze-layout.mjs       proportional layout/contrast validator
scripts/audit-data.mjs           CSV integrity and contrast audit
scripts/audit-trace.mjs          duplicate-load and delivery trace audit
scripts/real-agent-eval.mjs      manual real-model comparison harness
scripts/e2e-smoke.mjs            simulated host-bridge smoke runner (optional --real-omp)
scripts/check-release.mjs        packed-artifact and repo-wide secret release gate
scripts/cleanup-artifacts.mjs    dry-run-first cleanup for generated test-output
scripts/install-local.mjs        safe local-link installer
scripts/uninstall-system.mjs     dry-run-first omp cleanup
scripts/__tests__/host-bridge.test.ts  simulated OMP/Pi host-contract tests
```

## Requirements

- Node.js 20.19 or newer
- Pi or omp
- `npm`/`npx`
- a configured model provider for real-agent evaluations

No API key belongs in this repository, chat transcript, command argument, or
generated report.
