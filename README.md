# omp-designer — Autonomous AI Design System

**Built natively for oh-my-pi (omp).** A toggleable `/designer` command that transforms your AI coding agent into an autonomous design specialist. Also compatible with Pi (pi.dev).

```bash
omp install npm:omp-designer      # oh-my-pi (native)
pi install npm:omp-designer       # Pi (compatible)
```

Then `/designer` → DESIGNER MODE ON.

---

## What it does

The agent takes a brief and produces **production-ready websites** without human design intervention. It:

1. **Captures the brief** — writes PRODUCT.md with target audience, brand voice, key messages
2. **Studies references** — visits real websites to extract design patterns
3. **Creates a design system** — writes DESIGN.md with exact colors, typography, spacing, motion
4. **Builds components** — 6-8 unique layout families per page, scroll animations, dark mode
5. **Self-critiques** — takes screenshots, checks for AI tells, fixes issues
6. **Ships** — clean TypeScript build, zero AI slop

---

## The 9 Skills

| Skill | Purpose |
|-------|---------|
| **designer-master** | 8-step autonomous workflow orchestrator |
| **taste-skill** | Anti-slop rules: fake numbers, em-dashes, buzzwords, testimonial patterns |
| **product-md** | Brief capture — persists product context across turns |
| **design-md** | Design system spec — colors, typography, spacing, motion, components |
| **reference-study** | Study real websites before designing |
| **visual-critique** | Screenshot evaluation + mobile QA checklist |
| **copywriting** | Human-sounding copy rules + examples |
| **scroll-choreography** | Narrative motion patterns (pinned scroll, horizontal scroll, parallax) |
| **animate** | Animation patterns, easing functions, Motion v12 integration |

---

## How it works

The agent follows a 3-phase workflow:

### Phase 1: Grill Me
Agent asks 3-5 smart multiple-choice questions:
- Who is this for? (developers, consumers, businesses, creatives)
- What vibe? (minimal, bold, dark, warm, premium)
- How complex? (one-pager, landing, multi-page)
- Any references? (Apple, Linear, Stripe, Vercel, surprise me)
- Dark mode? (yes, no, both)

### Phase 2: Plan
Agent uses MCPs to find components, then creates:
- Mood board (palette, fonts, reference sites)
- Section-by-section breakdown with animations
- Layout wireframes (ASCII art)
- User types "accept" to approve

### Phase 3: Build
Agent implements the approved plan:
- Writes PRODUCT.md + DESIGN.md
- Builds all components
- Generates images
- Runs fix-ai-slop script
- Screenshots and critiques
- Ships

```
User: "build me a landing page for my AI tool"
         │
         ▼
┌─────────────────────────────────────────────┐
│  PHASE 1: GRILL ME                          │
│  • Write PRODUCT.md (brief capture)         │
│  • Study 2-3 reference sites                │
│  • Generate 3 design directions             │
│  • Pick the strongest one                   │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│  PHASE 2: DESIGN                            │
│  • Write DESIGN.md (complete visual system) │
│  • Choose palette from inline table (10)    │
│  • Choose fonts from typography CSV (57)    │
│  • Set motion system (easing, durations)    │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│  PHASE 3: BUILD                             │
│  • Build 6-8 unique layout families         │
│  • Write human copy (no buzzwords)          │
│  • Generate 1-3 key images                  │
│  • Implement scroll choreography            │
│  • Run fix-ai-slop.mjs (em-dash cleanup)    │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│  PHASE 4: CRITIQUE + FIX                    │
│  • Take desktop + mobile screenshots        │
│  • Check hierarchy, spacing, copy, anti-slop│
│  • Fix targeted issues (max 3 cycles)       │
│  • Verify build passes                      │
└─────────────────────────────────────────────┘
```

---

## Anti-Slop System

The system catches AI-generated patterns at multiple levels:

### Inline in PROMPT_INJECT (always active)
- 10 curated color palettes — agent picks from table, never invents
- Em-dash ban — "NEVER use em-dashes anywhere"
- Fake number ban — "NEVER include percentages you invented"
- Fake social proof ban — "NEVER mention real companies in testimonials"
- Layout variety — "Each section uses a DIFFERENT layout family"
- Optical typography — tracking, leading, clamp() rules
- Dark mode rules — "deliberate design choice, not inverted colors"
- Component patterns — 5 hero types, 4 feature types, 3 pricing types

### In skills (loaded on demand)
- taste-skill: 78KB anti-slop rulebook with 50+ rules
- copywriting: banned words list, copy process, style references
- scroll-choreography: narrative motion patterns
- visual-critique: 8 mobile QA criteria, visual evaluation checklist

