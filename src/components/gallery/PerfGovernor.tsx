"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { FRAME_BUDGET_MS, GOVERNOR_QUIET_MS, GOVERNOR_WINDOW, governorStep, initialGovernor, ladderStart, shouldSampleFrame, windowStats, type GovernorState, type QualityTier } from "@/lib/gallery/quality";
import { useGallery } from "./context";

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
  const acc = useRef({ frames: new Float32Array(GOVERNOR_WINDOW), count: 0, quietUntil: 0, state: initialGovernor() as GovernorState });

  // A background tab, a resize or a rotation makes frame times meaningless for a moment: drop the window.
  useEffect(() => {
    const quiet = () => {
      acc.current.quietUntil = performance.now() + GOVERNOR_QUIET_MS;
      acc.current.count = 0;
    };
    document.addEventListener("visibilitychange", quiet);
    window.addEventListener("resize", quiet);
    window.addEventListener("orientationchange", quiet);
    return () => {
      document.removeEventListener("visibilitychange", quiet);
      window.removeEventListener("resize", quiet);
      window.removeEventListener("orientationchange", quiet);
    };
  }, []);

  useFrame((_, delta) => {
    if (!enabled || !motion.moving) return;
    const ms = delta * 1000;
    const a = acc.current;
    if (!shouldSampleFrame({ frameMs: ms, hidden: document.hidden, now: performance.now(), quietUntil: a.quietUntil, glideStartedAt: motion.glideStartedAt, glides: motion.glides })) return;
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
