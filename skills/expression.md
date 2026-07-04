---
name: expression
description: "Choose and build the page's signature moment: design read, ambition dials, and working construction recipes. Read for substantive new pages."
---

# Expression

The anti-slop rules say what to avoid. This skill is what to do. A memorable
page is a strong direction plus **one signature moment** plus disciplined
support. Boring is also a failure mode: a clean page nobody remembers did not
serve the brand.

## 1. Design read

One line before any code, recorded in DESIGN.md:

> Reading this as: `<page kind>` for `<audience>`, `<vibe>` language,
> signature moment: `<pattern>`.

The audience picks the aesthetic, not your comfort. Vibe words in the brief
("bold", "calm", "brutalist", "like Apple") override everything here.

You are a model: left alone, you converge to the distribution mean. Counter
it by committing to one aesthetic family and executing it precisely —
intentionality, not intensity:

> brutally minimal · maximalist chaos · retro-futuristic · organic/natural ·
> luxury/refined · playful/toy-like · editorial/magazine · brutalist/raw ·
> art-deco/geometric · soft/pastel · industrial/utilitarian · handcraft/warm

Then answer in one sentence: **what makes this page unforgettable — the one
thing a visitor will remember?** If the answer is "the palette" or "the
spacing", you don't have one yet.

Typography carries the family: pick a characterful display face and pair it
with a refined body face. Inter, Roboto, Arial, and system-ui are body
options, never the display voice. Dominant color with sharp accents
outperforms a timid, evenly-distributed palette.

Calibration: `data/gallery/` (next to the palette CSVs) holds three complete
pages that meet this system's bar, one per family direction. Open the closest
one to your read before building — then make something that could not be
mistaken for it.

## 2. Ambition dials

Set three dials (1–10) from the design read and write them in DESIGN.md:

- `VARIANCE` — 1 perfect symmetry, 10 art chaos
- `MOTION` — 1 static, 10 cinematic
- `DENSITY` — 1 gallery-airy, 10 cockpit-packed

| Read | VARIANCE | MOTION | DENSITY |
| --- | --- | --- | --- |
| consumer/brand landing, portfolio (default) | 7–8 | 5–7 | 3–5 |
| editorial, long-form | 5–6 | 3–4 | 5–6 |
| developer tool, product docs | 5–6 | 3–5 | 5–7 |
| trust-critical, public sector, regulated | 3–4 | 2–3 | 4–5 |

Bold is the default for marketing pages. Low dials must be a reasoned
decision recorded in DESIGN.md, never silent caution.

## 3. Signature moment — pick exactly one

| Pattern | Carries the page when |
| --- | --- |
| Scroll-linked narrative scene | the product has stages, a process, or a transformation |
| Pinned scene with progressing steps | a multi-step story deserves one held viewport |
| Horizontal rail (native scroll-snap) | a collection browses better sideways: work, products, menu |
| Kinetic type hero | the voice is the product: studios, portfolios, campaigns |
| Figurative CSS/SVG illustration | a physical thing anchors a local or product brand |
| Interactive demo widget | the product is a tool — let visitors touch a real miniature |
| Hover/press-reveal index | case studies or a work list with strong imagery |
| Comparison interaction (before/after, A/B slider) | the value is a visible difference |

One, not three. The signature moment gets the drama; every other section
supports quietly. If everything is dramatic, nothing is.

## 4. Recipes

All recipes are dependency-free and obey the house rules: legible at initial
paint, complete under reduced motion, equivalent on mobile.

### Enhance-only reveal (the only allowed reveal pattern)

```css
.reveal { opacity: 1; }                       /* legible without JS */
@media (prefers-reduced-motion: no-preference) {
  .js .reveal { opacity: 0; transform: translateY(12px);
                transition: opacity .5s ease, transform .5s ease; }
  .js .reveal.in { opacity: 1; transform: none; }
}
```

```js
document.documentElement.classList.add("js");  // no-JS keeps content visible
const io = new IntersectionObserver((es) =>
  es.forEach((e) => e.target.classList.add("in")), { rootMargin: "-10% 0px" });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
```

### Scroll-linked scene (progressive enhancement)

```css
@supports (animation-timeline: view()) {
  .stage { animation: stage-grow linear both; animation-timeline: view(); }
}
@keyframes stage-grow { from { scale: .92; } to { scale: 1; } }
```

Browsers without support simply show the finished state. Use for one scene,
not every section.

### Pinned scene

A tall section (`min-height: 250vh`) with a `position: sticky; top: 0`
stage; scroll position (via the observer) switches which step is active.
Steps must be reachable by anchor links and keyboard. Mobile: render the
steps stacked, unpinned.

### Horizontal rail

```css
.rail { display: flex; gap: 1rem; overflow-x: auto;
        scroll-snap-type: x mandatory; }
.rail > * { scroll-snap-align: start; flex: 0 0 min(70vw, 22rem); }
```

Native scroll — never hijack the wheel. Add edge fades and visible
affordance; keyboard and touch work for free. The same pattern works at
375px.

### Kinetic type

Split the display headline into `<span>` letters (aria-hidden, with a
readable duplicate for assistive tech). On `pointermove` or hover, apply
small per-letter transforms (±4px, ±2deg, 120–200ms). Reduced motion: static.
The move must fit the voice — playful for a studio, restrained for luxury.

