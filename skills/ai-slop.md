# AI-SLOP.md

> Operational definition for AI-assisted web and interface design  
> Version: 0.1 — calibration draft  
> Scope: marketing sites, product interfaces, dashboards, portfolios, editorial pages, and e-commerce

## 1. Purpose

“Do not make AI slop” is not an actionable instruction.

This document converts the term **AI slop** into observable properties, context-sensitive rules, severity levels, evidence requirements, review methods, and repair actions. It is intended for design agents, implementation agents, reviewers, and automated validators.

This is **not** a universal style guide. It does not ban a visual style merely because AI systems use it often. A gradient, card grid, serif headline, glass surface, or dark theme may be appropriate. It becomes a slop signal when it is used by reflex rather than because the product, audience, content, interaction, or brand requires it.

## 2. Normative language

The terms **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative.

- **MUST / MUST NOT**: required for acceptance.
- **SHOULD / SHOULD NOT**: default rule; deviations require a written rationale.
- **MAY**: optional and context-dependent.

## 3. Core definition

### 3.1 General definition

**AI slop is superficially competent output that lacks sufficient intention, grounding, specificity, coherence, truthfulness, or product fit.**

In interface design, slop usually appears as one or more of the following:

1. **Default-driven** — recognizable model or template reflexes replace deliberate decisions.
2. **Interchangeable** — the design could be relabeled for another product with minimal change.
3. **Ungrounded** — content, claims, visuals, features, or interactions are not supported by the brief or evidence.
4. **Incoherent** — individual elements may look polished, but they do not form one consistent system.
5. **Decorative without purpose** — effects attract attention without clarifying hierarchy, meaning, state, or action.
6. **Quantity-over-value** — extra sections, cards, copy, metrics, or features exist mainly to make the output appear complete.
7. **Unreviewed** — obvious responsive, accessibility, factual, interaction, or implementation defects remain.
8. **Overfitted to current AI aesthetics** — the result follows the currently fashionable output distribution of models rather than the project’s needs.

### 3.2 What is not AI slop

Output is not slop merely because AI helped produce it.

A result may be AI-assisted and still be strong when it is:

- grounded in real product and user context,
- deliberately art-directed,
- specific to its subject,
- factually honest,
- internally coherent,
- accessible and functional,
- visually and verbally edited,
- validated in the browser,
- difficult to transplant unchanged to a different product.

Human-made work can also be slop. The classification concerns the output, not proof of authorship.

## 4. The substitution test

Ask:

> Could the product name, logo, and accent color be replaced, while 80% of the page remains equally plausible for another product?

- **Yes**: strong slop risk.
- **Partly**: inspect specificity, information architecture, imagery, copy, and interaction model.
- **No**: the design is likely meaningfully tied to the product.

The substitution test is a heuristic, not a standalone verdict.

## 5. The rationale test

Every prominent decision MUST answer at least one of these questions:

- What user need does this serve?
- What product truth does this express?
- What information hierarchy does this clarify?
- What brand characteristic does this embody?
- What interaction state or causal relationship does this communicate?
- What constraint made this decision appropriate?

If the only answer is “it looks modern,” “AI suggested it,” or “landing pages usually do this,” the decision is a slop candidate.

## 6. Evaluation dimensions

Judge each dimension from **0 to 4**:

- **0 — Excellent:** specific, coherent, intentional, verified.
- **1 — Minor concern:** isolated issue; does not shape the overall result.
- **2 — Noticeable:** repeated or user-visible weakness.
- **3 — Serious:** strongly generic, misleading, incoherent, or defective.
- **4 — Blocking:** dishonest, inaccessible, broken, or dominated by reflexive output.

### 6.1 Product grounding and specificity

Inspect whether the interface reflects the actual product, audience, task, domain, and constraints.

**Slop signals**

- Generic value propositions that fit almost any software product.
- Sections selected from a standard landing-page checklist rather than user needs.
- Features invented to make the product appear complete.
- Generic personas, workflows, testimonials, or use cases.
- Visual metaphors unrelated to the product.
- The same information architecture used across unrelated categories.
- A dashboard that has no plausible operational workflow.
- A product page that does not explain the physical product.

**Required evidence**

- `PRODUCT.md` or an equivalent source of truth.
- Explicit users, primary jobs, critical tasks, constraints, and non-goals.
- A traceable reason for every major section.

**Repair**

Remove unsupported sections. Rewrite around concrete user tasks and product truths. Replace generic components with structures that reflect the domain.

### 6.2 Truthfulness and evidence

