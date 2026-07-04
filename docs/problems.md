# Problems found and v5 decisions

## Fixed

### Duplicate installation and hook registration

The old documentation combined plugin installation, managed skill copies, and
manual extension paths. Real traces contained adjacent duplicate prompt and tool
events. v5 uses package-relative assets, documents one installation mechanism,
adds a process-wide registration guard, and reports legacy-copy risk in
`/designer-doctor`.

The affected development machine also had a v5 plugin link beside the old v2
manual extension and all 12 managed skills. This explains the observed strict
gate error. A dry-run-first uninstaller and clean local installer now detect and
remove that exact mix. Their destructive paths are regression-tested against an
isolated temporary HOME.

### Skill gate dominated the task

The 12-skill ordering gate blocked unrelated tools, created a ten-phase state
machine, and repeatedly continued after the agent was ready to stop. It measured
ritual completion rather than interface quality. v5 has four conditional skills
and no `tool_call`/`tool_result` gate.

### MCP ownership was wrong

The extension edited host MCP configuration and coupled designer mode to server
enablement. This caused cwd/global mismatches, reload requirements, and failures
unrelated to the user's design task. v5 only reports configured MCPs. Research is
optional and task-driven.

### Validators encoded style opinions as failures

The prior copy validator could treat punctuation, CSS percentages, and generic
word lists as hard errors. The layout validator expected full artifacts for small
changes. v5 limits blockers to evidence and objective accessibility defects;
style and documentation signals are warnings.

### The model could self-authorize claims

An agent could write `Source: user` into EVIDENCE.md and make an invented release
status pass its own validator. v5 now retains the original user prompt in runtime
memory and passes it directly to the delivery validator. Generated ledgers remain
useful documentation, but are not the authority during automatic checks.

### Data was not audited

`typography.csv` contained a concatenated record and several palette foreground
pairs were below 3:1. A CSV parser and contrast audit now run in the normal test
suite. Remaining 3:1–4.5:1 pairs are explicitly warned because their validity
depends on use.

### Tests exercised reimplementations

Several old tests duplicated logic or checked a synthetic gate rather than the
actual extension. v5 imports the real TypeScript extension, invokes its registered
handlers, tests real validator CLIs, audits packed release files, and runs a real
model comparison when output behavior changes.

### Mixed installation weakened E2E evidence

The later v5 DeepSeek runs exercised the v5 prompt, delivery validator, and trace,
but old v2 files remained discoverable on the host. The v2 mode was usually off,
so the comparison still identified real v5 improvements; it did not prove a
clean production install. Clean installation and restart are now explicit
preconditions for release-candidate model runs. The harness also stopped passing
an explicit extension path beside the installed plugin. The first clean,
single-source comparison is R8.

### Approval plans ignored explicit page scope

A real DeepSeek plan read the design skills but replaced "various pages" with a
single long page, overpromised effects, and later rationalized the miss. Prompt
guidance alone remained inconsistent across repeated runs. Plan-only turns now
use a smaller prompt without delivery-review instructions and a bounded runtime
check for objective scope, route, form, metrics, dead-link, source, and native
scroll violations. The same prompt reached `plan_checks_passed` after one rewrite
in R8 without creating project files.

### Automated score was mistaken for design quality

The first v5 DeepSeek run reached 100/100 while screenshots still showed three
repetitive card-grid sections. The report now labels its number as an automated
delivery score and emits composition signals. A written screenshot review is part
of every comparison.

### Normal-user prompts exposed a taste regression (v5.1 pre-release)

