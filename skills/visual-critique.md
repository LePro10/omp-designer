---
name: visual-critique
description: "Take screenshots and critique the design visually. Compare to references. Fix targeted issues, don't regenerate."
---

# Visual Critique — See What You Built

After building, take a screenshot and evaluate the design visually. This is the feedback loop that separates "builds pages" from "designs pages."

## When to critique

- **Step 7 (Review)** — after build passes, before presenting to user
- After each fix cycle — screenshot again to verify the fix worked

## How to critique

### 1. Take screenshots
- Desktop: 1280px wide, full page
- Mobile: 375px wide, full page
- Tablet: 768px wide (if time permits)
- If chrome-devtools is available, use it. Otherwise, use the browser tool.

**Reveal-trigger protocol (mandatory):**
Before taking any full-page screenshot, scroll from top to bottom and back to top once. This triggers `whileInView` / scroll-reveal sections. A full-page screenshot taken at initial page load can show blank offscreen sections because reveal animations have not entered the viewport yet.


Also take section viewport screenshots after scrolling each major section into view. Required sections: hero, first content section, gallery/features, conversion section, footer. Full-page screenshots can miss reveal failures; section screenshots prove the content actually appears.

If sections are still blank after the reveal-trigger scroll:
- Check whether content starts at `opacity: 0` without a reachable viewport trigger.
- Fix the animation so content is visible under reduced motion and after one scroll pass.
- Then retake screenshots.

### 2. Evaluate — Technical criteria (desktop)
Check these objectively:

| Criterion | How to check | Pass |
|---|---|---|
| No horizontal overflow | Scroll horizontally on desktop — should not scroll | No horizontal scroll |
| Text readable | All body text ≥ 16px, all labels ≥ 12px | No text below 12px |
| Touch targets | All buttons/links ≥ 44x44px | All targets ≥ 44px |
| Contrast | Text passes WCAG AA against background | 4.5:1 body, 3:1 large |
| Focus visible | Tab through the page — every interactive element shows focus ring | All focusable elements visible |
| Images load | No broken images, no 404s | All images render |
| No overflow | No text clipped, no elements bleeding out of containers | No clipping |
| Heading hierarchy | One h1, logical h2→h3→h4 progression | Proper nesting |


### 2.5 Evaluate — Palette and typography audit

Check built code against DESIGN.md:

| Criterion | How to check | Pass |
|---|---|---|
| Palette fidelity | Extract hex values from `src/` and compare with DESIGN.md | No off-palette visible colors |
| Typography source | Confirm fonts match DESIGN.md typography row | Exact heading/body fonts used |
| Dark mode tokens | Confirm dark values are documented in DESIGN.md | No improvised per-component dark hexes |
| Accent discipline | Count accent usage | One accent role, not many competing highlights |

Any off-palette color is a fail unless it is inside an imported/generated image asset.

### 2.6 Evaluate — Image source audit

| Criterion | How to check | Pass |
|---|---|---|
| Hero visual | Inspect hero section | Real generated image, component preview, or approved placeholder |
| Stock-photo hotlinks | Search `src/` for Unsplash, Pexels, Pixabay, random CDN photo URLs | No hits unless user provided the URL |
| Alt text | Inspect image attributes | Meaningful alt or empty alt for decorative images |

Unsplash/Pexels hotlinks are a fail. They make output feel generic and can break later.

### 3. Evaluate — Mobile QA (375px)
These are the most common failure points on mobile:

| Criterion | How to check | Pass |
|---|---|---|
| Text size | Body ≥ 16px, labels ≥ 12px at 375px | No tiny text |
| Touch targets | All buttons/links ≥ 44x44px at 375px | Easy to tap with thumb |
| Hamburger nav | Nav collapses to hamburger on mobile | Opens/closes correctly |
| Stacking | Multi-column layouts stack vertically | No side-by-side on narrow screens |
| Images | Images scale properly, no horizontal overflow | Contained within viewport |
| Forms | Inputs are full-width, labels visible, keyboard doesn't cover input | Usable on mobile |
| Hero fit | Hero content fits in one viewport on mobile | No scroll to find CTA |
| Card text | Card text doesn't overflow or get clipped | Readable on mobile |

