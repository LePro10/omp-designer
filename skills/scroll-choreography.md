---
name: scroll-choreography
description: "Design scroll as narrative, not decoration. Every scroll-triggered animation should tell the story of the product."
---

# Scroll Choreography — Tell a Story with Scroll

Scroll is not just "elements appearing as you scroll down." Scroll is a narrative medium — it controls pacing, reveals information, and guides attention. This skill teaches the agent to design scroll as storytelling.

## The Narrative Structure

A well-designed page scroll follows a story arc:

```
1. CONTEXT     — What is this? (Hero: headline + subtext + CTA)
2. CREDIBILITY  — Why trust this? (Logo wall, testimonials, stats)
3. EXPLORATION  — What does it do? (Features, product demo, gallery)
4. PROOF        — Show me it works (Case studies, metrics, before/after)
5. DECISION     — What now? (Pricing, CTA, FAQ)
```

Each section should feel like the NEXT chapter, not the same chapter repeated.

## Scroll Patterns — When to Use What

### Simple scroll reveal (CSS or Motion)
**When:** Most content sections. Elements fade in as they enter the viewport.
**How:** `whileInView={{ opacity: 1, y: 0 }}` with `viewport={{ once: true, margin: "-80px" }}`
**Duration:** 300-500ms, ease-out
**Use for:** Feature cards, testimonials, stats, text blocks

### Staggered children (Motion variants)
**When:** Grids of similar items (feature cards, pricing tiers, testimonials).
**How:** Parent container staggers children by 50-100ms.
**Use for:** Feature grids, pricing tables, testimonial cards

### Pinned scroll (GSAP ScrollTrigger)
**When:** You want to tell a multi-step story while the user scrolls.
**How:** A section pins to the viewport while content changes inside it.
**Use for:** Product walkthroughs, timeline narratives, comparison sequences
**Example:** Apple's iPhone camera section — pinned while features cycle through

### Horizontal scroll (GSAP ScrollTrigger)
**When:** You have many items that benefit from horizontal browsing.
**How:** Vertical scroll triggers horizontal movement.
**Use for:** Portfolios, galleries, team members, product showcases
**Caution:** Must work with keyboard and touch. Always add scroll indicators.

### Parallax layers
**When:** You want depth — foreground moves faster than background.
**How:** Different `scroll()` speeds for different layers.
**Use for:** Hero sections, large imagery, atmospheric backgrounds
**Caution:** Subtle only. 10-20% speed difference max. Respect prefers-reduced-motion.

### Progress-linked animation
**When:** An animation should complete exactly when a section finishes scrolling.
**How:** `scroll()` progress drives animation progress (0→1).
**Use for:** Progress bars, section transitions, data visualization reveals

## Rules

### Motion must explain, not decorate
Every animation needs a one-sentence justification:
- ✅ "The feature cards stagger in to show there are multiple features, not just one"
- ✅ "The hero parallax creates depth, making the product feel tangible"
- ❌ "The heading bounces because it looks cool"
- ❌ "Every element fades in from the bottom because that's what AI does"

### Fade-in-up is NOT a default
The most overused AI animation is `fade-in-up` on every element. Ban it as a default. Instead:
- Use `fade-in` (no movement) for text blocks
- Use `scale-up` for images and cards
- Use `slide-in-from-left/right` for split layouts
- Use `stagger` for grids
- Reserve `fade-in-up` for elements that genuinely move upward (like a CTA rising from below)

### One dramatic moment per page
Pick ONE section to be the "wow" moment — the pinned scroll, the horizontal gallery, the parallax hero. Everything else should be subtle. If every section has dramatic animation, nothing is dramatic.

### Performance first
- Only animate `transform` and `opacity` (GPU-accelerated)
- Use `will-change` sparingly (only on elements that will animate)
- Test on mobile — scroll performance degrades with too many animated elements
- Respect `prefers-reduced-motion` — disable all scroll animations

### Mobile considerations
- Pinned scroll doesn't work well on mobile (touch scrolling conflicts) — use simple reveal instead
- Horizontal scroll needs visible indicators (arrows, dots, or peek of next item)
- Parallax is less effective on small screens — reduce or disable
- Touch interactions need larger targets and more forgiving hit areas

## Anti-patterns

- ❌ Every section fades in from the bottom — monotonous, looks AI-generated
- ❌ Infinite loop animations — marquee is OK, bouncing buttons are not
- ❌ Animations that prevent interaction — don't block clicks during animation
- ❌ Scroll-jacking — NEVER override native scroll behavior
- ❌ Heavy scroll listeners — use CSS scroll-driven animations or Motion's `scroll()` for performance
- ❌ No reduced-motion support — this is an accessibility requirement, not optional
