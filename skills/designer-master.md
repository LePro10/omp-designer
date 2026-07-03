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

- Preserve the existing stack and component conventions unless change is needed.
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