The interface MUST distinguish supplied facts, researched facts, assumptions, placeholders, and fictional demonstration data.

**Blocking signals**

- Invented prices, discounts, shipping terms, return policies, lead times, certifications, awards, or availability.
- Invented user counts, growth percentages, performance improvements, savings, or benchmark results.
- Real company logos, names, or testimonials presented as customers without evidence.
- Fabricated quotations or attributed endorsements.
- Fake citations or research claims.
- Production-looking controls that imply unavailable functionality.

**Required behavior**

- Use `[NEEDS INPUT]`, “Price on request,” clearly labeled sample data, or omit the claim.
- Maintain an evidence ledger for externally verifiable claims.
- Fictional demo data MUST be visibly and semantically marked as demo data.

### 6.3 Information architecture and narrative

The page MUST have a clear reason for its sequence.

**Slop signals**

- Hero → logo cloud → three cards → metrics → testimonials → pricing → FAQ by default.
- Every section uses the same centered heading and card grid.
- Section order can be shuffled without changing meaning.
- Repetition substitutes for narrative progression.
- The page front-loads slogans and delays useful information.
- Decorative storytelling hides the primary task.

**Repair**

Define the reader’s questions in order. Give each section a unique information job. Remove sections that do not advance understanding or action.

### 6.4 Composition and layout

Composition SHOULD create hierarchy, rhythm, contrast, and purposeful variation.

**Slop signals**

- Everything centered.
- Identical rounded cards repeated across the entire page.
- Nested cards used as default grouping.
- Uniform spacing that removes rhythm.
- Excessive pill-shaped containers.
- Side-accent borders used repeatedly as decoration.
- Random asymmetry with no relationship to content.
- Empty space used to imitate luxury without supporting content.
- Desktop composition merely stacked on mobile.
- Heading overflow or clipped content at intermediate widths.

**Repair**

Use content-led layouts. Vary density intentionally. Establish a spatial system, then break it only for a reason. Test real content at multiple viewport widths.

### 6.5 Visual system coherence

The interface MUST behave like one designed system rather than a collection of attractive fragments.

**Slop signals**

- Inconsistent radii, borders, shadows, icon weights, or spacing scales.
- Multiple unrelated surface treatments.
- Different sections imply different brands.
- Tokens exist but components bypass them.
- Decorative effects are not repeated according to a rule.
- One-off values proliferate without rationale.

**Required evidence**

- `DESIGN.md` or equivalent design contract.
- Semantic tokens for color, type, spacing, radius, border, elevation, and motion.
- Components that consume those tokens.
- A documented exception when a major element breaks the system.

### 6.6 Color and material

Color MUST communicate hierarchy, interaction, state, or brand—not merely signal “futuristic.”

**Contextual slop signals**

- Purple/violet gradients as an unexplained technology default.
- Cyan accents and glows on dark backgrounds used category-wide.
- Gradient headline text without semantic purpose.
- Gray text placed on colored surfaces with weak contrast.
- Pure black and pure white used everywhere without tonal hierarchy.
- Too many near-identical dark surfaces distinguished only by borders.
- Glassmorphism used across all sections.
- Accent color applied to every icon, number, and keyword.
- Palette chosen from category stereotype alone.

**Important**

None of these treatments is automatically forbidden. Flag them when they are repeated, unsupported by the brand concept, or chosen as a model reflex.

### 6.7 Typography

Typography MUST establish hierarchy, voice, readability, and product fit.

**Slop signals**

- The same popular default typefaces across unrelated projects.
- One font family and weight pattern used for every role without purpose.
- Giant serif or italic display type added merely to appear editorial.
- Tiny uppercase tracked eyebrow text above every section.
- Flat hierarchy where labels, body text, and headings feel interchangeable.
- Excessively large hero text that fails on mobile.
- Long lines, cramped leading, weak contrast, or tiny body text.
- Arbitrary type changes between sections.

**Repair**

Select type from brand attributes and reading conditions. Define role-based type tokens. Test long words, localization, zoom, and narrow layouts.

### 6.8 Copy and voice

Copy MUST be concrete, truthful, audience-aware, and edited.

**Slop signals**

- “Revolutionize,” “unlock,” “seamless,” “elevate,” “supercharge,” or similar language without specific meaning.
- “Not just X, but Y” and other repeated model constructions.
- Empty claims such as “built for the future.”
- Repetitive sentence cadence and excessive em dashes.
- Features described as adjectives rather than user outcomes.
- Buttons labeled “Learn more” when the destination is predictable and can be named.
- Fake friendliness, theatrical confidence, or unexplained technical jargon.
- Copy that could be moved to another category unchanged.

