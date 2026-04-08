export const colors = {
  base: {
    background: "#07111F",
    surface: "#0B1526",
    surface2: "#101C31",
    border: "rgba(255,255,255,0.10)",
    text: "#F5F7FB",
    mutedText: "rgba(245,247,251,0.68)",
  },
  brand: {
    primary: "#EAF2FF",
    accentBlue: "#4DA3FF",
    accentCyan: "#74E7FF",
    accentEmerald: "#63E6BE",
  },
  states: {
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
    info: "#38BDF8",
  },
} as const;

export const gradients = {
  hero: "linear-gradient(135deg, rgba(77,163,255,0.22), rgba(116,231,255,0.10), rgba(99,230,190,0.12))",
  card: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
  cta: "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(77,163,255,0.24), rgba(99,230,190,0.18))",
  shimmer:
    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
} as const;

export const typeScale = {
  display: "text-6xl md:text-7xl font-semibold tracking-tight",
  h1: "text-5xl md:text-6xl font-semibold tracking-tight",
  h2: "text-3xl md:text-5xl font-semibold tracking-tight",
  h3: "text-2xl md:text-3xl font-semibold tracking-tight",
  bodyLg: "text-lg md:text-xl leading-8",
  body: "text-base leading-7",
  small: "text-sm leading-6",
  micro: "text-xs uppercase tracking-[0.16em]",
} as const;

export const spacing = {
  sectionY: "py-20 md:py-28",
  sectionYLg: "py-28 md:py-36",
  sectionYSm: "py-14 md:py-20",
  container: "max-w-7xl px-6 md:px-8",
  cardPadding: "p-6 md:p-7",
  cardRadius: "rounded-[24px]",
  heroRadius: "rounded-[32px]",
} as const;

export const shadows = {
  soft: "0 10px 30px rgba(0,0,0,0.18)",
  medium: "0 18px 50px rgba(0,0,0,0.24)",
  heavy: "0 30px 80px rgba(0,0,0,0.32)",
  glowBlue: "0 0 40px rgba(77,163,255,0.22)",
  glowCyan: "0 0 40px rgba(116,231,255,0.18)",
} as const;

export const motion = {
  fadeUp: {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: [0.21, 1.04, 0.58, 1] },
  },
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.4, ease: "easeOut" },
  },
  stagger: {
    animate: { transition: { staggerChildren: 0.08 } },
  },
} as const;
