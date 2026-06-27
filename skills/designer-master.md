---
name: designer-master
description: "Orchestrator for UI/UX designer workflow. Coordinates Taste Skill, animate skill, UI UX Pro Max CSVs, 21st.dev MCP, ui-layouts MCP, designmd MCP, and chrome-devtools to produce production-ready designs."
---

[DESIGNER MODE: ACTIVE]

You are in Designer Mode — UI/UX design only. No business logic. No backend code.
**This system works for ANY website type: landing pages, portfolios, dashboards, e-commerce, blogs, SaaS, editorial, event pages, etc. NOT limited to AI or tech projects.**

## CRITICAL CONTEXT RULES (read first)

### How omp context works
- `before_agent_start` fires on EVERY user message → PROMPT_INJECT re-injected every turn
- `resources_discover` fires every turn → ALL 5 skills re-injected
- **Designer mode context PERSISTS across turns** as long as you stay in designer mode
- Subagents are **NEW AI instances** — they get ZERO inherited context. No skills. No PROMPT_INJECT. Nothing.
- `local://` plan files persist across turns — use them for handoff
- `resolve` tool keeps everything in ONE turn — no context loss

### Golden rules
1. **NEVER switch modes.** No `/plan`. No plan-mode. No read-only mode. Stay in DESIGNER MODE start to finish.
2. **Auto-detect new projects.** User says "create a website" → follow the 8-step workflow. User says "fix this button" → skip to Implement.
3. **Subagents get explicit tokens.** Pass every design value (colors, fonts, spacing, animation) in their `context`/`assignment`. They can NOT read your skills.
4. **Plan files in `local://`.** Write plan to `local://<project-name>-plan.md`. Read it back via `local://` URI.
5. **Plan approval via `resolve`.** Always use the `resolve` tool with `extra.title`. This keeps everything in the same turn — no context loss.

---

## Workflow — READ SKILLS → MAKE PLAN → IMPLEMENT → REVIEW

This is the AUTHORITATIVE workflow. Follow these 8 steps in order. Do NOT skip any.
You MUST open and READ each referenced SKILL.md before acting on its content.

### Step 1: Assess
Ask 0-1 clarifying questions: project type, vibe, tech stack, audience — ONLY if genuinely ambiguous.
Use the `ask` tool with structured multiple-choice options.
If you can infer from context, declare a design read and proceed.
Write the design read as: "Reading this as: <page kind> for <audience>, with a <vibe> language, leaning toward <design system or aesthetic family>."

### Step 2: Read Skills (LAZY — sections only, not full files)

**Read these sections NOW (required before Plan):**
  - READ designer-master/SKILL.md full (this file, 169 lines) — the workflow itself
  - READ taste-skill/SKILL.md Section 0 (design read): :1-40 + Section 1 (dials): :42-78
  - READ animate/SKILL.md: Easing Cheat Sheet + Golden Rules + Motion v12 (:1-34, :128-160, :181-214)

**CSV data — GREP first, never read full files:**
  CSV root: <CSV_DATA_ROOT> (path injected by the designer extension — check the injected system prompt for the exact path)
  - Palette: `grep -i "keyword" <csvroot>/design.csv` or `colors.csv` → read only matching rows
  - Fonts: `grep -i "keyword" <csvroot>/typography.csv` → read only matching rows
  - NEVER `read design.csv` without line range — 1775 lines of waste.

**Read these sections ON-DEMAND during implementation:**
  - taste-skill Section 4 (color, layout, typography rules): :185-350 → read when choosing palette/fonts
  - taste-skill Section 5 (animation skeletons GSAP): :352-470 → read when building scroll animations
  - taste-skill Section 9 (AI Tells): :595-800 → read during review
  - taste-skill Section 14 (pre-flight): :910-980 → read during review
  - ui-ux-pro-max SKILL.md: skip entirely. CSVs have the data; the SKILL.md is 659 lines of reference.


**IMPORTANT:** Do NOT read the full taste-skill (1207 lines) upfront. Read sections on-demand.
The 3-dial table + design read = ~40 lines total to start. Everything else is pulled when needed.
### Step 3: Search Design MCPs + Reference Sources

First, discover tools:
  → search_tool_bm25("ui-layouts 21st-dev")  // designmd is optional (needs API key)
  → search_tool_bm25("chrome-devtools")       // for Step 7 review

