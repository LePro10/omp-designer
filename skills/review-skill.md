---
name: design-review
description: "Post-implementation quality check: build, console, a11y, animations, copy. Max 3 fix cycles."
---

# Design Review

Execute after implementation. Run these checks, fix critical issues, loop max 3x.

## 1 — Build test
- Read `package.json` scripts. Run the build command (`npm run build`, `yarn build`, etc.).
- ❌ Build fails → fix, rebuild, repeat (not counted as a review cycle)

## 2 — Dev server + Chrome
- Start dev server (`npm run dev` / etc.). Wait for `http://localhost:3000`.
- Use `chrome-devtools` MCP (headless, no window):
  - `mcp__navigate_page` → open the URL
  - `mcp__take_screenshot` → desktop viewport
  - `mcp__list_console_messages` → check for errors
  - `mcp__take_snapshot` → check headings, landmarks, aria

## 3 — Quality gates
- Console: ❌ any error → fix. ⚠️ warnings → report.
- A11y: ❌ missing `<h1>` or empty `main` → fix.
- A11y: ⚠️ missing landmarks, aria-labels → report.
- Colors + em-dashes: run in ONE batch call:
  `grep -rn '—\|#667eea\|#764ba2\|#1a1a2e\|#16213e\|#f0f0ff' src/` → ❌ any hit → fix.

## 3.5 — Anti-Slop Detector (optional but recommended)
- Run: `npx -y impeccable detect src/` — 44 deterministic rules, no LLM
- Catches: gradient-text, side-stripe-border, ai-color-palette, em-dashes, fake numbers
- ❌ any rule fails → fix before proceeding
- If `impeccable` is not available: skip with note. Fall back to:
  - `grep -rn '—' src/` → em-dashes → replace
  - `grep -rn 'gradient\|glow\|#667eea\|#764ba2\|#1a1a2e' src/` → slop

## 3.6 — Animation Quality (simplified)
Check that animations are real, not decorative:
- ✅ Uses `motion/react` or CSS transitions with proper easing (`ease-out-quint`, `ease-in-out-cubic`)
- ❌ `transition: all 0.3s` everywhere → use specific properties + proper easing
- ❌ Bounce/elastic easing on everything → use `ease-out` for entrances, `ease-in` for exits
- ❌ Infinite loops on non-marquee elements → add limit or remove
- ⚠️ No scroll-triggered animations → report (static pages feel lifeless)
- ✅ Respects `prefers-reduced-motion` → check for `useReducedMotion()` or CSS media query

## 3.7 — Copy Audit
Scan ALL visible text for AI tells:
- `grep -rn '—' src/` → em-dashes → replace with `, ` or `.`
- `grep -rn 'revolutionary\|cutting-edge\|seamless\|unlock\|empower\|leverage' src/` → filler → replace
- Fake-precision numbers: `grep -rn '[0-9]\+%\|[0-9]\+x\|[0-9,]\+ teams' src/` → if brief didn't provide, remove
- Real company names as social proof → replace with fictional brands or remove

## 4 — Auto-fix
- Critical issues (build fail, console error, missing h1): fix immediately, restart review.
- Animation: fix easing, remove infinite loops, add reduced-motion.
- Copy: replace em-dashes, remove filler, remove invented stats.
- Max 3 review cycles. After 3, report remaining.

## 5 — Report format
```
=== REVIEW {N}/3 ===
BUILD: ✅ | ❌ ...
CONSOLE: ✅ | ⚠️ N warn | ❌ N err
A11Y: ✅ | ⚠️ ... | ❌ ...
COLORS: ✅ | ❌ slop hexes found
ANIMATIONS: ✅ | ⚠️ ... | ❌ ...
COPY: ✅ | ❌ em-dashes/filler/fake stats
ISSUES FIXED: N
REMAINING: N
```
