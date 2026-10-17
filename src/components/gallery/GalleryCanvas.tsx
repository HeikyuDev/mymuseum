"use client";

import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, NeutralToneMapping, PCFSoftShadowMap, SRGBColorSpace } from "three";
import type { QualitySettings } from "@/lib/gallery/quality";
import { GalleryScene, type GallerySceneProps } from "./GalleryScene";
import { isPerfDebug } from "./perf-store";

type Props = Omit<GallerySceneProps, "quality"> & {
  quality: QualitySettings;
  interactive?: boolean;
  /** "never" pauses rendering (previews that scrolled out of view). */
  frameloop?: "demand" | "never";
  onPointerMissed?: () => void;
  /** Label announced for the canvas element. */
  label: string;
};

/** The WebGL canvas. Renders only on demand: a resting camera costs no GPU time. */
export function GalleryCanvas({ quality, interactive = true, frameloop = "demand", onPointerMissed, label, ...scene }: Props) {
  return (
    <Canvas
      className="!absolute inset-0"
      aria-label={label}
      role="img"
      dpr={quality.dpr}
      frameloop={frameloop}
      shadows={quality.shadows ? { type: PCFSoftShadowMap } : false}
      camera={{ fov: 46, near: 0.1, far: 90, position: [0, 1.6, 4] }}
      gl={{ antialias: quality.antialias, powerPreference: "high-performance", alpha: false, stencil: false }}
      style={{ touchAction: "pan-y", pointerEvents: interactive ? "auto" : "none" }}
      onCreated={(state) => {
        const { gl } = state;
        if (process.env.NODE_ENV !== "production" || isPerfDebug()) (window as unknown as { __galleryState?: unknown }).__galleryState = state;
        // Filmic tone mapping greys out the unlit-looking baked walls; the neutral curve keeps their colors.
        gl.toneMapping = quality.baked ? NeutralToneMapping : ACESFilmicToneMapping;
        gl.outputColorSpace = SRGBColorSpace;
        const canvas = gl.domElement;
        canvas.addEventListener("webglcontextlost", (event) => event.preventDefault());
      }}
      onPointerMissed={onPointerMissed}
    >
      <GalleryScene quality={quality} {...scene} />
    </Canvas>
  );
}
