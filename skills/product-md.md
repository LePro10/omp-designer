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

## Content facts
Real facts about the product — prices, names, numbers, features. The agent uses these instead of inventing.
If the user didn't provide facts, mark sections as `[NEEDS INPUT]` — don't fabricate.

## Constraints
Technical constraints (framework, existing codebase), brand constraints (existing logo, colors), audience constraints (accessibility requirements, regulated industry).
```

## Rules

- **Never invent facts.** If the user didn't provide a price, don't make one up. Mark it `[NEEDS INPUT]`.
- **Keep it short.** PRODUCT.md is a reference, not a novel. 20-40 lines max.
- **Read it before every step.** Every design decision should trace back to PRODUCT.md.
- **Update it.** If the user says "actually, the audience is enterprise, not indie," update PRODUCT.md immediately.

## Why this matters

Without PRODUCT.md, the agent treats each turn as a fresh conversation. The brief gets lost, and the agent defaults to generic patterns. PRODUCT.md is the persistent memory that keeps the design grounded in the actual product.