### Figurative CSS/SVG illustration

Draw a real object from its true proportions as layered shapes: body, parts,
one light direction, soft contact shadow. Name every layer's class after the
part it depicts (`.drum`, `.blade`, `.crust`, `.spout`) — if you cannot name
a layer, delete it. This is the opposite of a gradient blob: it depicts,
labels, and explains.

### Surface texture (atmosphere without wallpaper)

Flat is safe; wallpaper is slop; texture is the craft middle. One texture per
page, quiet enough to miss on first glance:

```css
/* grain: inline SVG turbulence, no asset needed */
.grain::after { content: ""; position: absolute; inset: 0; opacity: .06;
  pointer-events: none; background-image:
  url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
```

Alternatives: a repeating-gradient hairline pattern, one layered translucent
shape behind the hero, a paper tone instead of pure white. The texture must
come from the product's world (grain for bakeries and print, blueprint grid
for engineering, halftone for editorial).

### Page-load choreography

One orchestrated entrance beats scattered micro-interactions: on load,
stagger the hero elements (label → headline → supporting line → anchor
visual) by 80–120ms each, 300–500ms per element, once. CSS-only:

```css
@media (prefers-reduced-motion: no-preference) {
  .enter { animation: rise .5s cubic-bezier(.2,.7,.3,1) both; }
  .enter:nth-child(2) { animation-delay: .1s; }
  .enter:nth-child(3) { animation-delay: .2s; }
}
@keyframes rise { from { opacity: 0; translate: 0 14px; } }
```

Runs immediately at load, so captures and no-JS render the finished state;
reduced motion skips it entirely. Do not reuse this on scroll — it is an
entrance, not a scroll pattern.

### Micro-interaction set (pick two or three, apply everywhere)

- links: underline slides in from left, 150ms
- buttons: `scale(.97)` on press, shadow lift on hover
- cards: 4–6px lift with shadow deepening, 180ms
- inputs: border color + subtle ring on focus (always visible)

Consistency makes these read as craft; variety makes them read as noise.

### Miniature interactive widget (product anchor for tools)

A self-contained ~40-line widget beats a fake screenshot. Pattern: one state
variable, three or four fake-but-labelled records, one interaction.

```html
<div class="widget" data-demo>
  <div class="widget-bar"><span class="dot"></span> roast planner — demo</div>
  <button class="chip" data-f="all">All</button>
  <button class="chip" data-f="light">Light</button>
  <ul class="lots"><!-- 4 hardcoded items with data-kind --></ul>
</div>
<script>
  document.querySelectorAll(".chip").forEach((chip) =>
    chip.addEventListener("click", () => {
      document.querySelectorAll(".lots > li").forEach((li) =>
        li.hidden = chip.dataset.f !== "all" && li.dataset.kind !== chip.dataset.f);
    }));
</script>
```

Style it with the page's own tokens, badge it "demo", and it is both the
imagery and the proof.

## 4b. Section shapes beyond the card grid

When two sections both want to be grids, give one of these shapes to the
content that fits it:

- **Alternating offset split** — media and text swap sides, media bleeds
  past the container edge.
- **Single-column narrative** — 60–72ch prose with inset callouts or pull
  quotes; best for story and philosophy sections.
- **Full-bleed statement block** — one sentence, huge type, viewport-tall,
  background from the palette; the page's breathing moment.
- **Spec / data table** — monospace or tabular numerals, hairline rules;
  specifics read as confidence.
- **Timeline rows** — number + title + body per row, connected by a rule;
  for process and history.
- **Oversized index list** — big numbered entries that are links (works,
  menu items, chapters); hover reveals detail.
- **Horizontal rail** — see recipe above.
- **Diagonal / staggered stack** — items step down the page with offset
  baselines; earns VARIANCE 8+.

## 4c. Fast palette derivation

The color CSV is an optional index, not a gate. The fast protocol:

1. Name one material or environment word from the product's world
   (espresso, anodized aluminium, flour, moss, blueprint, neon sign).
2. Pull two colors from that word — one surface, one ink/accent — plus
   neutrals derived from the surface tone (not pure gray).
3. Use them roughly 80/20: the surface family carries most of the area, the
   accent appears only where it means something (actions, highlights, the
   signature moment).
4. Check the real text/background pairs for contrast before shipping.

## 4d. Actions without a destination

When the user supplied no shop, form endpoint, or signup service, do not
ship a gray "Learn more". Make the primary action an honest in-page action
with personality: jump to the collection, open the demo widget, reveal the
contact details, start the comparison. Name the object ("See the three
roasts", "Try the planner") — an inert page is a copy failure, not an
evidence rule.

## 5. Support discipline

Outside the signature moment: fades only, staggering only inside grids,
durations from the motion skill, one scroll narrative per site. If the
signature moment is motion-heavy, everything else stays still.

## 6. Self-check

- Does the signature moment express *this* product, or would it fit any site?
- Initial paint legible, reduced-motion complete, mobile equivalent?
- Would removing the moment make the page forgettable? If not, it was not
  the signature — find the real one.
