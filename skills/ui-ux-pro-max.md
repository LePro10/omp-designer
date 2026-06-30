# ui-ux-pro-max (Design Intelligence Database)

**File:** `~/.omp/agent/managed-skills/ui-ux-pro-max-skill/SKILL.md`
**Name:** `ui-ux-pro-max`
**Size:** 45 KB SKILL.md + 1.9 MB data
**Source:** `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill`

## Purpose

Massive design reference database. Provides color palettes, font pairings,
UI styles, UX guidelines, and chart types.

## Key Data

### Colors: `src/ui-ux-pro-max/data/colors.csv`
- 162 product-type palette rows with explicit tokens:
  Primary, On Primary, Secondary, On Secondary, Accent, On Accent,
  Background, Foreground, Card, Card Foreground, Muted, Muted Foreground,
  Border, Destructive, On Destructive, Ring.
- This is the primary palette source for production work.
- `design.csv`, `draft.csv`, `landing.csv`, and `products.csv` contain broader style/system references. Use them for inspiration after locking palette tokens from `colors.csv`.

### Fonts: `src/ui-ux-pro-max/data/typography.csv`
- 57 font pairings
- Heading + body combinations
- Always select by row number and exact font family names.
- Examples: Space Grotesk + DM Sans, Inter + Roboto

### UI Styles: `src/ui-ux-pro-max/data/styles.csv`
- 67 style definitions

### UX Guidelines: `src/ui-ux-pro-max/data/ux-guidelines.csv`
- 99 rules with priority levels:
  - Accessibility: critical
  - Touch: critical
  - Performance: high
  - Motion: medium
  - Anti-patterns: medium

### Other Data
- Products CSV, Charts CSV, App interfaces CSV, etc.
- Per-stack files: React, Next.js, Vue, Svelte, Flutter, SwiftUI, etc.

## KNOWN PROBLEM: CSVs Not Read

The agent reads the SKILL.md but almost NEVER reads the CSV data files
containing the actual palettes and font pairings. The PROMPT_INJECT says
"READ the csv files in its src/ui-ux-pro-max/data/ directory" — but this
is ignored ~90% of the time.

**Workaround:** The designer-master skill now inlines the correct paths
and explicitly lists which CSVs to read.
