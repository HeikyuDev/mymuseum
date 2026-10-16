import type { ReactNode } from "react";
import type { DecorId } from "@/lib/hall-style";

// Registry of optional 3D-ish props standing on the floor. Each entry decides
// where it appears along the strip (in slot units) and how it is drawn.
// `k` is a size unit (floor height / 240).

type DecorDefinition = {
  /** Horizontal positions in slot units for a hall with `count` artworks. */
  positions: (count: number) => number[];
  render: (k: number) => ReactNode;
};

function Bench({ k }: { k: number }) {
  return (
    <div style={{ width: 150 * k, height: 56 * k, position: "relative" }} aria-hidden>
      <div
        style={{
          position: "absolute", left: 0, right: 0, top: 0, height: 22 * k, borderRadius: 6 * k,
          background: "linear-gradient(#3a3835, #23221f)", boxShadow: "inset 0 2px 0 rgba(255,255,255,.18)",
        }}
      />
      <div style={{ position: "absolute", left: 14 * k, top: 22 * k, width: 6 * k, height: 34 * k, background: "#1a1917" }} />
      <div style={{ position: "absolute", right: 14 * k, top: 22 * k, width: 6 * k, height: 34 * k, background: "#1a1917" }} />
      <div
        style={{
          position: "absolute", left: 4 * k, right: 4 * k, bottom: -6 * k, height: 10 * k,
          background: "radial-gradient(ellipse, rgba(0,0,0,.35), transparent 70%)",
        }}
      />
    </div>
  );
}

function Plant({ k }: { k: number }) {
  return (
    <svg width={90 * k} height={150 * k} viewBox="0 0 90 150" aria-hidden>
      <ellipse cx="45" cy="146" rx="30" ry="5" fill="rgba(0,0,0,.28)" />
      <path d="M45 90 C20 70 18 35 40 8 C50 38 62 60 45 90Z" fill="#3f6b45" />
      <path d="M45 92 C70 74 78 44 58 18 C46 44 36 66 45 92Z" fill="#4f8656" />
      <path d="M44 94 C28 84 8 78 4 56 C26 56 40 70 44 94Z" fill="#335a3a" />
      <path d="M46 94 C62 84 82 80 86 60 C64 58 50 72 46 94Z" fill="#3f6b45" />
      <path d="M26 100 H64 L58 144 H32 Z" fill="#d8d2c6" />
      <path d="M26 100 H64 L63 108 H27 Z" fill="#bdb6a8" />
    </svg>
  );
}

function RopeBarrier({ k }: { k: number }) {
  const width = 210 * k;
  const post = (side: "left" | "right") => (
    <div
      style={{
        position: "absolute", [side]: 0, bottom: 0, width: 9 * k, height: 78 * k,
        background: "linear-gradient(90deg, #8a6d2b, #e5c76b 45%, #8a6d2b)", borderRadius: 4 * k,
      }}
    >
      <div
        style={{
          position: "absolute", left: -4 * k, right: -4 * k, bottom: -3 * k, height: 7 * k,
          background: "#8a6d2b", borderRadius: "50%",
        }}
      />
    </div>
  );
  return (
    <div style={{ width, height: 82 * k, position: "relative" }} aria-hidden>
      {post("left")}
      {post("right")}
      <svg width={width} height={82 * k} viewBox="0 0 210 82" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {/* Soft shadow under the sagging rope, then a thick rope with a highlight. */}
        <path d="M6 18 Q105 70 204 18" fill="none" stroke="rgba(0,0,0,.28)" strokeWidth="9" strokeLinecap="round" />
        <path d="M6 12 Q105 62 204 12" fill="none" stroke="#a3122b" strokeWidth="9" strokeLinecap="round" />
        <path
          d="M6 12 Q105 62 204 12"
          fill="none"
          stroke="#ff8a96"
          strokeWidth="2"
          strokeDasharray="1 5"
          strokeLinecap="round"
          opacity=".85"
        />
        <circle cx="6" cy="12" r="6" fill="#e5c76b" />
        <circle cx="204" cy="12" r="6" fill="#e5c76b" />
      </svg>
    </div>
  );
}

export const DECOR_REGISTRY: Record<DecorId, DecorDefinition> = {
  benches: {
    positions: (count) => Array.from({ length: Math.max(count - 1, 0) }, (_, i) => i + 0.5).filter((_, i) => i % 3 === 0),
    render: (k) => <Bench k={k} />,
  },
  plants: {
    positions: (count) => [-0.5, ...Array.from({ length: Math.max(count - 1, 0) }, (_, i) => i + 0.5).filter((_, i) => i % 3 === 1), count - 0.5],
    render: (k) => <Plant k={k} />,
  },
  rope_barriers: {
    positions: (count) => Array.from({ length: count }, (_, i) => i),
    render: (k) => <RopeBarrier k={k} />,
  },
};
