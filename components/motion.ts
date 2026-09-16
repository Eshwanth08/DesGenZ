import type { Variants, Transition } from "framer-motion";

export const EASE_STANDARD = [0.4, 0, 0.2, 1] as const;
export const EASE_BOUNCE = [0.34, 1.56, 0.64, 1] as const;

export const MICRO: Transition = { duration: 0.15, ease: EASE_STANDARD };
export const PANEL: Transition = { duration: 0.25, ease: EASE_STANDARD };
export const PAGE: Transition = { duration: 0.35, ease: EASE_STANDARD };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: PAGE },
};

export const staggerList: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: MICRO },
};
