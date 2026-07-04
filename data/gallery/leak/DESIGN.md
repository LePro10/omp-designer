# DESIGN.md — Leak Furniture

## Direction
Reading this as: a warm editorial brand landing for design-conscious buyers,
handcraft/warm language, signature moment: kinetic-type hero with a figurative
CSS/SVG furniture silhouette.

One thing a visitor will remember: the word "LEAK" that trembles and drips on
cursor move, paired with a chair that exists only as line — because the piece you
commission doesn't exist yet either.

## Ambition dials
- VARIANCE: 7 — staggered grids, offset hero split, asymmetric process rows
- MOTION: 6 — kinetic type hero, entrance stagger, scroll reveal, hover-lift cards
- DENSITY: 4 — airy with moments of detail (grain texture, annotated process)

## Color
Source: custom from workshop material palette
- Background: #F7F3EE (warm off-white, like unbleached linen)
- Surface: #EDE7DF (slightly deeper warm tone)
- Surface-hover: #E3DAD0
- Primary text: #2C1810 (near-black walnut)
- Secondary text: #7D6E62 (warm grey-brown)
- Accent: #C85A3E (burnt terracotta — clay, rust, oxidized metal)
- Accent-hover: #B04A32
- Border: #D6CCC2
- Light accent / grain: #EADDD3

## Type
Source: Google Fonts (free, self-hosted via @import)
- Display: "Playfair Display", serif — 800 weight for the hero, italic for
  signature moments
- Body: "Inter", sans-serif — 300/400/500 weights
- Mono: "JetBrains Mono", monospace — for process steps and small labels

Scale:
- Hero display: clamp(3.5rem, 10vw, 8rem) / 0.95 leading / -0.02em tracking
- Heading h2: clamp(2rem, 4vw, 3rem) / 1.1 leading
- Heading h3: 1.5rem / 1.2 leading
- Body: 1rem / 1.6 leading, max 65ch
- Small / label: 0.8125rem / 1.3 leading, uppercase letter-spaced

## Geometry
- Container: min(100% - 3rem, 1200px) centered
- Grid: 12-column at 1280px, collapses fluidly
- Spacing: 0.25rem step (0.25, 0.5, 1, 1.5, 2, 3, 4, 6rem)
- Radius: 0 (buttons/pills), 4px (cards), 8px (containers)
- Borders: 1px solid on card-style containers
- Elevation: card hover uses box-shadow 0 8px 24px -8px rgba(44,24,16,0.12)
- Section padding: 6rem 0 (reduced to 4rem at narrow)

## Composition
1. **Hero** — split layout: kinetic display type left, CSS chair silhouette right.
   The "leak" drips on mouse. Full viewport with grain overlay.
2. **Full-bleed statement** — one sentence in large serif italic, centered
   breathing room. "The cracks are where the character gets in."
3. **Collection** — horizontal scroll-snap rail of three piece cards with
   material, dimensions, and finish. Each card has a small SVG detail drawing.
4. **Process** — four-step timeline connected by a vertical rule. Number + title
   + body, alternating left/right at wide widths, stacked at narrow.
5. **Studio** — contact info split with a material texture block on the right.
   Simple email and location. Studio visit callout.

## Motion
- Entrance: staggered hero elements (label→headline→body→chair) 100ms apart,
  400ms cubic-bezier
- Kinetic type: per-letter shift on pointermove (±3px, ±1.5deg, 150ms)
- Scroll reveal: sections fade up with IntersectionObserver, 10% root margin
- Card hover: lift 6px with shadow deepening, 200ms
- Link underline: slide from left, 150ms
- Reduced motion: skip all transforms/fades, static layout

## Responsive
- 1280px: as designed, 12-col grid
- 768px: hero stacks (type above chair), reduced display size
- 375px: full-width single column, process stacks vertically without alternation,
  horizontal rail is touch-scrollable