### 4. Evaluate — Visual criteria
These require judgment:

**Hierarchy:**
- What's the first thing your eye goes to? Is it the right thing?
- Is there a clear visual hierarchy? (headline → subtext → body → caption)
- Or is everything the same weight? (flat hierarchy = AI tell)

**Spacing:**
- Is spacing consistent? (same gap between similar elements)
- Is there breathing room? Or is everything cramped?
- Does the spacing feel intentional? Or random?

**Composition:**
- Does each section have ONE dominant idea?
- Or is each section trying to do 5 things at once?
- Is there visual variety between sections? Or do they all look the same?

**Brand fit:**
- Does this feel like it belongs to the product in PRODUCT.md?
- Or does it feel like a generic template with the product name swapped?
- Would the target audience from PRODUCT.md trust this site?

**Originality:**
- Does this look like every other AI-generated site?
- Or does it have a distinct visual identity?
- Compare to the reference sites — is it inspired by them or a copy of them?

**Copy quality:**
- Read every visible string. Does it sound human?
- Or does it sound like marketing fluff?
- Are there em-dashes, buzzwords, fake numbers?


### 4.5 Evaluate — Animation audit

Compare animation code against DESIGN.md and animate/SKILL.md:

| Criterion | How to check | Pass |
|---|---|---|
| Duration | Entrances 240-320ms, exits 160-220ms, hover 140-200ms | No sluggish or twitchy motion |
| Easing | Specific easing curve, not generic `transition: all` | Motion feels intentional |
| Properties | Transform/opacity preferred | No layout thrash |
| Scroll reveal | `once: true` unless repeat is intentional | No noisy re-triggering |
| Reduced motion | `useReducedMotion` or CSS media query | Big motion disables/simplifies |
| Mobile scroll | Horizontal/pinned desktop patterns have mobile fallback | No trapped/touch-hostile scroll |

### 4.6 Risk verification

For every risk listed in PLAN.md:
- Verify mitigation exists in code, or
- Implement it before shipping, or
- Report it as an unresolved risk.

### 5. Structure each critique point
For every issue found:

```
ISSUE: [what's wrong]
WHERE: [which component/section]
EVIDENCE: [what you observed in the screenshot]
SEVERITY: [critical / major / minor]
FIX: [smallest change that resolves it]
```

### 6. Fix targeted — never regenerate
- Only change the affected component. Don't rebuild the whole page.
- Make the smallest possible change that fixes the issue.
- After fixing, take another screenshot to verify.

### 7. Iterate — max 3 rounds
- Round 1: Fix critical issues (broken layout, unreadable text, missing content)
- Round 2: Fix major issues (poor hierarchy, inconsistent spacing, weak copy)
- Round 3: Fix minor issues (alignment, micro-interactions, polish)
- After 3 rounds, ship. Perfection is the enemy of shipped.

## Rules

- **Always screenshot before critiquing.** Don't critique from memory or code inspection alone.
- **Check mobile separately.** Don't assume desktop layout works on mobile. Screenshot at 375px and verify.
- **Compare to references.** How does this look relative to the sites studied in Step 3?
- **Be specific.** "The hierarchy is off" is useless. "The feature card headings are 20px — same size as the body text below them — so there's no visual distinction between heading and content" is actionable.
- **Fix, don't redesign.** If the hero layout is wrong, fix the hero. Don't rebuild the whole page.
- **Ship at 8/10.** A shipped 8/10 is better than a perfected 10/10 that never launches.

## Why this matters

The agent can't see what it built. Without visual critique, it's flying blind — it can check for code patterns but not for visual quality. This skill closes the loop: build → see → judge → fix → verify.
