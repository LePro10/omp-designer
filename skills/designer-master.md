---
name: designer-master
description: "Core product-design workflow. Read for substantial UI work; keep small edits proportional."
---

# Designer Core

Design for the actual product, audience, content, and codebase. A polished generic
template is not a successful result.

## 1. Determine scope

Classify the task before acting:

- **Small edit:** inspect and change only the requested component. Do not create
  process documents or redesign adjacent surfaces.
- **Existing-product redesign:** audit the current information architecture,
  tokens, assets, dependencies, and interactions before proposing changes.
- **New page or application:** establish product facts and a visual system before
  implementation.

Honor explicit interaction requests:

- If the user asks for a plan or approval, treat the current turn as read-only:
  inspect, present the plan, and wait. Do not create artifacts, scaffold code,
  install dependencies, or start implementation before approval.
- If the user asks you to build immediately, proceed without preference questions.
- Otherwise ask no more than two questions, only when the answer changes scope,
  brand direction, content truth, or implementation architecture.

Do not force an emotion quiz or a fixed questionnaire.

### Priority of decisions

When guidance conflicts, resolve it in this order:

1. **User decision beats style preference.** An explicit user choice about layout,
   direction, motion, or components overrides a taste rule in these skills. If the
   user asks for something a rule discourages, do it and note the tradeoff rather
   than silently overriding them.
2. **User-provided brand, product, and facts beat generic defaults.** A supplied
   palette, token set, or content truth wins over any default suggestion here.
3. **Non-negotiable blockers.** Factual integrity, accessibility basics, security,
   and working navigation are not overridable by preference. Do not ship invented
   claims, inaccessible essentials, insecure patterns, or broken links even on
   request; offer a truthful, accessible alternative instead.

Taste rules are guidance: treat them as warnings that need judgment, not as bans.
Blockers are the small set above.

### Approval-plan check

Before presenting a plan:

1. Extract the user's explicit deliverables and map each one to the plan.
2. Preserve requested architecture. "Several pages" means named routes/pages, not
   several sections on one page, unless the user approves that tradeoff.
3. Keep the plan concise and decision-oriented: direction, pages and their
   purpose, interaction narrative, responsive behavior, stack, and risks.
4. Apply evidence and behavior constraints now. Do not plan fake metrics,
   testimonials, forms without a destination, or unsupported capabilities.
5. Treat scripted AI behavior as a visibly labelled demo, not "live reasoning."
   Historical claims need a source-verification step; future claims need an
   explicit speculative label.
6. Report process evidence literally. Do not say a skill, reference, browser, or
   test was used unless the corresponding action occurred.
7. End at the requested approval boundary without writing project files.

For delegated art direction such as "surprise me", make a defensible choice
instead of adding another preference question.

## 2. Ground the work

After approval and before implementation of a new page or major redesign, create
concise artifacts:

### PRODUCT.md

- What the product is
- Primary audience and task
- Supplied brand/content facts
- Closed list of capabilities that visible copy may claim
- Explicit constraints and non-goals
- Missing facts that affect visible copy
- Working design assumptions

### EVIDENCE.md

Record externally verifiable claims that may appear in the interface:

| Claim | Source | Status | Allowed wording |
| --- | --- | --- | --- |
| Example price | user | verified | exact wording |
| Customer count | none | blocked | omit |

Never invent prices, metrics, customers, endorsements, certifications, shipping
terms, return policies, product capabilities, or testimonials. Demo data must be
labelled as demo data.

Treat the supplied product description as closed, not as permission to infer the
usual category features. For example, notes and photos being "together" does not
prove offline storage, syncing, automatic filing, voice input, assignments,
platform support, team-size limits, or real-time updates. Put unsupplied behavior
in the missing-facts list and keep it out of visible copy.

Small edits do not require these files unless factual claims are being added.

## 3. Choose a direction

Derive an art direction from project-specific inputs:

- product and user task,
- supplied brand assets,
- content type and density,
- desired emotional tone,
- platform and accessibility constraints,
- existing implementation when redesigning.

State the direction in one sentence. It must explain why the visual language fits
this project, not merely why it looks current.

Derive, don't default. Decide in this order, each from the customer's world:
mood first (warm, technical, editorial, playful, austere, luxurious), then
light or dark — light is the default for most consumer and local businesses;
dark must be earned by the product's context (code, cinema, night use, stage
hardware) — then type voice, then color. Consider three candidate directions
before committing: one safe, one bold, one unexpected. Name all three in
DESIGN.md and say why the winner fits this audience. If your last few
projects would look at home next to each other, you are templating — the
anchor menu and taste marks are a vocabulary, not a layout.

Name the one distinctive anchor that carries the page: a real product view or
miniature interface, a material or texture from the product's world, a strong
typographic move, or an honest diagram. A page with no product-specific element
has no art direction, regardless of polish.

