---
name: product-md
description: "Capture and maintain a PRODUCT.md that persists the brief across turns. Every design decision references this file."
---

# PRODUCT.md — Brief Capture

Before any design work, write a `PRODUCT.md` to `local://PRODUCT.md`. This file captures everything the agent needs to know about the product. Every subsequent step reads it.

## When to write

- **Step 1 (Assess)** — immediately after the design read
- **Update** if the user provides new information mid-project

## What to capture

```markdown
# PRODUCT.md

## What it is
One sentence. What does this product do? Who is it for?

## Target audience
Who will use this? Be specific — not "everyone." Age, role, technical level, context of use.

## Brand voice
How should it sound? Pick 3 adjectives from this list (or define your own):
- Calm / Clinical / Precise / Warm / Playful / Bold / Quiet / Confident / Technical / Human / Editorial / Premium / Accessible / Energetic / Minimal

## Key messages
What are the 2-3 things the user MUST take away? Not features — outcomes.
Example: "This tool saves me 2 hours a week" not "AI-powered task automation."

## Anti-references
What should this NOT look like? What vibes are wrong?
Example: "Not corporate, not startup-bro, not purple-gradient-AI-slop"

## User-provided facts
Only facts explicitly provided by the user. Prefix each line with `Source: user`.
Example: `- Source: user — Price is $49/month`

## Missing facts
Facts needed for the design but not provided. Use `[NEEDS INPUT]`.
Example: `- Price: [NEEDS INPUT]`

## Working assumptions
Soft design assumptions allowed for layout/mood only. Never put prices, metrics, customer counts, awards, testimonials, or benchmark numbers here.

## EVIDENCE.md (write alongside PRODUCT.md)

Track every factual claim in a separate EVIDENCE.md:

```markdown
# EVIDENCE.md

| Claim | Source | Confidence | Allowed wording | Usage |
|-------|--------|------------|-----------------|-------|
| Price $49/month | user brief | high | exact wording only | CTA |
| ISO 27001 | missing | 0 | MUST NOT USE | — |
| 10,000+ users | missing | 0 | MUST NOT USE | — |
| Free shipping | missing | 0 | MUST NOT USE | — |
```

Rules:
- Every externally verifiable claim (price, metric, count, certification, testimonial, award) must appear here.
- If the user didn't provide it: confidence = 0, allowed wording = "MUST NOT USE".
- The validator scripts check src/ against this file. Claims with confidence 0 that appear in code will be flagged.

## Constraints

## Rules

- **Never invent facts.** If the user didn't provide a price, don't make one up. Mark it `[NEEDS INPUT]`.
- **Keep it short.** PRODUCT.md is a reference, not a novel. 20-40 lines max.
- **Read it before every step.** Every design decision should trace back to PRODUCT.md.
- **Update it.** If the user says "actually, the audience is enterprise, not indie," update PRODUCT.md immediately.

## Why this matters

Without PRODUCT.md, the agent treats each turn as a fresh conversation. The brief gets lost, and the agent defaults to generic patterns. PRODUCT.md is the persistent memory that keeps the design grounded in the actual product.
