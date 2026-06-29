# Known Problems & TODOs

## FIXED (this session)

### P3: CSVs almost never read ✅
**Fix:** Inlined 10 curated palette rows directly into PROMPT_INJECT.
Agent picks from the inline table instead of needing to grep CSVs.

### Fake-precision numbers ✅
**Fix:** Rewrote taste-skill line 619: "NO invented statistics" — banned all fabricated percentages.
Also added to PROMPT_INJECT: "No fake numbers."

### Fake social proof ✅
**Fix:** Added rule after taste-skill line 337: "NO fake social proof with real company names."
Also added to PROMPT_INJECT: "NEVER mention real companies (Jira, Linear, Notion) ANYWHERE."

### Em-dashes in copy ✅
**Fix:** Added mandatory step 6 to PROMPT_INJECT: "Fix em-dashes — run grep to find ALL em-dashes and replace."
Also created `scripts/fix-ai-slop.mjs` — automatic post-processing script.

### Agent asks for approval instead of building ✅
**Fix:** Updated designer-master workflow header: "READ THE ROOM. User says 'surprise me'? Skip Step 5."
Added to PROMPT_INJECT: "NEVER ask for approval. NEVER show a plan and wait."

### No DESIGN.md or PRODUCT.md ✅
**Fix:** Created `skills/product-md.md` and `skills/design-md.md`.
Added to PROMPT_INJECT: "Write PRODUCT.md" and "Write DESIGN.md" as explicit steps.

### No reference study ✅
**Fix:** Created `skills/reference-study.md`.
Added offline design references to PROMPT_INJECT (Apple, Linear, Stripe, Awwwards, Vercel patterns).

### No visual critique ✅
**Fix:** Created `skills/visual-critique.md` with mobile QA checklist (8 criteria).

### No copywriting rules ✅
**Fix:** Created `skills/copywriting.md` with banned words list, copy process, style references.

### No scroll choreography ✅
**Fix:** Created `skills/scroll-choreography.md` with narrative motion patterns.
Inlined PinnedScroll and HorizontalScroll templates in PROMPT_INJECT.

### Tailwind v4 @utility nesting ✅
**Fix:** Added Technical Notes to `skills/design-md.md` — "@utility cannot have nested media queries."

### Motion vs framer-motion type confusion ✅
**Fix:** Added motion library clarification to `skills/design-md.md` — "ease arrays must be typed as tuples."

### No variant generation ✅
**Fix:** Added to PROMPT_INJECT: "Generate 3 design directions — Conservative, Balanced, Bold. Pick the best."

### No dark mode design rules ✅
**Fix:** Added to PROMPT_INJECT: "Dark mode is a DELIBERATE design choice, not inverted colors."

### No optical typography ✅
**Fix:** Added to PROMPT_INJECT: "Display: tracking -0.02em, leading 1.1. Body: tracking 0, leading 1.6."

### No component pattern library ✅
**Fix:** Added to PROMPT_INJECT: "Heroes: split-screen, asymmetric, full-bleed, terminal, centered minimal."

### Mobile QA not thorough ✅
**Fix:** Added mobile QA checklist to `skills/visual-critique.md` — 8 criteria for 375px viewport.

### Review skill missing animation + copy checks ✅
**Fix:** Added sections 3.6 (Animation Quality) and 3.7 (Copy Audit) to `skills/review-skill.md`.

---

## REMAINING

### P1: Model capability
The free model (deepseek-v4-flash-free) doesn't always follow rules for long-form content.
**Workaround:** fix-ai-slop.mjs catches reflexive em-dashes. Rules are in PROMPT_INJECT for stronger models.

### P2: Agent doesn't always study references
Web search times out frequently. Agent falls back to knowledge.
**Workaround:** Offline design references in PROMPT_INJECT (Apple, Linear, Stripe, Awwwards, Vercel).

### P4: Image generation not used
Agent defaults to Unsplash or CSS illustrations instead of generate_image.
**Status:** Added better prompts to PROMPT_INJECT. Model preference issue.

### P5: Agent can't see screenshots
Model limitation — agent can take screenshots but can't evaluate them visually.
**Workaround:** Layout analysis tool (scripts/analyze-layout.mjs) + code-based critique.

### P6: Pinned scroll boilerplate
Agent reinvents scroll boilerplate every time despite templates.
**Status:** Inlined PinnedScroll and HorizontalScroll templates directly in PROMPT_INJECT.

### P7: CSS @import warning
Tailwind v4 generates CSS with @import after other rules.
**Status:** Warning only, doesn't break functionality.

---

## Test Outputs (13 projects)

| Project | Domain | Score | Key Feature |
|---------|--------|-------|-------------|
| test-output/orbitask/ | SaaS | 9.5/10 | Pinned scroll, bento grid |
| test-output/luna/ | Portfolio | 9.5/10 | Horizontal scroll gallery |
| test-output/flux/ | Creative Agency | 9.5/10 | Pinned horizontal scroll |
| test-output/ironpulse/ | Fitness | 9/10 | Pinned scroll, progress ring |
| test-output/kuro/ | Restaurant | 9/10 | CSS ramen bowl illustration |
| test-output/nexus/ | SaaS | 9/10 | Terminal hero, DESIGN.md |
| test-output/flowboard-landing/ | SaaS | 9/10 | Inline kanban mockup |
| test-output/forge/ | DevTools | 9/10 | Terminal hero, dark-first |
| test-output/ember-coffee/ | E-commerce | 8.5/10 | Pinned timeline |
| test-output/aperture/ | AI narrative | 8.5/10 | 7 sections, canvas |
| test-output/syncboard-landing/ | SaaS | 8.5/10 | Animated cursor mockup |
| test-output/ceramics-product/ | E-commerce | 9/10 | Masonry gallery |
| test-output/dev-portfolio/ | Portfolio | 9/10 | Terminal typewriter |

All 13 tests: zero AI tells (no em-dashes, no buzzwords, no fake numbers, no real company names).
