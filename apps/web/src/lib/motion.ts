/**
 * OMEGA PROTOCOL — S1: Visual OS — Shared Framer Motion presets
 *
 * Import these constants across portal pages to ensure uniform spring physics,
 * consistent stagger timing, and Apple-grade entrance choreography.
 */

import type { Variants, Transition, TargetAndTransition } from 'framer-motion';

// ── Spring configs ────────────────────────────────────────────────────────────

/** Smooth, gentle spring — ideal for page-level transitions and large panels */
export const springGentle: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 28,
  mass: 0.85,
};

/** Snappy spring — ideal for list items, KPI cards, quick UI feedback */
export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
  mass: 0.7,
};

/** Bouncy spring — modals, drawers, tooltips entering */
export const springBouncy: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 30,
  mass: 0.6,
};

/** Near-instant spring — micro-interactions (toggles, chips, badges) */
export const springInstant: Transition = {
  type: 'spring',
  stiffness: 700,
  damping: 40,
  mass: 0.5,
};

/** Elastic spring — drag release, magnetic button pop */
export const springElastic: Transition = {
  type: 'spring',
  stiffness: 350,
  damping: 20,
  mass: 0.8,
};

// ── Easing presets ────────────────────────────────────────────────────────────

/** Apple's standard ease — used for most UI transitions */
export const easeApple = [0.16, 1, 0.3, 1] as const;

/** Ease-out expo — for elements entering from off-screen */
export const easeOut = [0.0, 0.0, 0.2, 1] as const;

/** Ease-in-out standard — for shared layout animations */
export const easeInOut = [0.4, 0, 0.2, 1] as const;

/** Ease-in — for elements exiting */
export const easeIn = [0.4, 0, 1, 1] as const;

// ── Duration presets ──────────────────────────────────────────────────────────

export const durationFast = 0.18;
export const durationBase = 0.32;
export const durationSlow = 0.5;
export const durationPage = 0.42;

// ── Variant factories ─────────────────────────────────────────────────────────

/** Fade + slide up — standard card entrance */
export const fadeUp = (delay = 0, distance = 14): Variants => ({
  hidden: { opacity: 0, y: distance },
  visible: {
    opacity: 1,
    y: 0,
    transition: { ...springSnappy, delay },
  },
  exit: { opacity: 0, y: -8, transition: { duration: durationFast, ease: easeIn } },
});

/** Fade + slide down — dropdowns, notifications entering from top */
export const fadeDown = (delay = 0): Variants => ({
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0, transition: { ...springSnappy, delay } },
  exit: { opacity: 0, y: -8, transition: { duration: durationFast, ease: easeIn } },
});

/** Scale in — modals, popovers, command palettes */
export const scaleIn = (delay = 0): Variants => ({
  hidden: { opacity: 0, scale: 0.93 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { ...springBouncy, delay },
  },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15, ease: easeIn } },
});

/** Slide from right — drawers, detail panels */
export const slideRight = (delay = 0): Variants => ({
  hidden: { opacity: 0, x: 32 },
  visible: { opacity: 1, x: 0, transition: { ...springGentle, delay } },
  exit: { opacity: 0, x: 24, transition: { duration: durationFast, ease: easeIn } },
});

/** Slide from left — back-navigation, sidebar items */
export const slideLeft = (delay = 0): Variants => ({
  hidden: { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0, transition: { ...springGentle, delay } },
  exit: { opacity: 0, x: -16, transition: { duration: durationFast, ease: easeIn } },
});

/** Backdrop blur-in — overlays and modal scrims */
export const backdropIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: durationBase, ease: easeOut } },
  exit: { opacity: 0, transition: { duration: durationFast, ease: easeIn } },
};

// ── Stagger containers ────────────────────────────────────────────────────────

/** Stagger container — wraps a list of items with coordinated entrance */
export const staggerContainer = (staggerChildren = 0.07, delayChildren = 0): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren, delayChildren },
  },
  exit: {},
});

/** Stagger item — child of staggerContainer, fades up */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: springSnappy },
  exit: { opacity: 0, y: -6, transition: { duration: durationFast } },
};

/** Stagger item (fast) — for dense lists like table rows */
export const staggerItemFast: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: springInstant },
  exit: { opacity: 0 },
};

// ── Page transition config ────────────────────────────────────────────────────

/** Wrap each portal page in a motion.div with these variants */
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { ...springGentle, staggerChildren: 0.06, delayChildren: 0.04 },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.22, ease: easeIn },
  },
};

// ── Card hover physics ────────────────────────────────────────────────────────

/** whileHover prop — subtle lift with spring */
export const cardHover: TargetAndTransition = {
  y: -2,
  scale: 1.008,
  transition: springSnappy,
};

/** whileHover for stat/KPI cards — gentler */
export const statHover: TargetAndTransition = {
  y: -1,
  transition: springInstant,
};

/** whileTap — press feedback */
export const tapScale: TargetAndTransition = {
  scale: 0.97,
  transition: springInstant,
};

/** whileTap for buttons — strong press */
export const tapScaleStrong: TargetAndTransition = {
  scale: 0.94,
  transition: springInstant,
};

// ── Specific component presets ────────────────────────────────────────────────

/** KPI counter entrance */
export const kpiVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.92 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { ...springSnappy, delay: i * 0.08 },
  }),
};

/** Table row entrance with stagger */
export const tableRowVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { ...springInstant, delay: i * 0.04 },
  }),
};

/** Notification toast entrance */
export const toastVariants: Variants = {
  hidden: { opacity: 0, x: 40, scale: 0.92 },
  visible: { opacity: 1, x: 0, scale: 1, transition: springBouncy },
  exit: { opacity: 0, x: 40, transition: { duration: 0.2, ease: easeIn } },
};

/** Sidebar nav item */
export const navItemVariants: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { ...springSnappy, delay: 0.05 + i * 0.05 },
  }),
};

/** Badge/chip pop-in */
export const chipVariants: Variants = {
  hidden: { opacity: 0, scale: 0.7 },
  visible: { opacity: 1, scale: 1, transition: springElastic },
  exit: { opacity: 0, scale: 0.7, transition: { duration: 0.12 } },
};

/** Expandable section height animation */
export const expandVariants: Variants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: { height: 'auto', opacity: 1, transition: { ...springGentle, opacity: { delay: 0.05 } } },
};

// ── Utility ───────────────────────────────────────────────────────────────────

/** Build delay-indexed props for motion list children without staggerContainer */
export function delayedFadeUp(index: number, baseDelay = 0, step = 0.07) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { ...springSnappy, delay: baseDelay + index * step },
  } as const;
}

/** Fade-only (no movement) for content that's already in place */
export function delayedFade(index: number, baseDelay = 0, step = 0.06) {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: durationBase, ease: easeOut, delay: baseDelay + index * step },
  } as const;
}
