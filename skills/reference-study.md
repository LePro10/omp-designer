---
name: reference-study
description: "Study real websites before designing. Extract design patterns, not content. Learn from the best, don't copy them."
---

# Reference Study — Learn from Real Design

Before designing, study 2-3 real websites relevant to the brief. This teaches the agent what good design looks like for this specific context — not generic rules, but specific patterns.

## When to study

- **Step 3 (Search MCPs)** — before creating the design plan
- Only if the brief is for a new project (not for small fixes)

## How to study

### 1. Pick references
Choose 2-3 sites based on the brief:
- Same industry or audience (e.g., SaaS → study Linear, Notion, Vercel)
- Same design direction (e.g., "premium" → study Apple, Aesop, Dieter Rams)
- Same page type (e.g., e-commerce product page → study Apple Store, Nike)

If the user named specific references, study those. If not, pick based on the design read.

### 2. Take screenshots
Use the browser tool to capture:
- Desktop viewport (1280px wide)
- Mobile viewport (375px wide)
- Full page (scroll capture if available)

### 3. Analyze — extract Design DNA, not content
For each reference site, document:

**Layout:**
- How is the hero structured? (split, centered, asymmetric, full-bleed)
- How many columns? How do they change on mobile?
- What's the section rhythm? (alternating, progressive, uniform)
- How much whitespace? Generous or tight?

**Typography:**
- What fonts are used? (inspect CSS)
- What's the type scale? (measure heading sizes)
- How tight is the tracking? How loose the leading?
- What's the max line length?

**Color:**
- What's the background? (white, off-white, dark, tinted)
- How many accent colors? Where are they used?
- What's the contrast ratio between text and background?

**Imagery:**
- Photography style? (editorial, product-focused, lifestyle, abstract)
- How much of the page is images vs. text?
- Image treatment? (rounded, masked, full-bleed, contained)

**Motion:**
- What animations exist? (scroll reveals, hover effects, transitions)
- How subtle or dramatic?
- What easing? (smooth, bouncy, snappy)

**Copy:**
- How long are headlines? (short punchy vs. descriptive)
- What tone? (technical, friendly, editorial, minimal)
- How much copy per section?

### 4. Synthesize — what applies to THIS project
Don't copy. Extract principles:
- "Linear uses a dark background with high-contrast text and subtle green accents — this creates a focused, technical feel. For our AI tool, a similar approach would work: dark bg, high-contrast text, one accent color."
- "Apple's product pages use massive photography with minimal text — the product IS the design. For our ceramics page, we should let the product photos dominate."

### 5. Write findings to `local://reference-study.md`
Keep it concise — what patterns to adopt, what to avoid, what's specific to this project.

## Rules

- **Study, don't copy.** Extract principles, not pixels. The output should look inspired by, not identical to.
- **Don't study competitors.** Study the best design in the category, not the most similar product.
- **Be specific.** "Apple uses generous whitespace" is vague. "Apple's hero has 120px top padding and 80px bottom padding on desktop" is useful.
- **Note what's NOT there.** What did the reference site NOT include? (No testimonials section, no feature cards, no pricing table.) Sometimes the best design decision is to omit something.

## Why this matters

The agent has never SEEN Apple's website. It only knows rules about what NOT to do. Reference study gives it a mental model of what TO do — specific to this project's context. This is the single biggest gap between "rule-following AI" and "design-thinking AI."
