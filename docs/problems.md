# Known Problems & TODOs

## LATEST CHANGES (v4.0)

### AI-SLOP.md Integration
- [x] **AI-SLOP.md as canonical reference** — 679-line anti-slop definition added as skills/ai-slop.md
- [x] **EVIDENCE.md validator** — fix-ai-slop.mjs reads EVIDENCE.md and flags unsupported claims
- [x] **CSV palette validation** — analyze-layout.mjs checks DESIGN.md colors against colors.csv
- [x] **Stable/temporal rule separation** — ai-slop.md Section 18 separates permanent principles from trend-based rules
- [x] **Dimension-based evaluation** — review-skill.md has 14 dimensions scored 0-4
- [x] **Anti-overcorrection check** — first-order and second-order reflex detection
- [x] **Shipping readiness vs slop risk** — separate scores, not collapsed into one number

### Validator Improvements
- [x] **Buzzword detector** — skips "what to avoid" sections in DESIGN.md
- [x] **Font detector** — compound exceptions (Roboto Mono != Roboto)
- [x] **Font detector** — skips avoidance context lines
- [x] **Motion intensity dial** — analyzer respects MOTION_INTENSITY from DESIGN.md
- [x] **EVIDENCE.md exclusion** — EVIDENCE.md and PRODUCT.md excluded from evidence/commerce claim scanning
- [x] **Stock photo detection** — now includes picsum.photos

### PROMPT_INJECT Rewrite
- [x] **8-step explicit workflow** — Branch → PRODUCT.md → Plan → MCP → Tokens → Build → Self-check → Anti-slop
- [x] **Plan template** — 7-section mandatory plan with MCP Research Log
- [x] **MCP fallback** — web_search/browser if MCPs unavailable
- [x] **Post-build self-check** — fix-ai-slop + analyze-layout + build + impeccable
- [x] **Critical rules embedded** — copy, motion, images, honesty rules from skipped skills

### Mechanical Reliability
- [x] **fix-ai-slop split** — default `--check` is read-only; `--fix` is explicit
- [x] **Validator regression tests** — known false positives and one evasion case are now covered
- [x] **Release gate** — `check-release.mjs` validates version/docs and scans for likely secrets
- [x] **Run trace** — omp extension writes JSONL telemetry for prompt injection, skill discovery, agent/tool lifecycle
- [x] **Doctor command** — `/designer-doctor` reports source/install/skill/MCP/trace health
- [x] **Session-stop validation gate** — omp automatically runs `fix-ai-slop --check` and `analyze-layout` before final responses for generated projects

---

## REMAINING

### P1: Agent still skips manual post-build scripts sometimes
The PROMPT_INJECT says "MANDATORY" but the agent selectively ignores when context is long.
**Status:** Structurally mitigated in omp: `session_stop` now runs the two deterministic validators automatically. Build/browser checks still depend on agent/tool execution.

### P2: MCP research still skipped when MCPs are unavailable
Need stronger fallback behavior — agent should use web_search or browser.
**Status:** PROMPT_INJECT says "try web_search or browser as fallback." Testing.

### P3: Motion timing violations
Agent uses 500ms entrances when DESIGN.md says 240-320ms.
**Status:** analyze-layout.mjs now catches this. Agent must fix before shipping.

### P4: Plan approval gate sometimes skipped
Agent sometimes goes straight to building.
**Status:** PROMPT_INJECT says "WAIT for approval before building." Testing.

### P5: Agent can't see screenshots
Model limitation. Agent can take screenshots but can't evaluate visually.
**Workaround:** Section viewport screenshots + code-based critique.

### P6: CSS @import warning
Tailwind v4 generates CSS with @import after other rules.
**Status:** Warning only, doesn't break functionality.

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
