"use client";

import { motion, useReducedMotion } from "framer-motion";
import { STATE_META, type RaphaelState } from "@/lib/raphael-state";

type Props = {
  state: RaphaelState;
  size?: number;
  /** Amplitude vocale 0..1 (fournie par le moteur audio en Phase 4). */
  level?: number;
};

const RING_SPEED: Record<RaphaelState, number> = {
  idle: 40,
  listening: 18,
  thinking: 6,
  speaking: 14,
  offline: 0,
};

/** Noyau animé : indicateur principal de l'état de Raphaël. */
export function RaphaelCore({ state, size = 220, level = 0 }: Props) {
  const reduce = useReducedMotion();
  const { color, label } = STATE_META[state];
  const speed = reduce ? 0 : RING_SPEED[state];
  const pulse =
    state === "speaking" ? 1 + Math.min(Math.max(level, 0), 1) * 0.12 : state === "listening" ? 1.06 : 1.03;
  const breathe = state === "listening" ? 1.2 : 4;

  const spin = (dir: 1 | -1, duration: number) =>
    speed === 0
      ? {}
      : { animate: { rotate: dir * 360 }, transition: { repeat: Infinity, ease: "linear" as const, duration } };

  return (
    <div
      role="img"
      aria-label={`Noyau de Raphaël — ${label}`}
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
    >
      {/* Halo */}
      <motion.div
        className="absolute inset-0 rounded-full blur-2xl"
        animate={{ backgroundColor: color, opacity: state === "offline" ? 0.05 : 0.18 }}
        transition={{ duration: 0.4 }}
      />

      {/* Anneaux orbitaux */}
      <motion.svg viewBox="0 0 200 200" className="absolute inset-0" {...spin(1, speed)}>
        <circle cx="100" cy="100" r="92" fill="none" stroke={color} strokeOpacity="0.35" strokeWidth="1"
          strokeDasharray="4 10" />
        <path d="M100 8 A92 92 0 0 1 192 100" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </motion.svg>
      <motion.svg viewBox="0 0 200 200" className="absolute inset-[12%]" {...spin(-1, speed * 1.6)}>
        <circle cx="100" cy="100" r="90" fill="none" stroke={color} strokeOpacity="0.25" strokeWidth="1.5" />
        <path d="M10 100 A90 90 0 0 1 60 20" fill="none" stroke={color} strokeOpacity="0.9" strokeWidth="2.5"
          strokeLinecap="round" />
        <path d="M190 100 A90 90 0 0 1 140 180" fill="none" stroke={color} strokeOpacity="0.9" strokeWidth="2.5"
          strokeLinecap="round" />
      </motion.svg>

      {/* Cœur */}
      <motion.div
        className="absolute inset-[30%] rounded-full"
        style={{
          background: `radial-gradient(circle at 40% 35%, #ffffff, ${color} 45%, transparent 72%)`,
        }}
        animate={reduce || state === "offline" ? { scale: 1 } : { scale: [1, pulse, 1] }}
        transition={{ repeat: Infinity, duration: breathe, ease: "easeInOut" }}
      />
    </div>
  );
}