Statistical-default aesthetics are failed art direction, not a neutral baseline.
The recurring ones: violet/purple + cyan on near-black for anything "tech",
gradient or glow wallpaper heroes, gradient-blurred blobs standing in for
imagery, interchangeable equal-card grids, headlines that fit any product, and
glassmorphism or bento grids used as decoration. Escaping them does not mean
adding complexity — parallax on every section, custom cursors, or layered
gradients are the same failure in a louder register. Escape them with
specificity: show the product's actual geometry, material, interface, or
workflow. The full definition and taxonomy is in `docs/ai-slop.md`.

### Building the anchor without supplied assets

When the user provides no imagery, choose the strongest honest construction:

1. **Miniature product interface** — a small real component rendered with
   demo-labelled data (a task list, terminal session, order card, dashboard
   tile). Built from the page's own tokens, it is imagery and proof at once.
2. **Technical or process diagram** — inline SVG drawn from the product's real
   geometry or flow (a fan's blade curve, a radiator loop, a roast timeline,
   a request path). Label the parts; a diagram whose parts could not be
   labelled is decoration.
3. **Typographic composition** — the product's own vocabulary (origin names,
   model numbers, materials, coordinates, commands) set with strong scale
   contrast and deliberate alignment.
4. **Real photography, sourced properly** — when the direction genuinely
   calls for photographs, fetch free-license images (Unsplash, Pexels,
   Openverse) with the browser or curl, save them into the project
   (`assets/`), and record each file's source URL and license in EVIDENCE.md.
   Art-direct the set: consistent subject, crop, and color grade — three
   unrelated stock moods read as templated. Never hotlink, and never use
   image-search results whose license is unknown.
5. **Physical product render** — hardware deserves an object, not only its
   UI. Build a simplified geometric render from the product's true
   proportions: layered CSS/SVG shapes with one light direction, subtle
   shadows, and labelled parts. Simplify honestly (a clean silhouette with
   correct proportions beats a detailed fantasy) and never present the render
   as a photo.
6. **Labelled placeholder** — an explicitly marked, art-directed slot for
   owner-supplied photography with real dimensions and a caption. Never a
   gradient blob.

One anchor carries the page. Secondary sections reuse its geometry, data, or
vocabulary instead of introducing unrelated decoration.

### Marks of human-made pages

Templates and generated pages take the safe average at every decision. Real
design work leaves marks. Aim for all of these on a substantive build:

- **Scale courage.** Display type at least 4x body size, tight leading
  (0.95–1.1) and slight negative tracking at large sizes; small labels may be
  spaced caps. A page whose largest text is a timid 2.5rem headline reads as
  a default theme.
- **One deliberate rule-break.** Exactly one memorable move, in service of
  the product: an oversized number, a vertical label, an element crossing a
  section boundary, a full-bleed detail crop, a footer with real presence.
  One, not five — five is noise.
- **Uneven rhythm.** Alternate dense and sparse: a tight spec cluster, then a
  full-viewport pause. Identical padding on every section is template rhythm.
- **Asymmetry with intent.** At least one section leaves the centered axis
  (7/5 or 8/4 split, offset media, staggered baselines) — because the content
  ranks unequally, not for variety's sake.
- **Connected sections.** Let at least one pair of adjacent sections share an
  element: a rule that continues, media that overlaps the boundary, a color
  that carries over. Isolated stacked bands read as assembled, not composed.
- **Finishing details.** Real page title, meta description, favicon, styled
  `::selection`, visible focus states, and — where it fits the brand — a
  small footer colophon (typefaces, stack). Templates omit these; people
  notice them without knowing why.
- **Copy discipline.** Headlines six words or fewer. Short sentences.
  Buttons name their object ("Get the roast box", not "Get Started"). One
  consistent voice throughout — formal or lowercase-casual, never both.

### Requests in the style of a named site

"Make it like Apple / Linear / Stripe" is a brief about principles, not
pixels.

1. Name three to five transferable principles of the reference.
2. Restate each against this product's content, then apply. Do not copy the
   reference's palette, typeface, or copy voice verbatim — that produces the
   clone look the reference itself would never ship.
3. Say which parts of the reference you are deliberately not taking and why.

Working profiles for the most-cited references:

- **Apple:** the product image is the argument; text is short captions at
  very large scale; space is rhythmic, not empty; the scroll progressively
  reveals one product story; a near-monochrome UI lets the product carry the
  color. Without a strong product visual this style collapses — build the
  product visual first, then the page around it.
- **Linear:** dark engineering density; the real UI is the imagery; crisp
  1px borders; one restrained accent; motion small and physical; copy terse
  and technical.
