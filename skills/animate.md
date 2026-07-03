---
name: animate
description: "Optional motion guidance. Read only when meaningful animation is requested or already exists."
---

# Motion

Motion must communicate state, continuity, hierarchy, progress, or spatial
relationship. If it does none of those, remove it.

## Choose the smallest mechanism

| Need | Mechanism |
| --- | --- |
| hover, focus, press | CSS transition |
| mount and exit | Motion `AnimatePresence` |
| layout continuity | Motion `layout` or `layoutId` |
| simple scroll progress | CSS scroll-driven animation or Motion `useScroll` |
| complex product narrative | a carefully tested pinned scene |

Use the project's existing library. For new React projects, `motion/react` is a
reasonable default only when CSS is insufficient.

## Timing

Treat these as starting ranges, not validator laws:

- press feedback: 80 to 140 ms,
- hover and focus: 120 to 220 ms,
- UI state transition: 180 to 320 ms,
- content entrance: 220 to 450 ms,
- large narrative transition: 350 to 800 ms.

Exits are usually shorter than entrances. Use a small, documented easing set.
Avoid `transition: all`.

## Scroll behavior

- Use at most one major scroll-driven scene unless the brief is explicitly
  narrative.
- Apply that budget across a multi-page site, not once per route. A request for
  "scroll effects" does not automatically authorize a major scrubbed scene on
  every page.
- Do not hide essential content behind a viewport trigger.
- Do not override native scroll.
- A desktop pinned or horizontal sequence needs a simple mobile alternative.
- Test keyboard access and direct links to content inside the sequence.

## Reduced motion

Under `prefers-reduced-motion: reduce`:

- remove large translation, parallax, auto-rotation, and scrubbed scenes,
- show final content immediately,
- preserve state feedback with short opacity changes where useful,
- stop nonessential looping animation.

## Performance

Prefer opacity and transforms. Measure rather than assuming GPU acceleration makes
an effect cheap. Avoid permanent `will-change`, per-frame React state, large blur
layers, and many independent scroll observers.

## Verification

Test the final behavior in a browser with normal and reduced motion, mouse and
keyboard, narrow and wide layouts. Screenshots alone cannot validate interaction.
