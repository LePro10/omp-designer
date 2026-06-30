---
name: design-review
description: "Post-implementation quality check. AI-SLOP.md is the canonical anti-slop reference. Max 3 fix cycles."
---

# Design Review

Execute after implementation. Run these checks, fix critical issues, loop max 3x.

**Canonical reference: ai-slop/SKILL.md (AI-SLOP.md)**. This skill implements its review pipeline. When in doubt, consult AI-SLOP.md directly.

---

## 1 — Build test
- Read `package.json` scripts. Run the build command (`npm run build`, `yarn build`, etc.).
- ❌ Build fails -> fix, rebuild, repeat (not counted as a review cycle)

## 2 — Dev server + browser
- Start dev server. Wait for it to be ready.
- Use chrome-devtools MCP or browser:
  - Navigate to the URL.
  - Scroll from top to bottom and back to top once before any full-page screenshot. This triggers `whileInView` reveal sections.
  - Take desktop screenshot (1280px wide).
  - Take mobile screenshot (375px wide).
  - Take section viewport screenshots for: hero, first content section, gallery/features, conversion section, footer.
  - List console messages and fix errors.
  - Take accessibility/snapshot output and check headings, landmarks, aria.

## 3 — Quality gates

### 3A — Console and accessibility
- Console: ❌ any error -> fix. warnings -> report.
- A11y: ❌ missing `<h1>` or empty `main` -> fix.
- A11y: ❌ keyboard traps, missing focus, insufficient contrast, missing accessible names -> fix. (AI-SLOP.md 6.11)
- A11y: ⚠️ missing landmarks, aria-labels -> report.

### 3B — Deterministic source scan
Run from the generated project root:
```
node ~/.omp/agent/extensions/designer/fix-ai-slop.mjs .
node ~/.omp/agent/extensions/designer/analyze-layout.mjs .
```
- ❌ any blocking issue -> fix and rerun.
- These catch: em-dashes, buzzwords, fake numbers, unsourced prices/shipping/returns claims, overused fonts, stock-photo hotlinks, real-company social proof, AI-slop colors, off-palette colors, weak layout variety, risky horizontal scroll, unsupported EVIDENCE.md claims.

### 3C — Anti-slop detector (optional but recommended)
- Run: `npx -y impeccable detect src/`
- ❌ any rule fails -> fix before proceeding.
- If unavailable: skip with note. Do not skip the local quality scripts.

### 3D — Animation quality
Check that animations are real, not decorative (AI-SLOP.md 6.10):
- ✅ Uses `motion/react` or CSS transitions with proper easing
- ❌ `transition: all 0.3s` everywhere -> use specific properties + proper easing
- ❌ Bounce/elastic easing on everything -> use `ease-out` for entrances, `ease-in` for exits
- ❌ Infinite loops on non-marquee elements -> add limit or remove
- ❌ Every element fades and rises on scroll -> vary animation by section purpose
- ❌ Hover effects on non-interactive objects -> remove
- ⚠️ No scroll-triggered animations -> report
- ✅ Respects `prefers-reduced-motion`

### 3E — Copy audit
The local quality script is authoritative. It blocks on:
- Em-dashes in prose
- Banned buzzwords
- Fake-precision numbers
- Real company names as social proof
- Common AI patterns ("Not just X, but Y", "Whether you're X or Y")
- Unsupported EVIDENCE.md claims

---

## 4 — Substitution and rationale tests (from AI-SLOP.md)

### 4A — Substitution test (AI-SLOP.md Section 4)
Ask: Could the product name, logo, and accent color be replaced, while 80% of the page remains equally plausible for another product?
- **Yes** -> strong slop risk. Rewrite the generic parts.
- **Partly** -> inspect specificity, information architecture, imagery, copy, and interaction model.
- **No** -> the design is likely meaningfully tied to the product.