Three DeepSeek V4 Flash runs on deliberately vague prompts ("make a beautiful
website for my coffee brand", "create a landing page for a premium PC fan and
AIO brand", "make a stunning website for an AI product") produced the
statistical-default AI look: violet + cyan on near-black for the AI product, a
gradient wallpaper hero and gradient-blob "photography" for the coffee brand,
and full-page screenshots that were 54–77% contiguous void because sections
started at `opacity: 0` behind a scroll reveal. Automated delivery checks
passed all three.

Root causes and fixes:

1. The v5 runtime prompt carried integrity and scope rules but no art-direction
   guidance; taste lived only in conditionally-read skills, so a weak model
   regressed to the statistical mean. The prompt now has a compact
   "Art direction" core naming the default patterns as failures and requiring a
   product-specific anchor, and the skills carry the deeper version.
2. Nothing looked at the pixels. `shared/screenshot-analysis.mjs` now decodes
   PNG captures and measures contiguous blank bands; a full-page capture that is
   ≥30% void adds a composition signal and caps the automated delivery score
   at 60.
3. Composition regexes were Tailwind-only, so plain-CSS pages bypassed every
   signal, and `analyze-layout` did not scan root-level `css/`/`js/` files.
   Both are fixed, and four framework-agnostic warnings were added:
   `reveal-hidden-content`, `ai-default-palette`, `gradient-heavy`, and
   `gradient-imagery`.
4. A static site without a build system lost 35 delivery points while sloppy
   builds scored 95+; a plain `index.html` project now counts as buildable.

These stay warnings, not blockers: the point is that taste failures become
visible in reports and screenshots become inspectable evidence, not that a
regex bans gradients.

The follow-up cycle addressed what the re-runs exposed: `docs/ai-slop.md` is
now the canonical slop definition; stat tokens behind object keys
(`value: "10x"`), `50k+`-style counts, and split stat tiles no longer bypass
the copy audit (while CSS value strings such as `translate(-50%, -50%)` no
longer false-positive); `session_stop` runs a taste review after delivery
checks pass and grants exactly one bounded self-repair continuation when slop
rules, blank screenshot bands, or a missing DESIGN.md on substantive work are
detected; the skills gained a constructive anchor playbook and
legibility-over-imagery review items; and the quality report carries
`contentVisibleAtInitialPaint`, `avoidedDefaultAiPalette`, and
`avoidedGradientImagery` signals. Taste still never hard-blocks delivery.

A third pass extended the same net: `contact-details-unverified` warns on
phone numbers and email addresses the user never supplied (scoped to visible
copy so SVG coordinates and dates do not match); the session-stop taste review
also reads the quality validator (hotlinked stock, stat tiles, contact
details) and flags missing PRODUCT.md alongside missing DESIGN.md on
substantive work; detected slop rules subtract from the automated eval score;
`npm run test:real:suite` runs the six normal-user prompt cases as release
evidence; and designer-master states that stack choice for greenfield work is
a decision (static HTML is correct for a landing page), not a habit. The
live-run proof of the whole loop is the `verify-furniture` trace:
`taste_review_flagged [reveal-hidden-content, blank-screenshot-band] →` one
repair turn `→ taste_review_passed`, blank fraction 0.68 → 0.08.

A fourth pass raised the target from "not slop" to "reads as designed":
designer-master carries the marks of human-made pages (display scale at 4x
body or more, exactly one deliberate rule-break, uneven section rhythm,
intentional asymmetry, connected sections, finishing details including
favicon and `::selection`, buttons that name their object) and a
named-reference protocol — "in the style of Apple/Linear/Stripe" means
extracting the reference's principles for this product, never copying its
surface. review-skill runs a substitutability test. Two new mechanical tells
joined analyze-layout and the taste review: `missing-page-details`
(title/meta/favicon — every model run to date had shipped without a favicon)
and `display-scale-timid` (largest declared type below 3.5rem on a page with
a hero, clamp-aware).

### The system said "don't" fluently but not "do"

Interviewing the stress model about its own output confirmed the owner's
observation that pages were clean but conservative: the agent reported a
"minefield mentality" (energy spent ruling out banned patterns), no muscle
memory for scroll scenes or product-anchor widgets, CTAs going inert under
the evidence rules, and defensive design to satisfy the delivery checks. The
v3-era system had the missing half — inlined scroll templates, component
patterns, an ambition baseline — which v5 deleted along with the gate.

`skills/expression.md` (fifth registered skill) restores it on v5 terms: a
one-line design read; three ambition dials (VARIANCE/MOTION/DENSITY) with a
bold default for marketing pages recorded in DESIGN.md; a signature-moment
menu (scroll-linked scene, pinned steps, horizontal rail, kinetic type,
figurative illustration, demo widget, reveal index, comparison); working
dependency-free recipes that satisfy the initial-paint and reduced-motion
rules by construction (enhance-only reveal, `animation-timeline: view()`
scene, scroll-snap rail, miniature demo widget); section shapes beyond the
card grid; a fast material-word palette derivation; and honest in-page
actions when no destination exists. The prompt now leads with the positive
move (anchor + signature moment, "boring is also a failure", "checks only
police honesty and function — never boldness") and the fixed section count
was replaced by the question-chain principle. The agent's other request —
a much shorter prompt — was deliberately declined: removing taste from
guaranteed context is what caused the original regression.

### Techniques adopted from commercial builders

A review of leaked commercial design-product prompts and current builder
practice contributed: an explicit aesthetic-family menu and the "what makes
this unforgettable" question in the design read; the anti-distribution
framing (a model converges to the mean unless it commits to one family and
executes precisely — intentionality, not intensity); a characterful-display-
face rule (Inter/Roboto/system are body faces, never the display voice);
"dominant color with sharp accents beats timid even distribution"; a surface-
texture recipe (grain/pattern as the craft middle between flat and
wallpaper); page-load choreography (one orchestrated entrance instead of
scattered micro-interactions); and three new tells — repeated left-border
accent strips (`left-border-accent`), emoji icon systems
(`emoji-as-interface`), and "data slop" in the taxonomy. A scraping toolkit
for social platforms was evaluated and not adopted: the agents already have
a browser, and reference research stays optional.

### New organs (architecture round)

Five structural additions beyond rule tuning: `scripts/design-review-cli.mjs`
(`npm run review:visual`) has a vision-capable model actually look at the
screenshots and fill the shared rubric. It speaks any OpenAI-compatible
vision endpoint directly (LM Studio locally by default; the OMP lm-studio
bridge was silently broken in headless mode) and rejects instead of
hallucinating when the model cannot see the images — DeepSeek V4 Flash
cannot, which explains the historical "agent can't see screenshots" notes.
By owner decision the reviewer defaults to `opencode-go/minimax-m3:high`
(vision-capable, same API family as the default builder) and is fully
customizable for users without that access: `--review-model` /
`DESIGNER_REVIEW_MODEL` accept any vision model, `--review-via api` +
`DESIGNER_REVIEW_BASE_URL` accept any OpenAI-compatible local endpoint, and
`--no-review` skips. A vision-blind reviewer (DeepSeek V4 Flash is one —
`omp models`, images column) is rejected honestly and the report says so,
rather than pretending a review happened. The eval attaches the judgment to
reports and enables the in-session review by default; at runtime the
session-stop taste review runs it only when `DESIGNER_REVIEW_MODEL` is set,
feeding zero-scored categories and top fixes into the same bounded repair
loop: the system sees its own output before shipping. First live review
(local qwen3-vl-30b on the Leak page) returned a grounded "usable but not
good enough" with mixed scores and actionable fixes. `npm run gallery`
builds `test-output/gallery.html` — all runs' screenshots, scores, slop
rules, and reviewer verdicts side by side. designer-master now prescribes a
two-pass build (structure pass, capture, then art pass, with an early hero
checkpoint).
`data/gallery/` ships three complete system-made pages (kinematica, plane,
leak) as calibration references, cited from the expression skill.
`data/qa/overlap-check.js` is a paste-in browser snippet reporting
overlapping or viewport-clipped text (the sticky-nav-over-headline class).
`/designer-vibe` stores persistent per-project owner preferences injected
inside the prompt markers as standing user decisions. A GitHub Actions
workflow runs the full suite and release gate on every push.

## Repair status (v5 audit follow-up)

Tracked against `docs/repair-plan-v5.md`.

- **P0 — Security / release hygiene: done.** A live key that sat in the working
  tree was removed from the repo and relocated outside it; `.env` stays gitignored
  with a safe `.env.example`. `check-release` now scans the repo working tree
  (dotfiles, docs, tests, examples) in addition to the packed tarball, using the
  shared `shared/security.mjs` pattern source. The exposed key must still be
  rotated by the owner.
- **P1 — Core logic correctness: done.** Secret patterns consolidated into
  `shared/security.mjs` (runtime redaction and release scan share one source).
  Plan-intent detection rewritten (robust English, German fallback, no
  "review my existing plan and implement it" false positive). Plan length ceiling
  and prompt now agree, with an explicit detailed-specification bypass.
  `session_stop` delivery checks run only after real file changes, and fallback
  session ids use a monotonic token to avoid same-cwd collisions.
- **P2 — Host-bridge evidence: done.** `scripts/__tests__/host-bridge.test.ts`
  simulates the OMP/Pi host event contract against the real adapters (registration,
  one-time prompt injection, four-skill discovery, plan-continuation exactness,
  delivery-check gating, duplicate-load, OMP/Pi difference, id collision
  resistance). `scripts/e2e-smoke.mjs` reports the same as a smoke run. This is
  simulated, not live-OMP, proof.
- **Real OMP smoke: unverified.** `--real-omp` remains `SKIPPED` without a local
  OMP and model credentials; no automated real-model E2E has passed.
- **Remaining:** P3 documentation consistency (this pass), P4 designer-quality and
  eval rubric, P5 performance/context cost, P6 release readiness (version bump,
  tag, clean-tree publish).
- **Publish: NO-GO** until the exposed key is rotated and git/version hygiene is
  satisfied (clean tree, version bump, tag). Architecture is otherwise sound; a
  return to the v4 gate would be wrong.

## Deliberate limitations

- Static validators cannot prove keyboard behavior, visual hierarchy, or motion
  quality.
- A palette row cannot guarantee accessible usage; component-level contrast still
  needs review.
- Session-stop validation does not prove browser QA.
- MCP handshakes prove server availability, not reference quality.
- A single model/case can catch regressions but cannot establish universal design
  quality.

## Follow-up criteria

Add complexity only when repeated real-agent evidence justifies it. A proposed
rule should include:

1. the concrete failed output,
2. why an existing prompt, review step, or validator cannot catch it,
3. a regression test,
4. before/after runs using the same case and model,
5. an escape path for legitimate exceptions.