**Repair**

Prefer concrete nouns and verbs. State what the product does, for whom, under which conditions, and why it matters. Remove claims that cannot be demonstrated.

### 6.9 Imagery and iconography

Visual assets MUST carry product meaning or brand character.

**Slop signals**

- Generic abstract gradient blobs standing in for the product.
- Stock-photo hotlinks with no licensing or permanence strategy.
- AI imagery with anatomy, material, lighting, or object inconsistencies.
- Unrelated 3D objects used to make a hero feel premium.
- Icons from mixed families or with inconsistent stroke weights.
- Decorative illustrations that contradict the product’s tone.
- Product screenshots that are illegible, impossible, or fabricated without labeling.

**Repair**

Use authentic product imagery, purpose-built illustration, diagrams, real screenshots, or honest placeholders. Define an art-direction rule before generating assets.

### 6.10 Motion and interaction

Motion MUST explain change, provide feedback, establish continuity, or support narrative.

**Slop signals**

- Every element fades and rises on scroll.
- Bounce or elastic easing used indiscriminately.
- Long entrance sequences that delay content.
- Parallax without semantic purpose.
- Layout properties animated when transforms would be smoother.
- Hover effects applied to non-interactive objects.
- Scroll hijacking or horizontal sequences without accessible alternatives.
- Motion remains active despite reduced-motion preferences.
- Animation style changes from section to section.

**Repair**

Write a motion rationale. Use a small tokenized duration/easing system. Test keyboard, touch, reduced motion, and low-performance conditions.

### 6.11 Usability and accessibility

A polished appearance does not compensate for inaccessible or unclear interaction.

**Blocking signals**

- Keyboard traps or unreachable controls.
- Missing visible focus.
- Insufficient contrast.
- Controls without accessible names.
- Tiny or tightly packed targets.
- Hover-only information.
- Unlabeled form errors.
- Broken zoom, reflow, or text resizing.
- Auto-playing or flashing content without control.
- Mobile navigation that cannot be operated reliably.

**Required baseline**

Conform to the project’s declared accessibility target. For ordinary public-facing work, WCAG 2.2 AA SHOULD be the default minimum.

### 6.12 Responsive behavior

Responsive design MUST be recomposed, not merely compressed.

**Slop signals**

- Desktop grid converted to a long undifferentiated stack.
- Large empty areas caused by fixed heights.
- Horizontal overflow.
- Navigation, tables, charts, or carousels without narrow-screen behavior.
- Type scales that jump abruptly.
- Touch targets designed for mouse density.
- Content priority unchanged despite limited screen space.

**Repair**

Define key breakpoints from content failure, not device labels. Test representative narrow, medium, and wide widths plus zoom.

### 6.13 Functional completeness

The interface MUST work as represented.

**Slop signals**

- Buttons and links that do nothing.
- Forms that cannot submit or communicate state.
- Tabs, filters, carousels, dialogs, or menus implemented only visually.
- Loading, empty, error, success, disabled, and permission states omitted.
- Demo behavior that breaks under realistic content.
- Interaction copy inconsistent with actual behavior.

**Repair**

Create browser-based task tests from the brief. Include edge states. Do not present incomplete controls as finished.

### 6.14 Implementation quality

Implementation choices SHOULD preserve the intended experience under real constraints.

**Slop signals**

- Avoidable layout shift.
- Large unoptimized assets.
- Excessive client JavaScript for static content.
- Repeated one-off CSS values.
- Invalid semantics.
- Console errors and hydration warnings.
- Components that copy-paste instead of sharing stable behavior.
- Performance sacrificed for decorative effects.

### 6.15 Distinctiveness and category reflex

A design SHOULD feel plausible for this project, not inevitable from the product category.

Run two checks:

1. **First-order reflex:** Could someone guess the palette, typography, hero, and components from the category alone?
2. **Second-order reflex:** After banning the obvious category cliché, did the agent simply move to the next fashionable alternative?

Example:

- First-order: AI tool → dark background, purple/cyan glow, glass cards.
- Second-order: “not that” → cream background, rusty orange, huge italic serif, ticker bar.

A project fails when its direction is selected by stereotype rather than a project-specific concept.

## 7. Cross-signal rule

A single weak signal rarely proves slop.

Classify the result as slop when:

- one **blocking** issue exists, or
- three or more dimensions score **3**, or
- the same reflex appears across multiple registers, such as color + typography + layout + copy, or
- the substitution and rationale tests both fail.