### Post-build scripts
- `scripts/fix-ai-slop.mjs` — automatic em-dash replacement
- `scripts/analyze-layout.mjs` — layout variety analysis

---

## Test Results (13 tests, all zero AI tells)

| Test | Domain | Score | Key Feature |
|------|--------|-------|-------------|
| Orbitask | SaaS | 9.5/10 | Pinned scroll, bento grid |
| Luna | Portfolio | 9.5/10 | Horizontal scroll gallery, broken grid |
| Flux | Creative Agency | 9.5/10 | Pinned horizontal scroll, 6 layouts |
| IronPulse | Fitness | 9/10 | Pinned scroll, progress ring |
| Kuro | Restaurant | 9/10 | CSS ramen bowl, pinned timeline |
| Nexus | SaaS | 9/10 | Terminal hero, bento grid |
| FlowBoard | SaaS | 9/10 | Inline kanban mockup |
| Forge | DevTools | 9/10 | Terminal hero, dark-first |
| Ember Coffee | E-commerce | 8.5/10 | Pinned timeline, warm palette |
| Aperture | AI narrative | 8.5/10 | 7 sections, canvas particles |
| Syncboard | SaaS | 8.5/10 | Animated cursor mockup |
| Ceramics | E-commerce | 9/10 | Masonry gallery, lightbox |
| Dev Portfolio | Portfolio | 9/10 | Terminal typewriter, blog routes |

---

## What ships in the package

```
omp-designer/
├── extension/index.ts           # omp extension (autonomous workflow)
├── extensions/designer.ts       # Pi extension (palette table)
├── skills/                      # 9 design skills
│   ├── designer-master.md       # 8-step autonomous workflow
│   ├── taste-skill.md           # Anti-slop rulebook
│   ├── product-md.md            # Brief capture
│   ├── design-md.md             # Design system spec
│   ├── reference-study.md       # Reference site study
│   ├── visual-critique.md       # Screenshot evaluation
│   ├── copywriting.md           # Human copy rules
│   ├── scroll-choreography.md   # Narrative motion
│   ├── animate.md               # Animation patterns
│   ├── review-skill.md          # Post-build audit
│   └── ui-ux-pro-max.md         # Design intelligence
├── data/
│   ├── ui-ux-pro-max/           # 1.7 MB design database
│   │   ├── design.csv           # 161 color palettes
│   │   ├── typography.csv       # 57 font pairings
│   │   └── ...                  # styles, UX guidelines
│   └── scroll-templates.tsx     # 5 reusable scroll patterns
├── scripts/
│   ├── fix-ai-slop.mjs          # Post-build em-dash fix
│   └── analyze-layout.mjs       # Layout variety analysis
├── test-output/                 # 13 test projects
├── docs/problems.md             # Known issues + fixes
├── loop.md                      # Improvement loop instructions
└── AGENTS.md                    # AI-readable install guide
```

---

## Quickstart

```bash
# 1. Install
omp install npm:omp-designer

# 2. Optional: get API keys for MCP servers
#    21st.dev: free at https://21st.dev/studio
#    designmd: optional at https://designmd.ai/api-keys
#    Add them to ~/.omp/agent/mcp.json

# 3. Start coding
omp
/designer                        # DESIGNER MODE ON
"Build me a SaaS landing page"   # AI builds autonomously
/designer                        # DESIGNER MODE OFF
```

> **Best model:** Kimi K2.6 (`opencode-go/kimi-k2.6:high`) — best design taste, follows anti-slop rules most consistently. MiniMax M3 is also good.

---

## MCP Servers (optional but recommended)

| Server | What it provides | Needs API key? |
|--------|-----------------|----------------|
| **ui-layouts** | 60+ real React/TSX components, 100+ blocks | No |
| **chrome-devtools** | Headless browser: screenshots, console check, a11y audit | No |
| **21st-dev-magic** | SVG logo search, component inspiration | Yes (free) |
| **designmd** | Design system references | Yes (optional) |

---

## Pi compatibility

| Feature | omp | Pi |
|---------|-----|-----|
| Full autonomous workflow | ✅ | ✅ |
| 9 design skills | ✅ | ✅ |
| MCP servers | ✅ | ✅ |
| Plan files (`local://`) | ✅ | `write` fallback |
| Subagents (parallel builds) | ✅ | Sequential builds |
| `generate_image` (hero images) | ✅ | SVG logos + placeholders |
| `web_search` (reference study) | ✅ | Uses known URLs + MCP tools |

---

## License

MIT. Bundled skills retain their respective licenses.
