/**
 * Scroll Component Templates — Reusable patterns for dramatic scroll moments.
 * Copy-paste these into your project and customize the content.
 * 
 * Usage: Import the pattern you need, pass your content as props.
 * All patterns respect prefers-reduced-motion.
 */

// =============================================================================
// 1. PINNED SCROLL — Content stays fixed while user scrolls through steps
// Use for: product walkthroughs, timeline narratives, storytelling
// =============================================================================

/*
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';

interface PinnedScrollStep {
  title: string;
  description: string;
  visual?: React.ReactNode;
}

interface PinnedScrollProps {
  steps: PinnedScrollStep[];
  heading?: string;
}

export function PinnedScroll({ steps, heading }: PinnedScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Map scroll progress to step index
  const stepIndex = useTransform(scrollYProgress, [0, 1], [0, steps.length - 1]);

  return (
    <section ref={containerRef} className="relative h-[300vh]">
      <div className="sticky top-0 h-screen flex items-center overflow-hidden">
        {heading && (
          <div className="absolute top-8 left-0 right-0 text-center z-10">
            <h2 className="text-3xl font-bold">{heading}</h2>
          </div>
        )}
        <div className="mx-auto max-w-7xl px-6 w-full">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              style={{
                opacity: useTransform(stepIndex, [i - 0.5, i, i + 0.5], [0, 1, 0]),
              }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="max-w-2xl text-center">
                <h3 className="text-2xl font-bold mb-4">{step.title}</h3>
                <p className="text-lg text-muted-fg">{step.description}</p>
                {step.visual && <div className="mt-8">{step.visual}</div>}
              </div>
            </motion.div>
          ))}
        </div>
        {/* Progress indicator */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-2">
          {steps.map((_, i) => (
            <motion.div
              key={i}
              style={{
                opacity: useTransform(stepIndex, [i - 0.3, i, i + 0.3], [0.3, 1, 0.3]),
                scale: useTransform(stepIndex, [i - 0.3, i, i + 0.3], [0.8, 1.2, 0.8]),
              }}
              className="w-2 h-2 rounded-full bg-primary"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
*/

// =============================================================================
// 2. HORIZONTAL SCROLL — Vertical scroll drives horizontal movement
// Use for: portfolios, galleries, product showcases
// =============================================================================

/*
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';

interface HorizontalScrollProps {
  items: { title: string; description: string; image?: string }[];
  heading?: string;
}

export function HorizontalScroll({ items, heading }: HorizontalScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const x = useTransform(scrollYProgress, [0, 1], ['0%', `-${(items.length - 1) * 100}%`]);

  return (
    <section ref={containerRef} className="relative h-[300vh]">
      <div className="sticky top-0 h-screen overflow-hidden">
        {heading && (
          <div className="absolute top-8 left-0 right-0 text-center z-10">
            <h2 className="text-3xl font-bold">{heading}</h2>
          </div>
        )}
        <motion.div
          style={{ x }}
          className="flex h-full items-center gap-8 px-16"
        >
          {items.map((item, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-[80vw] max-w-4xl h-[70vh] rounded-2xl border border-border bg-card p-8 flex flex-col justify-center"
            >
              {item.image && (
                <img src={item.image} alt={item.title} className="w-full h-48 object-cover rounded-xl mb-6" />
              )}
              <h3 className="text-2xl font-bold mb-4">{item.title}</h3>
              <p className="text-muted-fg">{item.description}</p>
            </div>
          ))}
        </motion.div>
        {/* Progress bar */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-48 h-1 bg-muted rounded-full overflow-hidden">
          <motion.div
            style={{ width: useTransform(scrollYProgress, [0, 1], ['0%', '100%']) }}
            className="h-full bg-primary rounded-full"
          />
        </div>
      </div>
    </section>
  );
}
*/

// =============================================================================
// 3. PARALLAX HERO — Background moves slower than foreground
// Use for: hero sections, large imagery, atmospheric backgrounds
// =============================================================================

/*
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';

interface ParallaxHeroProps {
  headline: string;
  subtext: string;
  children?: React.ReactNode;
}

export function ParallaxHero({ headline, subtext, children }: ParallaxHeroProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);

  return (
    <section ref={ref} className="relative h-screen overflow-hidden">
      {/* Background — moves slower */}
      <motion.div
        style={{ y: bgY }}
        className="absolute inset-0 -top-[30%]"
      >
        {children}
      </motion.div>

      {/* Foreground content */}
      <motion.div
        style={{ opacity, scale }}
        className="relative z-10 flex h-full items-center justify-center text-center px-6"
      >
        <div className="max-w-3xl">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            {headline}
          </h1>
          <p className="text-xl text-muted-fg max-w-2xl mx-auto">
            {subtext}
          </p>
        </div>
      </motion.div>
    </section>
  );
}
*/

// =============================================================================
// 4. SCROLL PROGRESS BAR — Thin bar at top showing scroll progress
// Use for: any page, adds polish
// =============================================================================

/*
import { motion, useScroll } from 'motion/react';

export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();

  return (
    <motion.div
      style={{ scaleX: scrollYProgress }}
      className="fixed top-0 left-0 right-0 h-1 bg-primary origin-left z-50"
    />
  );
}
*/

// =============================================================================
// 5. STAGGERED REVEAL — Elements animate in sequence on scroll
// Use for: feature grids, testimonial cards, any list of items
// =============================================================================

/*
import { motion } from 'motion/react';

interface StaggeredRevealProps {
  children: React.ReactNode[];
  stagger?: number;
  direction?: 'up' | 'left' | 'right';
}

export function StaggeredReveal({ children, stagger = 0.1, direction = 'up' }: StaggeredRevealProps) {
  const offsets = {
    up: { y: 40 },
    left: { x: -40 },
    right: { x: 40 },
  };

  return (
    <>
      {children.map((child, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, ...offsets[direction] }}
          whileInView={{ opacity: 1, x: 0, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{
            duration: 0.5,
            delay: i * stagger,
            ease: [0.23, 1, 0.32, 1],
          }}
        >
          {child}
        </motion.div>
      ))}
    </>
  );
}
*/
