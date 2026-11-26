import type { Transition } from 'motion/react';

export const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const SPRING_SEGMENT: Transition = {
  type: 'spring',
  stiffness: 520,
  damping: 38,
  mass: 0.8,
};

export const SPRING_TAB: Transition = {
  type: 'spring',
  stiffness: 560,
  damping: 40,
  mass: 0.75,
};

export const SPRING_LIST: Transition = {
  type: 'spring',
  stiffness: 460,
  damping: 36,
  mass: 0.75,
};

export const TRANSITION_FAST: Transition = {
  duration: 0.14,
  ease: EASE_OUT_EXPO,
};

export const TRANSITION_BASE: Transition = {
  duration: 0.18,
  ease: EASE_OUT_EXPO,
};

export const TRANSITION_OVERLAY: Transition = {
  duration: 0.2,
  ease: EASE_OUT_EXPO,
};

export const INSTANT_TRANSITION: Transition = {
  duration: 0,
};
