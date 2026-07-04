# DESIGN.md — PLANE Architecture Magazine

## Direction
A newspaper front page for architecture — monumental serif typography, a strict multi-column grid, warm paper texture, and architectural restraint. The design treats the printed newspaper as its material metaphor: the paper color, ruled column guides, drop caps, and caption discipline all reference broadsheet heritage, but the scale (enormous display type, measured white space, geometric structural elements) belongs to architecture criticism.

## Color
Source: custom — derived from architectural materials (brick/terracotta, concrete, steel, paper)

- Background: #f4f1eb (warm off-white, paper)
- Foreground: #1a1814 (near-black ink)
- Surface: #ede8de (warm stone, card backgrounds)
- Surface foreground: #1a1814
- Primary: #1a1814 (inks)
- Primary foreground: #f4f1eb (reversed ink)
- Accent: #a84c3e (terracotta/brick — used for pull quotes, decorative rules, emphasis)
- Accent foreground: #f4f1eb
- Secondary: #4a5d6e (slate steel blue — captions, metadata, secondary text)
- Muted: #b5aba0 (mid-tone stone)
- Muted foreground: #4a5d6e
- Border: #d4cec4 (concrete gray)
- Focus: #a84c3e (terracotta ring)
- Selection: #a84c3e30 (terracotta tint)
- Destructive: not needed

No CSV reference needed — palette is material-derived, not from general dataset.

## Type
Source: Google Fonts (Playfair Display, Source Serif 4, Inter) — all SIL OFL

| Role | Font | Weight | Size (min/max) | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| Display / Masthead | Playfair Display | 800 (bold) | 2.5rem → 5rem | 0.9 | -0.03em |
| Heading 1 | Playfair Display | 700 | 2rem → 4rem | 1.0 | -0.02em |
| Heading 2 | Playfair Display | 700 | 1.5rem → 2.5rem | 1.1 | -0.01em |
| Heading 3 | Playfair Display | 700 | 1.25rem → 1.75rem | 1.2 | 0 |
| Body | Source Serif 4 | 400 | 1rem → 1.125rem | 1.6 | 0 |
| Body small / Caption | Source Serif 4 | 400 | 0.875rem | 1.5 | 0 |
| Meta / Labels | Inter | 400/500/600 | 0.75rem → 0.875rem | 1.3 | 0.02em caps |
| Pull quote | Playfair Display | 700 italic | 1.5rem → 2.25rem | 1.2 | 0 |

Maximum measure: 75ch for body text.
Small caps: Inter 600, 0.05em spacing, text-transform: uppercase.

## Geometry

### Grid
- 12-column grid at 1280px+ (80px columns, 24px gutters)
- 8-column at 768-1279px
- 4-column at 375-767px
- Max container width: 1280px (1200px content + 40px padding)
- Full-bleed sections extend to viewport edges

### Spacing scale
- 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96 / 128 px
- Section padding: 64px top/bottom (desktop), 40px (mobile)
- Article spacing: 32px between articles, 16px between elements

### Radius and borders
- No border-radius — editorial should feel flat and sharp
- Dividers: 1px solid #d4cec4 (concrete gray)
- Decorative rules: 4px solid #a84c3e (terracotta accent rules)

### Elevation
- No box-shadows — newspaper has no shadows
- Sticky masthead uses subtle border-bottom only

## Components

### Masthead
- Full-width, sticky top, #f4f1eb background
- Top row: date/edition left, magazine name centered, tagline right
- Bottom row: navigation links separated by thin rules
- Logo: "PLANE" in Playfair Display 800, with a geometric underscore mark

### Article cards (featured grid)
- No rounded corners, no shadow
- Thin border-bottom separator
- Category label in Inter caps with terracotta left border
- Headline in Playfair Display
- Author/date in Inter small
- Hover: subtle background shift (#ede8de)

### Lead article
- Two-column split: larger image/geometric element on left, article preview on right
- Drop cap on first paragraph (Source Serif 4, 4rem, floated)
- Standfirst in Source Serif 4 italic at 1.25rem
- Full-bleed decorative rule separating lead from grid

### In-depth feature
- CSS multi-column layout (2 columns on desktop)
- Pull quote breaks out across columns
- Drop cap on first letter
- Thin vertical rule between columns

### Reviews
- Two-column grid of review cards
- Rating system: geometric squares (filled/unfilled)
- Book title, author, reviewer in editorial style

### Footer
- Full-width, dark background (#1a1814)
- Light text, divided into columns
- Colophon with typeface credits
- Subscribe CTA link (mailto:)

## Composition

### Section sequence
1. Masthead (sticky)
2. Lead article — split layout with typographic/geometric hero
3. Featured stories — 3-column grid (front-page news)
4. In-depth feature — multi-column long-form with pull quote
5. Reviews — 2-column criticism section
6. Footer — dark, full-width, colophon + subscribe

No repeated card-grid patterns — each section has a distinct layout.

### Anchor
The lead article's hero is not a photograph but a geometric CSS/SVG elevation of an abstract high-rise (horizontal ruled lines, window grids, structural frame). This is a technical diagram of building form rendered in the page's own tokens — specific to architecture, not a generic hero image.

## Motion
Minimal:
- Hover transitions on article cards: 200ms background shift
- Hover on nav links: 200ms border-bottom color change
- Reduced motion: all transitions disabled via prefers-reduced-motion

## Responsive behavior

| Breakpoint | Layout changes |
|---|---|
| 1280px+ | 12-column grid, 2-column lead split, 3-col featured, 2-col columns text |
| 1024-1279px | 8-column grid, lead still split but narrower, 3-col featured shrinks |
| 768-1023px | 8-column, lead stacks vertically, 2-col featured, single-col in-depth |
| 375-767px | 4-column (single column content), stacked everything, smaller type |
