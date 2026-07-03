# Problems found and v5 decisions

## Fixed

### Duplicate installation and hook registration

The old documentation combined plugin installation, managed skill copies, and
manual extension paths. Real traces contained adjacent duplicate prompt and tool
events. v5 uses package-relative assets, documents one installation mechanism,
adds a process-wide registration guard, and reports legacy-copy risk in
`/designer-doctor`.

The affected development machine also had a v5 plugin link beside the old v2
manual extension and all 12 managed skills. This explains the observed strict
gate error. A dry-run-first uninstaller and clean local installer now detect and
remove that exact mix. Their destructive paths are regression-tested against an
isolated temporary HOME.

### Skill gate dominated the task

The 12-skill ordering gate blocked unrelated tools, created a ten-phase state
machine, and repeatedly continued after the agent was ready to stop. It measured
ritual completion rather than interface quality. v5 has four conditional skills
and no `tool_call`/`tool_result` gate.

### MCP ownership was wrong

The extension edited host MCP configuration and coupled designer mode to server
enablement. This caused cwd/global mismatches, reload requirements, and failures
unrelated to the user's design task. v5 only reports configured MCPs. Research is
optional and task-driven.

### Validators encoded style opinions as failures

The prior copy validator could treat punctuation, CSS percentages, and generic
word lists as hard errors. The layout validator expected full artifacts for small
changes. v5 limits blockers to evidence and objective accessibility defects;
style and documentation signals are warnings.

### The model could self-authorize claims

An agent could write `Source: user` into EVIDENCE.md and make an invented release
status pass its own validator. v5 now retains the original user prompt in runtime
memory and passes it directly to the delivery validator. Generated ledgers remain
useful documentation, but are not the authority during automatic checks.

### Data was not audited

`typography.csv` contained a concatenated record and several palette foreground
pairs were below 3:1. A CSV parser and contrast audit now run in the normal test
suite. Remaining 3:1–4.5:1 pairs are explicitly warned because their validity
depends on use.

### Tests exercised reimplementations

Several old tests duplicated logic or checked a synthetic gate rather than the
actual extension. v5 imports the real TypeScript extension, invokes its registered
handlers, tests real validator CLIs, audits packed release files, and runs a real
model comparison when output behavior changes.

### Mixed installation weakened E2E evidence

The later v5 DeepSeek runs exercised the v5 prompt, delivery validator, and trace,
but old v2 files remained discoverable on the host. The v2 mode was usually off,
so the comparison still identified real v5 improvements; it did not prove a
clean production install. Clean installation and restart are now explicit
preconditions for release-candidate model runs. The harness also stopped passing
an explicit extension path beside the installed plugin. The first clean,
single-source comparison is R8.

### Approval plans ignored explicit page scope

A real DeepSeek plan read the design skills but replaced "various pages" with a
single long page, overpromised effects, and later rationalized the miss. Prompt
guidance alone remained inconsistent across repeated runs. Plan-only turns now
use a smaller prompt without delivery-review instructions and a bounded runtime
check for objective scope, route, form, metrics, dead-link, source, and native
scroll violations. The same prompt reached `plan_checks_passed` after one rewrite
in R8 without creating project files.

### Automated score was mistaken for design quality

The first v5 DeepSeek run reached 100/100 while screenshots still showed three
repetitive card-grid sections. The report now labels its number as an automated
delivery score and emits composition signals. A written screenshot review is part
of every comparison.

## Repair status (v5 audit follow-up)

Tracked against `docs/repair-plan-v5.md`.

- **P0 — Security / release hygiene: done.** A live key that sat in the working
  tree was removed from the repo and relocated outside it; `.env` stays gitignored
  with a safe `.env.example`. `check-release` now scans the repo working tree
  (dotfiles, docs, tests, examples) in addition to the packed tarball, using the
  shared `shared/security.mjs` pattern source. The exposed key must still be
  rotated by the owner.
- **P1 — Core logic correctness: done.** Secret patterns consolidated into
  `shared/security.mjs` (runtime redaction and release scan share one source).
  Plan-intent detection rewritten (robust English, German fallback, no
  "review my existing plan and implement it" false positive). Plan length ceiling
  and prompt now agree, with an explicit detailed-specification bypass.
  `session_stop` delivery checks run only after real file changes, and fallback
  session ids use a monotonic token to avoid same-cwd collisions.
- **P2 — Host-bridge evidence: done.** `scripts/__tests__/host-bridge.test.ts`
  simulates the OMP/Pi host event contract against the real adapters (registration,
  one-time prompt injection, four-skill discovery, plan-continuation exactness,
  delivery-check gating, duplicate-load, OMP/Pi difference, id collision
  resistance). `scripts/e2e-smoke.mjs` reports the same as a smoke run. This is
  simulated, not live-OMP, proof.
- **Real OMP smoke: unverified.** `--real-omp` remains `SKIPPED` without a local
  OMP and model credentials; no automated real-model E2E has passed.
- **Remaining:** P3 documentation consistency (this pass), P4 designer-quality and
  eval rubric, P5 performance/context cost, P6 release readiness (version bump,
  tag, clean-tree publish).
- **Publish: NO-GO** until the exposed key is rotated and git/version hygiene is
  satisfied (clean tree, version bump, tag). Architecture is otherwise sound; a
  return to the v4 gate would be wrong.

## Deliberate limitations

- Static validators cannot prove keyboard behavior, visual hierarchy, or motion
  quality.
- A palette row cannot guarantee accessible usage; component-level contrast still
  needs review.
- Session-stop validation does not prove browser QA.
- MCP handshakes prove server availability, not reference quality.
- A single model/case can catch regressions but cannot establish universal design
  quality.

## Follow-up criteria

Add complexity only when repeated real-agent evidence justifies it. A proposed
rule should include:

1. the concrete failed output,
2. why an existing prompt, review step, or validator cannot catch it,
3. a regression test,
4. before/after runs using the same case and model,
5. an escape path for legitimate exceptions.
