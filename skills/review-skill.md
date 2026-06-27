---
name: design-review
description: "Post-implementation quality check: build, console, a11y. Functional only — does not judge visual quality. Max 3 fix cycles."
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

## 4 — Auto-fix
- Critical issues (build fail, console error, missing h1): fix immediately, then restart review.
- Max 3 review cycles. After 3, report remaining issues.

## 5 — Report format
```
=== REVIEW {N}/3 ===
BUILD: ✅ | ❌ ...
CONSOLE: ✅ | ⚠️ N warn | ❌ N err
A11Y: ✅ | ⚠️ ... | ❌ ...
COLORS: ✅ | ❌ slop hexes found
ISSUES FIXED: N
REMAINING: N
```
