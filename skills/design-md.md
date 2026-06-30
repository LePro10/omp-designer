---
name: design-md
description: "Generate and maintain a DESIGN.md — the complete visual system specification. Every component implements this spec, not the agent's defaults."
---

# DESIGN.md — Visual System Specification

After choosing a palette and typography, write a `DESIGN.md` to `local://DESIGN.md`. This is the authoritative visual system. Every component implements it.

## When to write

- **Step 4 (Plan)** — after choosing palette, fonts, and dial values
- **Update** if the design direction changes

## What to include

```markdown
# DESIGN.md — Visual System

## Brand
- Name: [product name]
- Voice: [3 adjectives from PRODUCT.md]
- Anti-patterns: [what to avoid]

## Color System
Source row: [colors.csv row number + product type]
[Exact hex values from the chosen palette row]
- Primary: #hex — [usage: buttons, links, active states]
- On Primary: #hex
- Secondary: #hex — [usage: secondary buttons, badges]
- On Secondary: #hex
- Accent: #hex — [usage: CTAs, highlights, one per page]
- On Accent: #hex
- Background: #hex — [page background]
- Foreground: #hex — [body text]
- Card: #hex — [card surfaces]
- Card Foreground: #hex — [card text]
- Muted: #hex — [subtle backgrounds, dividers]
- Muted Foreground: #hex — [secondary text, captions]
- Border: #hex — [borders, dividers]
- Destructive: #hex — [errors, delete actions]
- On Destructive: #hex
- Ring: #hex — [focus rings]

Dark mode:
- Source: [same palette row or documented derivation]
- Background: #hex
- Foreground: #hex
- Card: #hex
- Card Foreground: #hex
- Muted: #hex
- Muted Foreground: #hex
- Border: #hex
- Primary/Secondary/Accent/Ring: [same as row unless explicitly documented]
## Typography
Source row: [typography.csv row number + pairing name]
- Heading Font: [exact CSV heading font]
- Body Font: [exact CSV body font]
- Display: [font name] [weight] [size] [tracking] [leading]
- H1: [font name] [weight] [size] [tracking] [leading]
- H2: [font name] [weight] [size] [tracking] [leading]
- H3: [font name] [weight] [size] [tracking] [leading]
- Body: [font name] [weight] [size] [tracking] [leading]
- Small/Caption: [font name] [weight] [size] [tracking] [leading]
- Mono/Code: [font name] [weight] [size] [tracking] [leading]

Type scale ratio: [e.g., 1.25 — each step is 1.25x the previous]
Max line length: [e.g., 65ch for body text]

## Spacing
Base unit: 4px
Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128

Section padding: [e.g., py-20 md:py-28]
Component gap: [e.g., gap-6]
Content max-width: [e.g., max-w-7xl]

## Grid
Columns: [e.g., 12-column grid]
Breakpoints: sm 640, md 768, lg 1024, xl 1280, 2xl 1536
Container: [e.g., max-w-[1400px] mx-auto px-6]

## Radius
- Cards: [e.g., rounded-2xl (16px)]
- Buttons: [e.g., rounded-lg (8px)]
- Inputs: [e.g., rounded-lg (8px)]
- Tags/Badges: [e.g., rounded-full]
- [One consistent scale — no mixing]

## Elevation
- Level 0: [no shadow — flat surfaces]
- Level 1: [subtle — cards, dropdowns]
- Level 2: [medium — modals, popovers]
- Level 3: [high — tooltips, toasts]
[Shadow values with tinted shadows matching background hue]

## Motion
- Entrance: [duration 240-320ms] [easing] [property: opacity/transform] [distance]
- Exit: [duration 160-220ms] [easing] [property]
- Hover: [duration 140-200ms] [easing] [property]
- Active/Press: [duration 80-120ms] [easing] [scale]
- Stagger: [60-90ms between children]
- Counters: [900-1200ms, final value visible]
- Scroll-triggered: [whileInView/useScroll, viewport once, margin]
- Pinned/horizontal: [desktop behavior + mobile stacked/snap fallback]
- Reduced motion: [exact fallback behavior]

## Component Patterns
[How specific component types should look]
- Hero: [layout approach — split, centered, asymmetric]
- Feature cards: [layout — grid, bento, horizontal scroll]
- Pricing: [layout — cards, comparison table, toggle]
- Testimonials: [layout — carousel, grid, single quote]
- CTA: [layout — full-width, inline, floating]
- Footer: [layout — columns, minimal, comprehensive]

## Image Style
- Photography: [style — editorial, product-focused, lifestyle]
- Treatment: [e.g., rounded corners, no border, subtle shadow]
- Aspect ratios: [hero: 16:9, product: 4:3, avatar: 1:1]
- Generation prompts: [base prompt template for consistent style]

## Accessibility
- Color contrast: WCAG AA minimum (4.5:1 body, 3:1 large text)
- Focus indicators: visible on all interactive elements
- Touch targets: minimum 44x44px
- Semantic HTML: proper heading hierarchy, landmarks, alt text
- Reduced motion: all animations respect prefers-reduced-motion
```

## Rules

- **Every value is exact.** No "about 16px" — it's `16px` or `rounded-lg`.
- **One palette row.** All colors come from the chosen CSV row. No additions.
- **One radius scale.** Pick one and use it everywhere. No mixing.
- **One type scale.** Mathematical progression, not random sizes.
- **Reference PRODUCT.md.** Brand voice and anti-patterns come from the brief.

## Technical Notes

### Tailwind CSS v4
- Do NOT use `@utility` with nested media queries — Tailwind v4 doesn't support nesting inside `@utility` definitions.
- Use `@layer utilities` for custom utilities instead of `@utility` when you need media queries.
- For responsive custom properties, use CSS `@media` queries in `@layer base` or `@layer components`, not inside utilities.
- Tailwind v4 uses `@import "tailwindcss"` instead of `@tailwind base/components/utilities`.
- Dark mode: use `.dark` class on `<html>` with CSS variables, not Tailwind's `dark:` prefix for complex theming.

### Motion Library (motion/react)
- Import: `import { motion } from "motion/react"` (NOT framer-motion)
- Ease arrays must be typed as tuples: `as [number, number, number, number]` or use `as const`
- For scroll-linked animations, use `useScroll` + `useTransform` from `motion/react`
- `AnimatePresence` is in `motion/react`, not a separate import
- Package: `npm install motion` (NOT framer-motion)

### Image Generation
- Use `generate_image` tool for 1-3 key visuals (hero, product, atmosphere)
- Prompt format: describe the scene, style, lighting, and composition
- Always verify generated images render correctly before shipping
- Fallback: `https://picsum.photos/seed/{descriptive-seed}/{w}/{h}` for placeholders

## Why this matters

Without DESIGN.md, the agent invents a new design system for every component. The hero has one radius, the cards have another, the buttons have a third. DESIGN.md is the single source of truth that makes the output consistent and intentional.