- **Stripe:** one signature gradient moment, never gradient wallpaper;
  documentation-grade typography; diagrams that genuinely explain the
  system; high information density with tight, confident spacing.
- **Editorial / newspaper feature:** typography is the design — a serif
  voice, a strict multi-column grid, drop caps or standfirsts used once,
  generous measure (60–75ch), captions and credits treated as first-class,
  images placed by the text they serve. Restraint everywhere else.
- **Aesop-style commerce:** muted, material palette from the product itself;
  large quiet photography; long considered product copy instead of bullet
  hype; small type sizes worn confidently; no discount-banner energy.
- **Brutalist portfolio:** raw grid visible, system or mono type at extreme
  sizes, unstyled-looking links that are deliberately styled, harsh contrast,
  content-dense; the discipline is in the spacing and alignment — brutalism
  without rigor is just mess.

Use references only when they resolve a real decision. Study one or two relevant
examples and extract a principle; do not copy their content or automatically use
the same five technology brands for every project.

## 4. Plan proportionally

For a full build, cover:

- routes and sections,
- content purpose of each section,
- visual system and asset strategy,
- interaction and responsive behavior,
- implementation stack,
- factual and technical risks.

A product landing page should answer the visitor's whole question chain:
what is this, who is it for, how does it actually work, what does it look
like in use, what are the concrete details or specs, what practical facts
matter (process, care, availability), who is behind it, and what to do next.
Depth comes from answering more of that chain, never from padding: a tight,
well-specified brief can be complete in four or five sections, while a vague
brief usually deserves the fuller story — if you stop at hero, three cards,
and a CTA, check which questions you left unanswered rather than adding a
generic section.

Do not add standard landing-page sections without a product reason. Do not add
dark mode, animation, pricing, testimonials, dashboards, or extra routes merely
to make the output look complete.

Before coding a full page, make a one-line composition map such as
`editorial hero → annotated workflow → compact proof → action`. It should expose
repetition early. A sequence of centered headings followed by equal rounded-card
grids is a template, even when the copy is specific. Use cards only for genuinely
independent items; use a list, comparison, annotated product view, timeline, or
continuous narrative when the content has order or relationships.

If the map contains two sections described as card grids, redesign one before
coding unless both are truly independent comparison sets and the repetition is
intentional.

## 5. Build

Build in two passes. First the structure pass: real content, semantic
sections, working layout, no styling beyond tokens — then capture the page
and check it (blank regions, order, hierarchy of information). Then the art
pass: type scale, color, texture, the signature moment, motion. Entangling
both passes is how content errors hide under styling. After building the
hero in the art pass, capture it once at 1280px and run the overlap snippet
before styling the rest — course-correcting one section is cheap, repainting
a finished page is not.

- Preserve the existing stack and component conventions unless change is needed.
- For greenfield work, choose the lightest stack that serves the task and say
  so: a single landing page is well served by static HTML/CSS/JS; add a
  framework only when real interactivity, routing, or an existing codebase
  requires it. Either choice is fine — an unexamined habit is not.
- Use semantic elements and real interaction states.
- Keep one dominant idea per section.
- Vary layout only when content structure benefits from it.
- Give the most important product behavior more visual weight than supporting
  feature lists. At least one major composition should explain the product
  through its real content or workflow, not decorative geometry.
- Use supplied or generated imagery with a consistent art direction.
- Prefer a real miniature component over a fake screenshot made from decorative
  rectangles.
- Use one icon family and a small set of design tokens.
- Compose mobile layouts deliberately rather than only stacking desktop columns.
- Keep content visible at initial paint. A scroll-reveal must start from a
  legible state and only enhance; with JavaScript disabled, with reduced motion,
  and in a full-page screenshot, every section must be readable.
- Add dependencies only when they solve a requirement the platform or existing
  stack cannot solve simply.
- A generic scroll-reveal is not a reason to install a motion library.

## 6. Copy

Write concrete copy for one identifiable audience.

- Prefer nouns and verbs over promotional adjectives.
- Keep headlines and calls to action specific to their destination.
- Avoid unsupported superlatives and vague claims.
- Treat words such as "seamless", "innovative", and "unlock" as review signals,
  not forbidden tokens. Replace them when they carry no information.
- An em dash is punctuation, not a defect by itself. Repeated model-like cadence
  is the defect.

## 7. Review

Before delivery:

1. Run the project build.
2. Run the local quality and layout checks.
3. Exercise the primary interaction in a browser.
4. Review at a narrow and wide viewport.
5. Check keyboard focus, contrast, overflow, content truth, and reduced motion.
6. Compare every visible capability, metric, platform, and audience claim with
   the closed fact list.
7. Fix observed defects, then verify the fix.

Do not claim browser, build, or accessibility validation that did not happen.
