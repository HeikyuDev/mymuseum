"use client";

import { useEffect, useRef } from "react";
import { perfStore } from "./perf-store";

/** Diagnostics overlay (?debug=perf). Hidden unless that parameter is present; loaded lazily. */
export default function PerfOverlay() {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const id = window.setInterval(() => {
      const p = perfStore;
      if (!ref.current) return;
      ref.current.textContent = [
        `tier     ${p.tier}   level ${p.level}   dpr ${p.pixelRatio.toFixed(2)}`,
        `fps      ${p.fps.toFixed(0)}   frame ${p.frameMs.toFixed(1)} ms   cpu ${p.renderCpuMs.toFixed(1)} ms`,
        `calls    ${p.calls}   tris ${p.triangles}`,
        `tex      ${p.textures} (~${p.textureMB.toFixed(1)} MB)   geo ${p.geometries}   prog ${p.programs}`,
        `compile  ${p.compileMs.toFixed(0)} ms   first frame ${p.firstFrameMs.toFixed(0)} ms`,
      ].join("\n");
    }, 400);
    return () => window.clearInterval(id);
  }, []);
  return <pre ref={ref} aria-hidden className="pointer-events-none absolute bottom-2 left-2 z-[60] m-0 rounded bg-black/70 p-2 font-mono text-[11px] leading-4 text-lime-300" />;
}
