# omp-designer — Autonomous AI Design System (v4.0)

A `/designer` extension for oh-my-pi that turns your AI coding agent into a UI/UX design specialist.

```bash
omp install npm:omp-designer
```

Then `/designer` → DESIGNER MODE ON.

---

## How it works

```
User: "build me a website about AI"
         │
         ▼
┌─────────────────────────────────────────────┐
│  STEP 1: BRANCH SELECTION                    │
│  "surprise me" → ask 1 emotion question      │
│  Otherwise → ask 3-5 multiple-choice          │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│  STEP 2: PRODUCT.md + EVIDENCE.md            │
│  Write brief + claim tracking before design  │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│  STEP 3: PLAN (MANDATORY)                    │
│  7-section plan with MCP research log        │
│  User types "accept" to approve              │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│  STEP 4: MCP RESEARCH                        │
│  designmd, ui-layouts, 21st-dev, browser     │
│  Fallback: web_search if MCPs unavailable    │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│  STEP 5: DESIGN TOKENS                       │
│  Palette from colors.csv (by row number)     │
│  Typography from typography.csv              │
│  DESIGN.md written before any component      │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│  STEP 6: BUILD                               │
│  Components following approved plan          │
│  generate_image for hero visuals             │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│  STEP 7: POST-BUILD SELF-CHECK (MANDATORY)   │
│  fix-ai-slop.mjs + analyze-layout.mjs        │
│  npm run build + impeccable detect            │
│  Section viewport screenshots                │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│  STEP 8: ANTI-SLOP VERIFICATION              │
│  Substitution test + rationale test          │
│  Anti-overcorrection check                   │
│  Shipping readiness vs slop risk             │
└─────────────────────────────────────────────┘
```

---

## The 12 Skills

| Skill | When Agent Reads It | What It Contains |
|-------|-------------------|------------------|
| **designer-master** | First (workflow contract) | 8-step workflow, palette table, plan template |
| **ai-slop** | During planning | Canonical anti-slop definition, substitution test, rationale test, 14 evaluation dimensions |
| **product-md** | Before design work | PRODUCT.md format, EVIDENCE.md template, "never invent facts" |
| **taste-skill** | During planning + after building | Brief inference, dials, AI tells checklist, pre-flight check |
| **design-md** | Before building | DESIGN.md format, Tailwind v4 notes, motion notes |
| **ui-ux-pro-max** | During planning | How to pick from CSV data files (161 palettes, 57 font pairings) |
| **reference-study** | During planning | How to study real websites before designing |
| **copywriting** | Before building | Human copy rules, banned words, validation checkpoint |
| **scroll-choreography** | Before building | Narrative motion patterns, mobile fallbacks |
| **animate** | During building | Animation patterns, easing, timing |
| **visual-critique** | After building | Screenshot evaluation, mobile QA, reveal-trigger protocol |
| **review-skill** | After building | Post-build audit, dimension-based evaluation, anti-overcorrection |

---

## MCP Servers

| Server | What It Provides | When Used |
|--------|-----------------|-----------|
| **21st-dev-magic** | Component inspiration, SVG logos | During planning |
| **ui-layouts** | 60+ real React/TSX components | During planning + building |
| **chrome-devtools** | Headless browser screenshots | During planning + review |
| **designmd** | Design system references | During planning |

---

## Anti-Slop System

### Canonical reference
- **ai-slop.md** (679 lines) — the single source of truth for what constitutes AI slop

### Deterministic validators
- **fix-ai-slop.mjs** — read-only by default (`--check`); catches em-dashes, buzzwords, fake numbers, stock photos, unsupported EVIDENCE.md claims, overused fonts, commerce claims. Use `--fix` only for deterministic em-dash cleanup.
- **analyze-layout.mjs** — read-only; catches off-palette colors, motion timing issues, layout problems, CSV palette validation.
- **Automatic session-stop gate** — in omp, designer mode runs both validators automatically before the final assistant response when the current directory looks like a generated project. Blocking issues force an internal continuation instead of shipping.

### Evaluation framework
- **14 dimensions** scored 0-4 (product grounding, truthfulness, specificity, narrative, composition, system coherence, copy, imagery, motion, accessibility, responsiveness, functional completeness, distinctiveness)
- **Shipping readiness** — pass/fail on blocking defects
- **Slop risk** — weighted score from 0-100

### Observability
- **Run trace** — when designer mode is enabled, the omp extension writes JSONL events to `~/.omp/agent/designer-traces/<cwd-hash>.jsonl`.
- **Traced events** — prompt injection, skill discovery, agent start/end, tool calls/results, automatic validation start/pass/fail, validator/build command kinds.
- **Doctor command** — `/designer-doctor` writes source/install/skill/MCP/trace health into the editor.

---

## Files

```
omp-designer/
├── extension/index.ts           # omp extension (PROMPT_INJECT, MCP toggling, trace, doctor)
├── extensions/designer.ts       # Pi extension
├── skills/                      # 12 design skills
│   ├── ai-slop.md               # Canonical anti-slop reference (NEW)
│   ├── designer-master.md       # Workflow contract
│   ├── taste-skill.md           # Anti-slop rules + AI tells
│   ├── product-md.md            # Brief capture + EVIDENCE.md
│   ├── design-md.md             # DESIGN.md format
│   ├── ui-ux-pro-max.md         # CSV data usage
│   ├── reference-study.md       # Reference study guide
│   ├── copywriting.md           # Human copy rules
│   ├── scroll-choreography.md   # Motion patterns
│   ├── animate.md               # Animation patterns
│   ├── visual-critique.md       # Screenshot evaluation
│   └── review-skill.md          # Post-build audit
├── data/
│   ├── ui-ux-pro-max/           # 1.7MB design database (CSVs)
│   └── scroll-templates.tsx     # Reusable scroll patterns
├── scripts/
│   ├── fix-ai-slop.mjs          # Read-only anti-slop validator; --fix mutates
│   ├── analyze-layout.mjs       # Layout + palette + motion validator
│   └── check-release.mjs        # Version + secret hygiene release gate
├── test-output/                 # Test projects
├── docs/problems.md             # Known issues + fixes
└── loop.md                      # Improvement loop
```

---

## Quickstart

```bash
omp install npm:omp-designer
omp
/designer                        # DESIGNER MODE ON
/designer-doctor                 # Optional: verify install, skills, MCPs, trace path
"Build me a SaaS landing page"   # Agent asks questions first
# Answer the questions
# Agent shows plan with MCP research log
# Type "accept"
# Agent builds
# Agent runs fix-ai-slop --check + analyze-layout
# Agent takes section screenshots
# Agent reports substitution test + rationale test
```

---

## Best Model

MiniMax M3 (`opencode-go/minimax-m3:high`) — best design taste. DeepSeek V4 Flash also good for testing.

---

## License

MIT.
