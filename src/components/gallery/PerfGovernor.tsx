"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { FRAME_BUDGET_MS, GOVERNOR_WINDOW, governorStep, initialGovernor, ladderStart, windowStats, type GovernorState, type QualityTier } from "@/lib/gallery/quality";
import { useGallery } from "./context";

/** Frames separated by more than this are idle gaps (the camera was at rest), not slow frames. */
const IDLE_GAP_MS = 400;

type Props = {
  tier: QualityTier;
  enabled: boolean;
  /** False once the ladder is exhausted: nothing is left to give up. */
  canDegrade: boolean;
  onDegrade: () => void;
};

/**
 * Measures the real frame time while the camera glides and asks for the next, cheaper rung of the
 * quality ladder when a whole window stays over budget. It only degrades (see `governorStep`), so the
 * quality never flaps. It keeps its numbers in a preallocated buffer and never causes a re-render by itself.
 */
export function PerfGovernor({ tier, enabled, canDegrade, onDegrade }: Props) {
  const { motion } = useGallery();
  const acc = useRef({ frames: new Float32Array(GOVERNOR_WINDOW), count: 0, state: initialGovernor() as GovernorState });

  useFrame((_, delta) => {
    if (!enabled || !motion.moving) return;
    const ms = delta * 1000;
    if (ms > IDLE_GAP_MS) return;
    const a = acc.current;
    a.frames[a.count] = ms;
    a.count += 1;
    if (a.count < GOVERNOR_WINDOW) return;
    a.count = 0;
    const { median, lagShare } = windowStats(Array.from(a.frames), FRAME_BUDGET_MS[ladderStart(tier)]);
    const step = governorStep(a.state, median, lagShare, tier, canDegrade);
    a.state = step.state;
    if (step.action === "degrade") onDegrade();
  });

  return null;
}
