# Known Problems & TODOs

## LATEST CHANGES (v4.0 — Iteration 9)

### Validator Hardening (adversarial testing)
- [x] **TypeScript `returns` FP fix** — `detectCommerceClaims` now skips lines with code markers (`function`, `const`, `export`, `=>`, etc.)
- [x] **Unicode multiplication sign** — multiplier regex catches `×` (U+00D7) in addition to `x`
- [x] **En-dash detection** — `detectEmDashes` and `fixEmDashes` now catch `–` (U+2013) alongside `—` (U+2014)
- [x] **Buzzword list expanded** — added 23 synonyms models use to bypass the list: effortless, frictionless, pioneering, groundbreaking, next-level, future-proof, bulletproof, blazing-fast, lightning-fast, world-leading, industry-leading, turnkey, battle-tested, mission-critical, enterprise-grade, supercharge, etc.
- [x] **Adversarial false-negative tests** — 5 new tests catch gaps the validator missed
- [x] **Total validator tests: 11** (was 7)

### Mechanical Phase Tracking
- [x] **Phase state file** — `~/.omp/agent/designer-phases/<cwd-hash>.json` tracks `idle → planning → building → reviewing → validated`
- [x] **Tool-call-driven transitions** — writing DESIGN.md/PRODUCT.md → planning; writing src/* → building; running validators → reviewing/validated
- [x] **Phase-aware session_stop** — validation failures now report the current phase and whether validators were run by the agent
- [x] **Phase reset on agent_start** — fresh sessions start at `idle`
- [x] **Doctor shows phase** — `/designer-doctor` reports current phase, files written, validators run

### Docs Sync
- [x] **AGENTS.md accuracy** — verified 12 skills, correct structure, fixed marker reference in troubleshooting
- [x] **Release gate passes** — `check:release` validates version/docs consistency + secret scan

---

## REMAINING

### P1: Agent still skips manual post-build scripts sometimes
The PROMPT_INJECT says "MANDATORY" but the agent selectively ignores when context is long.
**Status:** Structurally mitigated in omp: `session_stop` now runs the two deterministic validators automatically. Phase tracking (`idle → planning → building → reviewing → validated`) provides mechanical evidence of whether the agent ran validators. Build/browser checks still depend on agent/tool execution.

### P2: MCP research still skipped when MCPs are unavailable
Need stronger fallback behavior — agent should use web_search or browser.
**Status:** PROMPT_INJECT says "try web_search or browser as fallback." Testing.

### P3: Motion timing violations
Agent uses 500ms entrances when DESIGN.md says 240-320ms.
**Status:** analyze-layout.mjs now catches this. Agent must fix before shipping.

### P4: Plan approval gate sometimes skipped
Agent sometimes goes straight to building.
**Status:** 4 explicit interaction modes (Guided/Adaptive/Autonomous/Batch) replace conflicting rules. Phase tracking detects when agent writes src/ files without DESIGN.md (skipped planning).

### P5: Agent can't see screenshots
Model limitation. Agent can take screenshots but can't evaluate visually.
**Workaround:** Section viewport screenshots + code-based critique.

### P6: CSS @import warning
Tailwind v4 generates CSS with @import after other rules.
**Status:** Warning only, doesn't break functionality.

### P7: Full corpus is not yet routinely run after every change
The corpus and scoring harness exist, but generated outputs still require a model run.
**Status:** `npm run test:eval` validates coverage deterministically; next step is a model-backed runner/CI job.

### P8: npm publish blocked
npm token was exposed in chat history. Token should be revoked.
**Status:** `npm whoami` returns E401. Source version 4.0.0, npm registry 3.0.0.

---

## FIXED

### v4.0
- [x] AI-SLOP.md integration as canonical reference
- [x] EVIDENCE.md validator with confidence tracking
- [x] CSV palette validation (DESIGN.md vs colors.csv)
- [x] Motion intensity dial respect
- [x] Buzzword/font false positives from avoidance context
- [x] Stable/temporal rule separation
- [x] Dimension-based evaluation
- [x] Anti-overcorrection check
- [x] MCP fallback guidance
- [x] Post-build self-check mandatory
- [x] Critical rules from skipped skills embedded in PROMPT_INJECT
- [x] Stock photo detection includes picsum.photos
- [x] EVIDENCE.md/PRODUCT.md excluded from evidence scanning

### v3.2
- [x] Grill Me enforcement (MANDATORY FIRST ACTION)
- [x] Short PROMPT_INJECT referencing skills
- [x] MCP toggling restored
- [x] Prominent MCP section
- [x] Per-session designer state
- [x] Skill reading map

### Earlier
- [x] CSVs never read → Inlined palette table in PROMPT_INJECT
- [x] Fake numbers → Banned in taste-skill + PROMPT_INJECT
- [x] Fake social proof → Banned in taste-skill + PROMPT_INJECT
- [x] Em-dashes → fix-ai-slop.mjs catches them
- [x] Approval conflict → 8-step workflow with approval gate
- [x] Multi-page support → Detects "various pages" and creates React Router
- [x] Premature claims → HONESTY RULE + EVIDENCE.md
- [x] MCP tools not discovered → MCP section in PROMPT_INJECT
- [x] Color palette not locked → CSV palette validation
- [x] Per-session state → State file stores per-cwd entries
- [x] MCP toggling → Extension enables/disables MCPs on toggle

---

## Test Outputs

| Project | Domain | Palette Source | Key Feature |
|---------|--------|---------------|-------------|
| test-output/grind/ | Coffee subscription | CSV Row 33 | EVIDENCE.md, clean slop check |
| test-output/drift/ | Task management | CSV Row 17 (adapted) | EVIDENCE.md, calm design |
| test-output/still/ | Meditation | CSV Row 98 | EVIDENCE.md, breathe circles |
| test-output/pulse/ | Fitness | CSV Row 35 | EVIDENCE.md, energetic design |
| test-output/lumen-kiln/ | Product | CSV Row 84 | SVG illustrations |
| test-output/quiet-cup/ | Product | CSV Row 84 | No stock photos |
| test-output/northstar-portfolio/ | Portfolio | CSV Row 8 | WebGl particle field |
