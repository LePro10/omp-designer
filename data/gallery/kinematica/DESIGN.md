# DESIGN.md — KINEMATICA

## Direction
Industrial robotics presented through workshop materials and precision-engineering details — warm off-white blueprint surface, machined-metal greys, safety-orange accents, and monospaced data displays that evoke a real robot control panel. No gradient wallpaper, no glassmorphism, no interchangeable hero.

## Color
Source: custom industrial palette (not from CSV — robotics not in the palette database)
- Background: #f0ede8 (warm workshop paper/blueprint vellum)
- Surface: #e5e0d9 (warm light grey, machined aluminum)
- Surface foreground: #1a1a1a (near-black body text)
- Primary: #1a1a1a (industrial black)
- Primary foreground: #f0ede8
- Accent: #c94f2b (safety orange, machine-guard colour)
- Accent foreground: #ffffff
- Secondary: #3a6f8c (heat-treated steel blue)
- Secondary foreground: #ffffff
- Muted: #9b958e (warm grey)
- Muted foreground: #1a1a1a
- Border: #d4cec5 (warm line)
- Destructive: #b91c1c
- Panel bg: #1c1c1a (robot controller dark chassis)
- Panel surface: #22221f (panel header)
- Panel cell: #262622 (joint/status cell backgrounds)
- Panel fg: #d4d0c8 (panel text)
- Panel border: #3a3a36 (panel inner borders)
- Panel muted: #88847a (panel labels)
- Panel value: #b8b4a8 (panel data values)
- Status green: #5bbf5b
- Status amber: #e8a838
- Status red: #d44444
- CTA muted text: #b0aba0

## Type
Source: Google Fonts — Space Grotesk (headings), DM Sans (body), JetBrains Mono (data/code)
- Display/Hero: Space Grotesk 700, clamp(2rem, 5vw, 3.5rem), -0.02em tracking
- Heading h2: Space Grotesk 600, clamp(1.4rem, 3vw, 2rem)
- Heading h3: Space Grotesk 500, clamp(1.1rem, 2vw, 1.4rem)
- Body: DM Sans 400, 1rem/1.6, max-width 70ch
- Label/tag: DM Sans 500, 0.75rem, uppercase, 0.08em letter-spacing
- Mono data: JetBrains Mono 400, 0.875rem
- Line heights: headings 1.2, body 1.6, labels 1

## Geometry
- Container max-width: 1120px, padding: clamp(1rem, 4vw, 2rem)
- Spacing scale: 0.25rem, 0.5rem, 1rem, 1.5rem, 2rem, 3rem, 4rem, 6rem
- Border radius: 0 (intentional — flat industrial), 4px (panels only)
- Borders: 1px solid var(--border)
- No box-shadows on cards — use thin border + light background shift

## Components
- Robot Status Panel: dark (#1c1c1a) rectangular panel with green-amber-red indicator grid, monospaced status lines, and animated joint readouts. This is the page anchor.
- Section labels: thin uppercase label with 1px top border line (no badge/pill)

## Composition
- Hero — robot status panel left, headline + tagline right on desktop; stacked on mobile
- Philosophy — single-column editorial statement about precision manufacturing
- Specs — engineering parameter table (not card grid)
- CTA — minimal dark bar with contact copy
- No card grids. No icon grid.

## Motion
- Robot panel: joint angles cycle through small random adjustments (simulating live telemetry) via JS
- Reduced motion: panel shows static values, no animation
- No scroll reveal, no parallax, no entrance animations

## Responsive
- Single-column below 768px: hero stacks, table becomes definition list
- Font sizes fluid via clamp()
- Panel grid reduces from 3 columns to 2 to 1
