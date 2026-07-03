---
name: review-skill
description: "Proportional delivery review for implemented frontend work."
---

# Delivery Review

Review the result that exists. Do not regenerate the whole interface to satisfy a
style checklist.

## 1. Automated checks

From the project root:

```bash
node <package>/scripts/fix-ai-slop.mjs --check .
node <package>/scripts/analyze-layout.mjs .
npm run build
```

Warnings require judgment. Blockers require a fix or explicit disclosure.

## 2. Browser task test

Run the page and exercise the primary task:

- navigation and routing,
- menus, forms, tabs, dialogs, filters, or purchase controls that are present,
- loading, empty, error, success, and disabled states where relevant,
- console and network failures.

Do not present a control as complete if it is intentionally static.
An email/contact success state requires a real form action, request, or other
delivery mechanism; local state alone is not a successful submission.

## 3. Responsive review

Inspect at least:

- a narrow phone viewport around 375 px,
- a tablet or narrow laptop viewport,
- a wide desktop viewport.

Check horizontal overflow, text wrapping, navigation, content priority, touch
targets, image cropping, tables, charts, and fixed/sticky elements.

## 4. Accessibility review

- One clear page-level heading and logical hierarchy.
- Useful landmarks and labels.
- Visible keyboard focus and sensible focus order.
- No hover-only information.
- Adequate text and control contrast.
- Form errors are associated with their fields.
- Reduced motion shows all content and preserves functionality.

## 5. Product-specific review

Ask:

- Does the information architecture answer the audience's real questions?
- Which sections or interactions could be transplanted unchanged to an unrelated
  product?
- Did multiple sections default to the same heading-plus-card-grid composition?
  If so, keep only the repetitions justified by independent comparable items.
- Is every factual claim sourced?
- Is invented preview content visibly labelled as an example or demo?
- Does every capability verb map to the user's closed fact set, or did the design
  infer familiar category features such as sync, offline mode, automation, voice,
  assignment, platform support, or team limits?
- Does imagery explain the product or merely occupy space?
- Does each prominent visual decision have a product, content, interaction, or
  brand rationale?

Fix the smallest underlying cause. Do not chase novelty for its own sake.

## 6. Report

Report:

- build and validator commands actually run,
- browser viewports and primary flows actually checked,
- issues fixed,
- remaining blockers and warnings,
- assumptions that still need user confirmation.

Never invent a numeric design score without a comparison method and evidence.
