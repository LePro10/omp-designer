---
name: design-md
description: "Create a compact visual-system contract for new pages and major redesigns."
---

# Visual System

Use this skill for a new page, a major redesign, or work that introduces a new
visual language. Skip it for small edits inside an established system.

During a user-requested plan/approval turn, propose the visual direction without
writing DESIGN.md. Create the file after approval and before implementation.
Exact tokens are provisional until checked. Do not attribute a palette or type
choice to a CSV row unless the complete row was actually read, and do not claim
contrast compliance until the intended foreground/background pair was measured.

## DESIGN.md contract

Keep DESIGN.md short enough to use while building:

```markdown
# DESIGN.md

## Direction
One project-specific art-direction sentence.

## Color
Source: existing brand | user | colors.csv row N | custom rationale
- background / foreground
- surface / surface foreground
- primary / primary foreground
- accent / accent foreground
- muted / muted foreground
- border / focus / destructive

## Type
Source: existing brand | typography.csv row N | custom rationale
- display, heading, body, label, mono roles
- responsive sizes, weights, line heights, maximum measure

## Geometry
- container and grid
- spacing scale
- radius and border rules
- elevation rules

## Components
Rules that are specific to this product.

## Composition
- section sequence and visual emphasis
- where repeated containers are justified by content
- which product-specific view or interaction carries the page

## Motion
Only when motion exists: purpose, durations, easing, reduced-motion fallback.

## Responsive behavior
What recomposes at content-driven breakpoints.
```

## Palette selection

The CSV database is a search index, not an authority.

1. Preserve supplied or existing brand colors.
2. Otherwise search `data/ui-ux-pro-max/colors.csv` for relevant rows.
3. Read the complete candidate row and identify its exact row number.
4. Check foreground/background pairs at their intended text sizes.
5. Correct inaccessible pairs and document the correction.
6. Use only the semantic roles the interface needs. A destructive token does not
   need to appear visually when the product has no destructive action.

Do not validate a color merely because it appears somewhere in the 161-row file.

## Typography selection

1. Preserve existing brand type when supplied.
2. Otherwise search `data/ui-ux-pro-max/typography.csv` by mood and reading need.
3. Confirm the font exists, is licensable for the project, and supports required
   scripts and weights.
4. Prefer system fonts when performance, platform consistency, or privacy matters.
5. Do not ban a font only because it is popular; reject it when it fails the
   project's voice or reading conditions.

## Accessibility baseline

- WCAG 2.2 AA contrast for normal text and controls.
- Visible focus on every keyboard-reachable control.
- Minimum 44 by 44 CSS pixel touch targets where practical.
- Logical headings, landmarks, labels, names, and error messages.
- Content remains usable at 200 percent zoom and narrow widths.
- Motion is never required to understand content or complete a task.

## Implementation

Prefer semantic CSS variables consumed by components. Avoid isolated hex values,
spacing values, radii, and shadows that bypass the contract. Existing projects may
use Tailwind, CSS modules, design-system packages, or native CSS; follow their
established mechanism rather than forcing a new one.

Do not make every content group a floating rounded card. Container treatment must
communicate grouping, hierarchy, interaction, or state. Plain typography,
dividers, tables, diagrams, and continuous canvases are valid structures.

Text placed over photography or gradients needs a guaranteed contrast
mechanism — a scrim, a solid panel, or a measured safe region of the image.
Never position copy over an uncontrolled image area and hope. Check the
narrow viewport too: text and imagery that coexist at 1280px collide at 375px.