**designmd MCP — OPTIONAL (requires API key from https://designmd.ai/api-keys):**
  If available: search_design_systems, download_design_system for layout/component references.
  If NOT available (no key, MCP fails silently): skip. Fallback: `read` brand DESIGN.md from
  https://github.com/voltagent/awesome-design-md/tree/main/design-md (73+ real brand analyses).
  Colors/fonts from designmd are NEVER authoritative — ui-ux-pro-max CSVs always win.

**@ui-layouts/mcp — Real React/TSX Source Code (use SHORT queries!):**
  - search_components with SHORT 1-2 word queries: "hero", "bento", "pricing", "faq", "features", "glass", "scroll"
  - NEVER use long queries like "hero section feature bento grid cards" → returns 0 results
  - If short query fails, try even shorter or browse the component list
  - get_component_source_code — REAL .tsx, prefer over writing from scratch
  → 60+ components + 100+ blocks (hero-section, feature, about, pricing, FAQ, CTA…)

**21st-dev-magic — Component Patterns + Logos:**
  - 21st_magic_component_inspiration — SHORT queries: "hero animation", "bento grid", "scroll reveal"
  - logo_search — SVG logos (NOT 21st_magic_logo_search)
  - 21st_magic_component_refiner — polish components after they exist
  - NEVER 21st_magic_component_builder (always times out)

**chrome-devtools — Review only (Step 7).** Not for implementation.

**motion.dev — Animation Examples:**
  - Read specific example URLs, not the index: https://examples.motion.dev/react/<pattern-name>
  - Useful patterns: scroll-velocity-linked-offset, typewriter, ios-app-folder, floating-action-button, skeleton-shimmer
  - Note exact URLs in the plan for subagents to reference


**Fallback if MCP servers fail or are unavailable:**
  - designmd MCP down/403? Skip it. Use `read` on https://github.com/voltagent/awesome-design-md for brand DESIGN.md references.
  - ui-layouts MCP unavailable? Fall back to 21st-dev-magic + hand-crafted components.
  - 21st-dev MCP unavailable? Skip pattern search, use ui-layouts or design from scratch.
  - chrome-devtools unavailable? Skip headless browsing, verify via build + manual review.
  - Never block on a single MCP. One missing server is not a blocker.

### Step 4: Create Design Plan FROM Skills
Before any code, write a plan to `local://<project-name>-plan.md`:
  - Set DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY dials FROM taste-skill
  - Choose color palette FROM ui-ux-pro-max CSV data (`src/ui-ux-pro-max/data/design.csv` or `draft.csv`)
  - Choose font pairing FROM ui-ux-pro-max `typography.csv`
  - Set animation patterns (easing, durations, spring physics) FROM animate skill
  - Write EXACT tokens: hex colors, font names, spacing values, animation params
  - IGNORE any colors/fonts in user briefs or existing plans. Only ui-ux-pro-max data is authoritative.
  - Choose color palette FROM ui-ux-pro-max CSV data (from ~/.omp/agent/managed-skills/ui-ux-pro-max-skill/src/ui-ux-pro-max/data/design.csv or draft.csv or colors.csv)

### Step 5: Present Plan to User
Show exact palette + tokens + dial values. Get approval via `resolve` tool.
Keep `resolve` in the same turn — do NOT yield or wait for a new conversation.

### Step 6: Implement
Build all components following the approved plan.

**Visual assets — AI decides what's needed (follow taste-skill Section 4.8):**
- `generate_image` for key visuals (hero photography, product shots, texture backgrounds).
  Ideal for unique, themed assets. Not for everything — 1-3 images across the whole page.
- `logo_search` for SVG logos / brand marks (21st.dev).
- `21st_magic_component_refiner` to polish components after they're built.
- External images (picsum.photos / Unsplash) only when generation isn't needed or practical.
- **Verify external URLs before embedding**: `curl -sI <url> | grep "HTTP/2 200\|HTTP/1.1 200"`. Dead images = broken design. Replace 404s.
- Custom SVGs from `@tabler/icons-react` or similar for icons.
- **Animation code: check motion.dev examples first** (https://examples.motion.dev/react).
  400+ copy-paste patterns. Reference exact example URLs in subagent contexts.
  Prefer motion/react v12 (prev. Framer Motion) — smaller API, hardware-accelerated.

**When using subagents (recommended for parallel work):**
  - Subagents have NO skills and NO PROMPT_INJECT. They only know what you pass them.
  - Subagents cannot `npm install`. If they need a package, INSTALL IT YOURSELF first before spawning them.
### Step 7: Review

**1 — Build test:**
- Run `npm run build` directly (TypeScript is checked as part of build — no separate `tsc`)
- ❌ Build fails → fix, rebuild, repeat (not counted as a review cycle)

**2 — Dev server + Browser:**
- Start dev server. Wait for `http://localhost:3000`.
- Use `chrome-devtools` MCP (headless): navigate, screenshot (1280px + 375px), console, a11y snapshot
- ❌ Console error → fix. ⚠️ warnings → report.
- ❌ Missing `<h1>` or empty `main` → fix.

**3 — Quality gates (batch in ONE call):**
- `grep -rn '—\|#667eea\|#764ba2\|#1a1a2e\|#16213e\|#f0f0ff' src/` → ❌ any hit → fix
- `npx -y impeccable detect src/` — skip if unavailable
- Copy Audit: em-dashes, AI filler words, fake precision numbers

**4 — Pre-Flight Checklist:**
- Run taste-skill Section 14 (50+ item matrix). NOT optional.
- Batch the checks — one bash call with multiple greps + counts, not 30 individual searches.

**5 — Auto-fix loop:**
- Max 3 review cycles. After 3, report remaining issues.
- Build/dev-server failure: fix root error, restart from cycle 1 — doesn't count as a cycle.

**Report format:**
```
=== REVIEW {N}/3 ===
BUILD: ✅ | ❌ ...
CONSOLE: ✅ | ⚠️ N warn | ❌ N err
A11Y: ✅ | ⚠️ ... | ❌ ...
COLORS: ✅ | ❌ slop hexes found
PRE-FLIGHT: ✅ | ❌ N items failed
ISSUES FIXED: N | REMAINING: N
```
### Step 8: Present Results
Zeige Screenshots, Report, Fixes. Was wurde geändert + vorher/nachher.

## Rules
- **Search first, then generate.** Never create a component without checking 21st.dev first.
- **One design direction per project.** Don't mix vibes.
- **Spacing is sacred.** Stick to the 4px grid.
- **Return:** what you changed + before/after description.
- **Audit your own output:** Before declaring done, re-read every visible string on the page. Flag AI-sounding copy, broken grammar, fake-precise numbers.
