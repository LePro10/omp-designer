# omp-designer — AI-Powered UI/UX Design Mode

**Built natively for oh-my-pi (omp).** A toggleable `/designer` command that transforms your AI coding agent into a design specialist. Also compatible with Pi (pi.dev).

```bash
omp install npm:omp-designer      # oh-my-pi (native)
pi install npm:omp-designer       # Pi (compatible)
```

Then `/designer` → DESIGNER MODE ON.

---

## How it works (the mental model)

Think of the designer mode like a **film production team** packed into your AI agent:

### The Director — designer-master

The orchestrator. When you say "build me a landing page", the director takes over and runs an **8-step production**:

1. **Read the room** — figures out what kind of site, for what audience, what vibe
2. **Consult the experts** — pulls in the right design rules for this project
3. **Scout for assets** — searches real component libraries (via MCP servers) instead of inventing from scratch
4. **Write the brief** — picks exact colors and fonts from a database of 161 palettes
5. **Get sign-off** — shows you the plan before writing a single line of code
6. **Shoot** — builds everything with real components
7. **Post-production** — 3 rounds of review: does it build? are there console errors? does it pass the 50-point checklist?
8. **Deliver** — shows you the result with screenshots

### The Art Director — taste-skill

The anti-slop enforcer. This is a **78 KB rulebook** that stops the AI from producing the same generic designs every AI defaults to:

- ❌ Purple gradients (`#667eea`, `#764ba2` — the "AI purple")
- ❌ Three identical cards in a row
- ❌ Glassmorphism on everything
- ❌ Em-dashes in headlines
- ❌ "Jane Doe, CEO of Acme" fake testimonials
- ❌ Scroll cues, version labels, decorative dots...

Plus a **50-point pre-flight checklist** that runs before delivery. If any box fails, the page isn't done.

It also sets **3 dials** at the start of every project:
- **Design Variance** (1 = symmetrical, 10 = artsy chaos)
- **Motion Intensity** (1 = static, 10 = cinematic)
- **Visual Density** (1 = airy gallery, 10 = data-dense cockpit)

These dials control every decision downstream — layout, spacing, animation, everything.

### The Motion Designer — animate

Based on Emil Kowalski's animation course. Tells the AI exactly which easing to use, how long animations should last, and when to use CSS vs. Framer Motion vs. GSAP. No more janky `transition: all 0.3s` everywhere.

### The Research Library — ui-ux-pro-max

A **1.7 MB database** the AI can search:
- 161 color palettes organized by product type (SaaS, e-commerce, portfolio, healthcare...)
- 57 font pairings (heading + body combinations tested by designers)
- 67 UI style definitions
- 99 UX guidelines (accessibility, touch targets, performance, anti-patterns)

Instead of the AI guessing "what colors look good together?", it greps a CSV and gets a real palette.

### The QA Lead — review-skill

After code is written, runs a 3-cycle audit:
1. **Build test** — does it compile?
2. **Browser test** — opens Chrome headless, checks console errors, takes screenshots at multiple viewport sizes
3. **Color audit** — greps the codebase for banned AI-slop hex codes

---

## How the parts fit together

```
You type /designer
        │
        ▼
The extension writes "enabled: true" to state file
        │
        ▼
On your next prompt, omp auto-injects:
  ├── 5 skill files into the AI's context
  ├── System prompt with anti-slop rules
  └── CSV data path (so the AI knows where the palettes are)
        │
        ▼
AI follows the 8-step director workflow:
  Assess → Plan → Get Approval → Build → Review → Deliver
        │
        ▼
MCP servers provide real tools during the workflow:
  ui-layouts     → real React components (60+)
  21st-dev       → SVG logos, component inspiration
  chrome-devtools → headless browser for review
  designmd       → design system references (optional)
        │
        ▼
You type /designer again → OFF. Agent back to normal coding.
```

---

## What ships in the package

```
omp-designer/
├── extension/index.ts        # omp extension (native)
├── extensions/designer.ts    # Pi extension (compatible)
├── skills/                   # The 5 specialists
│   ├── designer-master.md    # The Director (8-step orchestrator)
│   ├── taste-skill.md        # The Art Director (anti-slop + pre-flight)
│   ├── animate.md            # The Motion Designer (easing + patterns)
│   ├── ui-ux-pro-max.md      # The Research Library (instruction set)
│   └── review-skill.md       # The QA Lead (post-build audit)
└── data/ui-ux-pro-max/       # 1.7 MB design database
    ├── design.csv            # 161 color palettes
    ├── typography.csv        # 57 font pairings
    └── …                     # styles, UX guidelines, per-stack configs
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
"Build me a SaaS landing page"   # AI follows the 8-step workflow
/designer                        # DESIGNER MODE OFF
```

> **Best model:** MiniMax M3 (`minimax/MiniMax-M3:high`) — best design taste, follows anti-slop rules most consistently.

---

## MCP Servers (optional but recommended)

4 external services the AI can call during the design workflow. All disabled by default, toggled ON/OFF with `/designer`.

| Server | What it provides | Needs API key? |
|--------|-----------------|----------------|
| **ui-layouts** | 60+ real React/TSX components, 100+ blocks | No |
| **chrome-devtools** | Headless browser: screenshots, console check, a11y audit | No |
| **21st-dev-magic** | SVG logo search, component inspiration | Yes (free) |
| **designmd** | Design system references | Yes (optional) |

Setup → AGENTS.md (the AI-readable install guide in this repo).

---

## Pi compatibility

The designer mode was built for omp but works on Pi too — with some differences:

| Feature | omp | Pi |
|---------|-----|-----|
| Full 8-step workflow | ✅ | ✅ |
| 5 design skills | ✅ | ✅ |
| MCP servers (21st-dev, chrome-devtools, etc.) | ✅ | ✅ |
| Plan approval (`resolve` tool) | ✅ | Chat-based fallback |
| Plan files (`local://`) | ✅ | `write` fallback |
| Subagents (`task` parallel builds) | ✅ | Sequential builds |
| `generate_image` (hero images) | ✅ | SVG logos + placeholders |
| `web_search` (look up references) | ✅ | Uses known URLs + MCP tools |

The extension detects which platform it's running on and adapts automatically.

---

## License

MIT. Bundled skills retain their respective licenses (ui-ux-pro-max: MIT, taste-skill: MIT).
