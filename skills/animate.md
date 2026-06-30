---
name: animate
description: Animation patterns and best practices for Next.js/React applications. Use this skill when implementing animations, transitions, hover effects, page transitions, modals, or any motion in React components. Based on Emil Kowalski's "Animations on the Web" course.
---

# Next.js Animations

## Overview

This skill provides comprehensive guidance for implementing smooth, performant, and accessible animations in Next.js and React applications. It covers CSS animations, Framer Motion, easing principles, and accessibility considerations.

## Quick Reference

### Easing Cheat Sheet

| Animation Type | Easing | Duration |
|----------------|--------|----------|
| Element entering | `ease-out` | 200-300ms |
| Element moving on screen | `ease-in-out` | 200-300ms |
| Element exiting | `ease-in` | 150-200ms |
| Hover effects | `ease` | 150ms |
| Opacity only | `linear` | varies |

### CSS Custom Properties (Recommended)

```css
:root {
  --ease-out-quint: cubic-bezier(.23, 1, .32, 1);
  --ease-in-out-cubic: cubic-bezier(.645, .045, .355, 1);
  --ease-out-cubic: cubic-bezier(.33, 1, .68, 1);
}
```

## Common Animation Patterns

### 1. Hover Lift Effect

```css
.card {
  transition: transform 200ms var(--ease-out-quint),
              box-shadow 200ms var(--ease-out-quint);
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
}
```

### 2. Button Press

```css
.button {
  transition: transform 100ms ease-out;
}
.button:active {
  transform: scale(0.97);
}
```

### 3. Fade In on Mount (Framer Motion)

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: [.23, 1, .32, 1] }}
>
  Content
</motion.div>
```

### 4. Modal with Exit Animation

```tsx
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  )}
</AnimatePresence>
```

### 5. Tab Indicator (Shared Layout)

```tsx
{tabs.map(tab => (
  <button key={tab} onClick={() => setActive(tab)} className="relative px-4 py-2">
    {tab}
    {active === tab && (
      <motion.div
        layoutId="tab-indicator"
        className="absolute inset-0 bg-blue-500 rounded -z-10"
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />
    )}
  </button>
))}
```

### 6. Staggered List Animation

```tsx
const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
}

<motion.ul variants={container} initial="hidden" animate="visible">
  {items.map(i => <motion.li key={i} variants={item}>{i}</motion.li>)}
</motion.ul>
```

## Golden Rules

1. **Exits faster than enters**: Exit animations should be ~75% of enter duration
2. **Only animate transform and opacity**: These are GPU-accelerated
3. **200-300ms is the sweet spot**: Most animations should be in this range
4. **Always respect prefers-reduced-motion**: See accessibility section in references
5. **Use springs for interruptible animations**: Better UX when users interrupt

## Reusable Patterns

Use the inline patterns above as the source of truth. The installed skill includes `references/` documents, but not a guaranteed `examples/` directory. Do not stop to look for missing example files.

Before adding animation code to a component, choose one pattern:

| Pattern | Use for | Avoid when |
|---------|---------|------------|
| Fade-up reveal | Section entrances | Every tiny child element |
| Staggered list | Cards, logos, feature lists | Large paragraphs |
| Scroll-linked transform | Storytelling, hero depth | Core text readability |
| Shared layout | Tabs, nav indicators | Pure decoration |
| CSS hover transition | Buttons/cards | Complex state changes |

## References

For detailed documentation, read the reference files:

- `references/easing-and-timing.md` - Easing functions, timing guidelines, spring configuration
- `references/css-animations.md` - Transforms, transitions, keyframes, clip-path
- `references/framer-motion.md` - Motion components, AnimatePresence, variants, layout animations, hooks
- `references/performance-accessibility.md` - 60fps optimization, prefers-reduced-motion, accessibility

## When to Use What

| Scenario | Recommended Approach |
|----------|---------------------|
| Simple hover effects | CSS transitions |
| Enter/exit animations | Motion v12 + AnimatePresence |
| Layout changes | Motion `layout` prop |
| Shared element transitions | Motion `layoutId` |
| Scroll-linked animations | Motion `scroll()` (native ScrollTimeline) |
| Complex orchestrated animations | Motion variants |
| Drag interactions | Motion drag gestures |
| Scroll-pin / horizontal-pan | GSAP ScrollTrigger (for advanced scrub/pin) |
| Performance-critical | CSS-only with transforms |
## Dependencies

For Motion v12 (preferred):
```bash
npm install motion
```

For legacy Framer Motion projects:
```bash
pnpm add framer-motion react-use-measure usehooks-ts
```

## Motion v12 — Production-Grade Library (Preferred)

**motion.dev** (v12, prev. Framer Motion) is the recommended animation library.
All patterns above work with `motion/react` — same API (`motion.div`, `AnimatePresence`, `layoutId`, `useScroll`).

### 400+ Copy-Paste Examples

Browse https://examples.motion.dev/react before writing custom animation code.

| Pattern | Example URL |
|---------|-------------|
| Scroll velocity 3D planes | `examples.motion.dev/react/scroll-velocity-linked-offset` |
| Typewriter text | `examples.motion.dev/react/typewriter` |
| iOS-style folder expand | `examples.motion.dev/react/ios-app-folder` |
| iOS pointer animation | `examples.motion.dev/react/ios-pointer` |
| Skeleton shimmer | `examples.motion.dev/react/skeleton-shimmer` |
| Floating action button | `examples.motion.dev/react/floating-action-button` |

### API Differences from Framer Motion

| Feature | Framer Motion (old) | Motion v12 (new) |
|---------|--------------------|--------------------|
| Package | `framer-motion` | `motion` |
| React import | `import { motion } from "framer-motion"` | `import { motion } from "motion/react"` |
| Bundle size | ~31 KB gzipped | ~5 KB gzipped (tree-shaken) |
| Scroll-driven | `useScroll` | `scroll()` (native ScrollTimeline) |
| Independent transforms | wrappers needed | native `x`, `y`, `rotate`, `scale` on same element |

### Dependencies

```bash
npm install motion
# No peer deps. Replaces framer-motion entirely.
```
