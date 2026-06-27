# Reddit Post — omp-designer for Pi

## Target Subreddits
- **r/programming** (primary)
- **r/web_design** 
- **r/cursor** / **r/OpenAI** (AI coding tools)
- **r/opensource**

---

## Title (pick one)

```
I built a Pi package that stops AI coding agents from producing the same 
purple-gradient, Inter-font, three-card slop — and forces them to use real 
design intelligence instead
```

Shorter:
```
Stop your Pi coding agent from writing #667eea everywhere — I built a /designer 
mode that injects real design skills + 161 palettes + 50-item pre-flight checklist
```

---

## Body (Markdown)

I use [Pi](https://pi.dev) for frontend work, and like most AI coding tools, 
it defaults to the same generic aesthetic every time:

- `#667eea` / `#764ba2` purple gradients on everything
- Inter font, three equal cards, glassmorphism where it doesn't belong
- Em-dashes in every headline, fake testimonials from "Jane Doe, CEO of Acme"
- No real design system, no palette discipline, no pre-flight checks

So I built **omp-designer** — a Pi package that adds a `/designer` toggle. 
When ON, it injects **5 specialized design skills** and tells Pi about 
**4 MCP integrations** for real component sourcing and headless review.

### Install

```bash
pi install npm:omp-designer
# Then in Pi: /designer → DESIGNER MODE ON
```

### What you get

**5 Design Skills** loaded into Pi's context:

| Skill | What it does |
|-------|-------------|
| **designer-master** | 8-step orchestrator (assess → plan → implement → review) |
| **taste-skill** | 78 KB anti-AI-slop rules, 50+ pre-flight checklist, 3 design dials |
| **animate** | Emil Kowalski's animation patterns — proper easing, spring physics, Motion v12 |
| **ui-ux-pro-max** | 161 color palettes, 57 font pairings, 67 UI styles, 99 UX guidelines |
| **review-skill** | Post-build audit: console errors, a11y, banned hex colors |

**4 MCP servers** (auto-configured, toggle with `/designer`):
- **21st-dev-magic** — component inspiration + SVG logo search
- **ui-layouts** — 60+ real React/TSX components
- **chrome-devtools** — headless screenshot + a11y + console review
- **designmd** — design system references (optional, needs API key)

### How it works

```
/designer              # toggle ON
"Build me a SaaS landing page"
                       # Pi now follows the 8-step workflow:
                       # 1. Infers vibe/audience
                       # 2. Reads design rules (lazy, sections only)
                       # 3. Searches MCPs for real components
                       # 4. Picks palette FROM CSV data (161 rows)
                       # 5. Presents plan for approval
                       # 6. Builds with real components
                       # 7. 3-cycle review + 50-item pre-flight
                       # 8. Shows results

/designer              # toggle OFF — Pi back to normal coding
```

### Why this works

Most AI coding tools don't know design. They sample from a latent space 
weighted toward generic SaaS templates. This package doesn't make the model 
smarter — it **constrains** it:

> You CANNOT use #667eea. You MUST pick from a real CSV palette. 
> You MUST run the 50-item pre-flight checklist. 
> You MUST check your own output for slop patterns.

### Pre-flight checklist highlights (50+ items)

- ❌ Em-dashes anywhere on the page
- ❌ Purple AI-slop hexes (`#667eea`, `#764ba2`, `#1a1a2e`, `#16213e`, `#f0f0ff`)
- ❌ "Jane Doe, CEO of Acme" — AI filler names
- ❌ 3+ consecutive sections with identical layout
- ❌ `h-screen` instead of `min-h-[100dvh]`
- ❌ Scroll cues (`↓ scroll to explore`)
- ❌ Version labels on marketing pages (`V0.6`, `BETA`)
- ❌ More than one marquee per page
- ...40+ more

### Source

MIT licensed. Package on npm: `omp-designer` (keyword: `pi-package`).

GitHub: [github.com/leandro/omp-designer](https://github.com/leandro/omp-designer)

For Pi packages: see [pi.dev docs](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)

---

Happy to answer questions. If you've dealt with AI-design-defaults in Pi or 
any other coding agent, I'd love to hear how you solved it.