This reduces false positives against legitimate styles.

## 8. Severity model

### Blocking

Must be fixed before delivery:

- fabricated claims or commercial facts,
- broken primary tasks,
- serious accessibility failures,
- deceptive controls,
- unusable responsive behavior,
- missing evidence for public claims,
- content or assets that create legal or safety risk.

### Major

Strongly harms quality or distinctiveness:

- page-wide template reflex,
- incoherent design system,
- repetitive composition,
- unreadable typography,
- purposeless motion,
- generic copy dominating the experience.

### Minor

Localized issue:

- one unnecessary pill,
- isolated weak label,
- one inconsistent radius,
- one overly long line,
- a single generic section treatment.

## 9. Required project artifacts

Before implementation:

### `PRODUCT.md`

- product and offer,
- target users,
- primary jobs,
- key tasks,
- real facts,
- assumptions,
- non-goals,
- content gaps,
- accessibility target,
- success criteria.

### `DESIGN.md`

- art-direction sentence,
- brand attributes,
- anti-references,
- visual references and extracted principles,
- palette and semantic color roles,
- typography roles,
- spacing and grid system,
- radius, border, elevation, and material rules,
- imagery and iconography direction,
- motion rules,
- component vocabulary,
- responsive principles,
- intentional exceptions.

### `EVIDENCE.md`

For every externally verifiable claim:

- exact claim,
- source or user-provided evidence,
- confidence,
- allowed wording,
- where it appears.

Unsupported claims MUST NOT ship.

## 10. Review pipeline

A single self-review is insufficient.

### Gate 1 — Deterministic source scan

Check code and content for:

- unsupported numbers and claims,
- forbidden or risky phrase patterns,
- off-token colors and spacing,
- typography violations,
- inaccessible semantics,
- small targets,
- missing states,
- broken links and controls,
- performance and console defects.

### Gate 2 — Browser task tests

Exercise all primary workflows, including:

- keyboard navigation,
- forms and validation,
- menus and dialogs,
- error and empty states,
- mobile navigation,
- reduced motion,
- realistic content lengths.

### Gate 3 — Screenshot review

Capture at minimum:

- narrow mobile,
- wide mobile or small tablet,
- laptop,
- wide desktop,
- 200% zoom where relevant.

Inspect hierarchy, rhythm, overflow, visual coherence, and product fit.

### Gate 4 — Visual judge

Use a vision-capable evaluator with this document and the brief. Require:

- evidence tied to visible regions,
- dimension-by-dimension scores,
- confidence,
- no assumption that “AI-looking” automatically means low quality.

### Gate 5 — Pairwise comparison

Compare the candidate against:

- the previous version,
- a control build without the skill,
- one alternative art direction,
- or a relevant reference target.

Pairwise preference is preferred over isolated “8/10” scoring.

### Gate 6 — Human acceptance

A human reviewer SHOULD answer:

- Does this feel made for this product?
- What feels generic?
- What feels dishonest or unsupported?
- What would be remembered tomorrow?
- Which decision would a competent designer challenge?

## 11. Detector design rules

Automated detection MUST avoid becoming another brittle taste oracle.

Every detector rule MUST include:

- a stable rule ID,
- category and severity,
- the rationale,
- at least four positive fixtures,
- at least five legitimate counterexamples,
- framework coverage where applicable,
- a repair suggestion,
- an escape hatch with documented rationale,
- tests for false positives,
- version history.

Rules SHOULD detect combinations and frequency, not only isolated tokens.

Example:

Bad detector:

> Flag every purple gradient.

Better detector:

> Flag a purple-to-cyan gradient when it dominates a technology-category interface, lacks a documented brand rationale, is repeated across unrelated surfaces, and co-occurs with dark glow or glass-card defaults.

## 12. Scoring

Calculate two separate results:

### 12.1 Shipping readiness

- Pass/fail based on blocking defects, functional tasks, accessibility target, and evidence.
- A visually distinctive page can still fail shipping readiness.

### 12.2 Slop risk

Weighted score from 0–100:

- Product grounding and specificity: 15
- Truthfulness and evidence: 15
- Information architecture and narrative: 10
- Composition and layout: 10
- System coherence: 10
- Copy and voice: 8
- Typography: 7
- Color and material: 7
- Imagery and iconography: 5
- Motion and interaction: 5
- Responsive behavior: 4
- Distinctiveness/category reflex: 4

Interpretation:

- **0–14:** low slop risk
- **15–29:** minor concerns
- **30–49:** noticeable genericity or weak grounding
- **50–69:** major slop characteristics
- **70–100:** dominated by slop

