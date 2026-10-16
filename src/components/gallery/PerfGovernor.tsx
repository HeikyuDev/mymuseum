"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { GOVERNOR_WINDOW, governorStep, initialGovernor, type GovernorAction, type GovernorState, type QualityTier } from "@/lib/gallery/quality";

/** Frames separated by more than this are idle gaps (the camera was at rest), not slow frames. */
const IDLE_GAP_MS = 400;

type Props = {
  tier: QualityTier;
  scaleStep: number;
  enabled: boolean;
  onAction: (action: GovernorAction) => void;
};

/**
 * Measures the real frame time while the camera moves and asks for a cheaper setting when it
 * stays over budget. It only degrades (see `governorStep`), so the quality never flaps.
 */
export function PerfGovernor({ tier, scaleStep, enabled, onAction }: Props) {
  const acc = useRef({ sum: 0, count: 0, state: { ...initialGovernor(), scaleStep } as GovernorState });

  useFrame((_, delta) => {
    if (!enabled) return;
    const ms = delta * 1000;
    if (ms > IDLE_GAP_MS) return;
    const a = acc.current;
    a.sum += ms;
    a.count += 1;
    if (a.count < GOVERNOR_WINDOW) return;
    const step = governorStep(a.state, a.sum / a.count, tier);
    a.state = step.state;
    a.sum = 0;
    a.count = 0;
    if (step.action !== "none") onAction(step.action);
  });

  return null;
}