### 4B — Rationale test (AI-SLOP.md Section 5)
Every prominent section MUST answer at least one of:
- What user need does this serve?
- What product truth does this express?
- What information hierarchy does this clarify?
- What brand characteristic does this embody?

If the only answer is "it looks modern" or "landing pages usually do this" -> rewrite.

### 4C — Anti-overcorrection check (AI-SLOP.md Section 14)
The system MUST NOT turn "anti-slop" into another recognizable house style.

Check two levels:
1. **First-order reflex:** Could someone guess the palette, typography, hero, and components from the category alone? (e.g., AI tool -> dark background, purple/cyan glow, glass cards)
2. **Second-order reflex:** After banning the obvious category cliche, did the agent simply move to the next fashionable alternative? (e.g., "not that" -> cream background, rusty orange, huge italic serif, ticker bar)

A project fails when its direction is selected by stereotype rather than a project-specific concept.

---

## 5 — Dimension-based evaluation (from AI-SLOP.md Section 6)

Evaluate each dimension from 0-4:

| Score | Meaning |
|-------|---------|
| 0 | Excellent: specific, coherent, intentional, verified |
| 1 | Minor concern: isolated issue, does not shape the result |
| 2 | Noticeable: repeated or user-visible weakness |
| 3 | Serious: strongly generic, misleading, incoherent, or defective |
| 4 | Blocking: dishonest, inaccessible, broken, or dominated by reflexive output |

**Dimensions to evaluate:**

| Dimension | Core question |
|-----------|--------------|
| Product grounding | Could this design be used for a different product with minimal change? |
| Truthfulness | Are claims and product details supported by evidence? |
| Specificity | Are there concrete, project-specific decisions? |
| Narrative | Does each section have an information purpose? |
| Composition | Is there hierarchy, rhythm, and intentional variation? |
| System coherence | Do colors, typography, spacing, and components follow one system? |
| Copy | Is the text concrete, credible, and audience-appropriate? |
| Imagery | Do images and illustrations support product and brand? |
| Motion | Does animation explain change or is it just effect? |
| Accessibility | Is the result actually usable? |
| Responsiveness | Is the layout recomposed or merely stacked? |
| Functional completeness | Does everything that looks functional actually work? |
| Distinctiveness | Did the direction come from the project or from a model reflex? |

**Calculate two separate results:**

**Shipping readiness:** Pass/fail based on blocking defects, functional tasks, accessibility target, and evidence. A visually distinctive page can still fail shipping readiness.

**Slop risk:** Count dimensions scoring 3+. Interpretation:
- 0 dimensions at 3+: low slop risk
- 1-2 dimensions at 3+: minor concerns
- 3-4 dimensions at 3+: noticeable genericity
- 5+ dimensions at 3+: major slop characteristics

Do not collapse shipping readiness and slop risk into one number.

---

## 6 — Auto-fix
- Critical issues (build fail, console error, missing h1, blocking a11y): fix immediately, restart review.
- Animation: fix easing, remove infinite loops, add reduced-motion.
- Copy: replace em-dashes, remove filler, remove invented stats.
- Substitution test failure: rewrite generic sections to be product-specific.
- Anti-overcorrection failure: justify direction from project concept, not anti-default reflex.
- Max 3 review cycles. After 3, report remaining.

---

## 7 — Report format
```
=== REVIEW {N}/3 ===
BUILD: pass | fail ...
CONSOLE: clean | N warnings | N errors
A11Y: pass | issues ...
DETERMINISTIC SCAN: pass | N blocking issues
SUBSTITUTION TEST: pass | partly | fail
RATIONALE TEST: pass | N sections lack justification
ANTI-OVERCORRECTION: pass | first-order reflex | second-order reflex
SHIPPING READINESS: pass | fail (list blockers)
SLOP RISK: low (0) | minor (1-2) | noticeable (3-4) | major (5+)
DIMENSIONS AT 3+: [list]
ISSUES FIXED: N
REMAINING: N
```
