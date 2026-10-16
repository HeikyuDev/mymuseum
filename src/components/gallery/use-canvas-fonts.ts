"use client";

import { useEffect, useState } from "react";
import { loadCanvasFonts, resolveCanvasFonts, type CanvasFonts } from "@/lib/fonts-client";
import type { FontPairing } from "@/types/database";

/** Resolved + loaded canvas fonts for a pairing, or `null` until the faces are ready. */
export function useCanvasFonts(pairing: FontPairing, sample: string): CanvasFonts | null {
  const [state, setState] = useState<{ key: string; fonts: CanvasFonts } | null>(null);
  const key = `${pairing}:${sample}`;

  useEffect(() => {
    let cancelled = false;
    const fonts = resolveCanvasFonts(pairing);
    loadCanvasFonts(fonts, sample).then(() => {
      if (!cancelled) setState({ key, fonts });
    });
    return () => {
      cancelled = true;
    };
  }, [pairing, sample, key]);

  return state?.key === key ? state.fonts : null;
}
