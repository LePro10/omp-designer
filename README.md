# omp-designer — Autonomous AI Design System (v3.2)

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
│  PHASE 1: GRILL ME (MANDATORY)              │
│  Agent asks 3-5 multiple-choice questions:   │
│  • Who is this for?                          │
│  • What vibe?                                │
│  • How complex?                              │
│  • Reference sites?                          │
│  • Dark mode?                                │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│  PHASE 2: PLAN                               │
│  Agent reads skills + uses MCPs:             │
│  • taste-skill (design read + dials)         │
│  • colors.csv (palette selection)            │
│  • typography.csv (font pairing)             │
│  • 21st-dev (component inspiration)          │
│  • ui-layouts (real React components)        │
│  Creates mood board + section plan           │
│  User types "accept" to approve              │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│  PHASE 3: BUILD                              │
│  Agent reads more skills:                    │
│  • design-md (DESIGN.md format)              │
│  • copywriting (human copy rules)            │
│  • scroll-choreography (motion patterns)     │
│  • animate (animation + easing)              │
│  Builds, self-critiques, ships               │
│  • visual-critique (screenshot evaluation)   │
│  • taste-skill Section 9 (AI tells)          │
└─────────────────────────────────────────────┘
```

---

## The 9 Skills

| Skill | When Agent Reads It | What It Contains |
|-------|-------------------|------------------|
| **designer-master** | After user answers questions | Full workflow orchestrator, palette table |
| **taste-skill** | During planning + after building | Anti-slop rules, AI tells checklist |
| **product-md** | Before asking questions | How to capture the brief |
| **design-md** | Before building | DESIGN.md format, Tailwind v4 notes, motion notes |
| **reference-study** | During planning | How to study real websites |
| **visual-critique** | After building | Screenshot evaluation, mobile QA checklist |
| **copywriting** | Before building | Human copy rules, banned words |
| **scroll-choreography** | Before building | Narrative motion patterns |
| **animate** | During building | Animation patterns, easing, Motion v12 |

---

## MCP Servers

| Server | What It Provides | When Used |
|--------|-----------------|-----------|
| **21st-dev-magic** | Component inspiration, SVG logos | During planning |
| **ui-layouts** | 60+ real React/TSX components | During planning + building |
| **chrome-devtools** | Headless browser screenshots | After building (review) |
| **designmd** | Design system references | During planning |

---

## Anti-Slop System

- **Inline in PROMPT_INJECT:** Grill Me enforcement, MCP tool list, skill reading map
- **In designer-master:** Palette table (10 rows), workflow phases
- **In taste-skill:** 78KB anti-slop rulebook (fake numbers, em-dashes, buzzwords, testimonials)
- **In copywriting:** Banned words list, copy process, style references
- **Post-build:** `scripts/fix-ai-slop.mjs` catches reflexive em-dashes

---

## Files

```
omp-designer/
├── extension/index.ts           # omp extension (PROMPT_INJECT + MCP toggling)
├── extensions/designer.ts       # Pi extension
├── skills/                      # 9 design skills
├── data/
│   ├── ui-ux-pro-max/           # 1.7MB design database (CSVs)
│   └── scroll-templates.tsx     # Reusable scroll patterns
├── scripts/
│   ├── fix-ai-slop.mjs          # Post-build em-dash fix
│   └── analyze-layout.mjs       # Layout analysis
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
"Build me a SaaS landing page"   # Agent asks questions first
# Answer the questions
# Agent shows plan
# Type "accept"
# Agent builds
```

---

## Best Model

Kimi K2.6 (`opencode-go/kimi-k2.6:high`) — best design taste. MiniMax M3 also good.

---

## License

MIT.