Do not collapse shipping readiness and slop risk into one number.

## 13. Repair protocol

When slop is detected:

1. Name the failed dimension.
2. Cite visible or source-level evidence.
3. Identify whether the cause is missing context, a model reflex, incomplete implementation, or weak review.
4. Remove unsupported content before adding polish.
5. Repair the system or rule, not only the isolated symptom.
6. Re-run deterministic, browser, and screenshot checks.
7. Compare the revision pairwise against the previous version.
8. Record what changed and why.

## 14. Anti-overcorrection

The system MUST NOT turn “anti-slop” into another recognizable house style.

Do not automatically replace:

- dark neon with cream editorial,
- sans-serif with giant italic serif,
- cards with arbitrary asymmetry,
- gradients with flat beige,
- polished copy with forced quirkiness,
- standard layouts with scroll gimmicks.

The goal is not to look less like one AI default by adopting another. The goal is to produce work whose decisions are justified by the project.

## 15. Calibration dataset

Maintain a versioned dataset containing:

- strong human-designed examples,
- strong AI-assisted examples,
- weak AI-generated examples,
- weak human-designed examples,
- ambiguous examples,
- examples that intentionally use commonly flagged styles well.

Each example SHOULD include:

- project context,
- screenshots at several widths,
- source code where available,
- expert annotations by dimension,
- disagreement notes,
- detector outputs,
- final pairwise judgments.

The dataset MUST contain hard negatives so the detector learns that common styles are not automatically slop.

## 16. Definition of done

A project is ready only when:

- no blocking issue remains,
- primary tasks work in the browser,
- claims are supported or explicitly labeled,
- the accessibility target is met,
- screenshots pass responsive review,
- the design is internally coherent,
- prominent decisions have written rationale,
- the substitution test does not reveal broad interchangeability,
- pairwise review prefers the final result over its control or previous version,
- remaining known limitations are documented.

## 17. Compact agent instruction

Use this when context is limited:

> AI slop is superficially polished but insufficiently intentional, grounded, specific, coherent, truthful, or product-fit output. Do not judge styles in isolation. Detect default reflexes, interchangeability, unsupported content, system inconsistency, decorative excess, incomplete interaction, and unreviewed defects. Ground every major decision in PRODUCT.md and DESIGN.md, verify claims through EVIDENCE.md, test real browser tasks and responsive screenshots, and use pairwise review instead of trusting a self-assigned score. A common visual treatment is allowed when its use is deliberate, coherent, accessible, and justified by the project.

## 18. Stable principles vs. temporal trends

Anti-slop rules MUST be separated into two layers to prevent the system from fighting yesterday's cliches while ignoring tomorrow's.

### Stable principles (permanent, no expiry)

These apply regardless of year, model, or trend:

- **Interchangeability / substitution test** - Could this design work for another product?
- **Product grounding** - Is the design tied to this specific product, audience, and task?
- **Truthfulness** - Are claims supported by evidence?
- **Coherence** - Does the design behave as one system?
- **Accessibility** - Is the result actually usable?
- **Functional completeness** - Does everything that looks functional actually work?
- **Rationale** - Does every prominent decision have a reason?
- **Distinctiveness** - Did the direction come from the project, not from stereotype?

### Temporal trends (contextual, expire)

These change as models and fashions evolve. Each MUST have an introduction date and a review date:

```yaml
id: AS-TREND-2026-001
signal: dark-purple-cyan-glass-default
introduced: 2026-01
review_after: 2026-12
severity: contextual
note: Current LLM default for tech products. Flag when used without brand rationale.
```

```yaml
id: AS-TREND-2026-002
signal: cream-orange-italic-serif-editorial
introduced: 2026-06
review_after: 2026-12
severity: contextual
note: Current anti-slop overcorrection default. Flag when used as "not AI-looking" rather than project-justified.
```

```yaml
id: AS-TREND-2026-003
signal: overused-default-fonts
fonts: [Inter, Roboto, Geist, Plus Jakarta Sans, Space Grotesk]
introduced: 2026-01
review_after: 2026-12
severity: contextual
note: These fonts are overused in AI-generated designs. Exception: Roboto Mono for monospace, Roboto Condensed for display.
```

Temporal rules SHOULD be reviewed at their `review_after` date. If the trend has faded, remove the rule. If it persists, update the date.

**Anti-overcorrection:** A temporal trend rule MUST NOT create a new predictable default. Always check: after banning the trend, did the agent just adopt the next fashionable alternative?
