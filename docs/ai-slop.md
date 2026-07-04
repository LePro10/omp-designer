# AI slop — definition and taxonomy

This is the canonical definition the omp-designer system works against. The
runtime prompt carries a compressed version; the skills carry the working
version; the validators and the eval harness detect the mechanical subset.

## Definition

**AI slop is design whose decisions come from the statistical average of the
model's training distribution instead of from the product in front of it.**

A generative model asked for "a beautiful website" with no counter-pressure
produces the most probable website: the mean of millions of landing pages.
The mean is not ugly — it is *interchangeable*. Its tell is not any single
element but substitutability: swap the logo and the page could sell anything.

Slop is therefore not a list of banned techniques. Gradients, dark themes,
card grids, minimalism, and scroll animation are all legitimate when a
product-specific decision chose them. The same elements are slop when they
appear because nothing pushed back on the default. The test for any decision
is: **could this choice be explained only by pointing at this product?**

The dual failure — equally slop — is overcorrection: adding parallax, custom
cursors, layered gradients, and noise to *look* distinctive. Randomness is not
specificity. The escape from the statistical mean is always product evidence,
never decoration.

## Taxonomy

Each axis lists the failure, why models produce it, how this system observes
it, and what the correct move is.

### 1. Palette slop

Violet/purple primary + cyan accent on near-black for anything "tech"; the
same teal/emerald for anything "SaaS"; warm brown paint over a SaaS template
for anything artisanal. Colors arrive from the category prior, not the brand.

- Detected: `ai-default-palette` (analyze-layout), palette contract rules.
- Instead: derive color from the product's physical or interface world, and
  document the derivation in DESIGN.md. A thermal brand has anodized metal,
  copper, coolant; a bakery has crust, flour, butter; an AI tool has its own
  interface as the primary color source.

### 2. Wallpaper composition

Full-bleed gradient or glow heroes with a centered vague headline; decorative
blob geometry; "cinematic" voids; giant whitespace standing in for premium.
The page performs atmosphere because it has nothing specific to show.

- Detected: `gradient-heavy`, `gradient-imagery` (analyze-layout), blank-band
  screenshot analysis (eval + delivery taste review).
- Instead: the hero shows the product — a real UI miniature, an honest
  technical diagram, real photography, or a typographic composition built
  from the product's actual vocabulary.

### 3. Imagery evasion

Gradient-blurred blobs where photos should be; fake "screenshots" assembled
from decorative rectangles; hotlinked Unsplash/Pexels/picsum stock as final
assets; icon grids as a substitute for showing anything.

- Detected: `gradient-imagery`, `remote-placeholder-asset` (fix-ai-slop).
- Instead: inline SVG diagrams drawn from real product geometry, real
  component previews with demo-labelled data, licensed local assets, or an
  explicit labelled placeholder that the owner replaces.

### 4. Template composition

hero → three equal cards → three equal cards → CTA; bento grids everywhere;
uniform border radius on every surface; every content group boxed in a
floating rounded card; the colored 3–6px left-border accent strip on
containers (one of the most reliable generated-UI tells); emoji doing the
work of icons. Structure arrives from the template prior, not from the
content's actual shape (order, hierarchy, comparison, narrative).

- Detected: composition signals (equal-grid and rounded-surface counts,
  Tailwind and vanilla CSS), `avoidedGenericComposition` behavior signal.
- Instead: map the composition before coding; give the page one dominant
  product-explaining section; use lists, tables, diagrams, timelines, or
  continuous narrative when content has order or relationships.

### 5. Copy slop

Headlines that fit any product ("Build the future", "Experience excellence");
buzzword strings; fabricated stats (10x / 98% / 50k+ users); "data slop" —
numbers, icon rows, and stat tiles that inform nothing; invented
testimonials, logos, and social proof; category capabilities the user never
stated (offline, sync, real-time).

- Detected: unsupported-percentage/multiplier/count/price, stat-literal
  capture, `unsupported-social-proof`, `unsupported-capability-signal`,
  buzzword and cadence warnings (fix-ai-slop).
- Instead: concrete nouns and verbs from the closed fact set; missing facts
  stay missing; demo data is visibly labelled demo.

### 6. Motion slop

Everything fades up from `opacity: 0` on scroll; content hidden at initial
paint (blank without JavaScript, under reduced motion, and in full-page
captures); motion libraries installed to decorate weak layout; scroll-jacking.

- Detected: `reveal-hidden-content` (analyze-layout), blank-band screenshot
  analysis, motion-count signals, reduced-motion rules.
- Instead: content legible at initial paint; motion communicates state,
  continuity, or spatial relationship; one scroll narrative per site maximum.

### 7. Integrity slop

Prominent buttons that go to "#"; signup forms that "succeed" with no
delivery mechanism; fake app chrome presented as the real product; scripted
sequences presented as live AI.

- Detected: `nonfunctional-action`, `nonfunctional-signup` (fix-ai-slop),
  plan checks.
- Instead: real navigation, truthful states, visible demo labels.

## How the system applies this

1. **Prompt (guaranteed context)** names the patterns and demands a
   product-derived direction with one distinctive anchor.
2. **Skills** carry this taxonomy plus the constructive playbook
   (designer-master §3–6, design-md).
3. **Validators** make the mechanical subset visible as warnings — taste
   never hard-blocks; evidence fabrication does.
4. **Delivery taste review** (session stop) turns detected slop co-occurrence
   into one bounded self-repair pass.
5. **Eval harness** measures it across real model runs (blank-band analysis,
   composition signals, score caps) so regressions are caught before release.
