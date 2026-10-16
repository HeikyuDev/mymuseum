"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { GalleryLighting } from "@/components/3d/GalleryLighting";
import { GalleryArchitecture } from "@/components/3d/GalleryArchitecture";
import { ArtworkFrame } from "@/components/3d/ArtworkFrame";
import { LightingPreset, FrameStyle, ArtworkData } from "@/types/museum";

interface Live3DPreviewProps {
  wallColor: string;
  ceilingColor: string;
  defaultFrameStyle: FrameStyle;
  defaultFrameColor: string;
  lightingPreset: LightingPreset;
  ambientIntensity: number;
  spotlightIntensity: number;
  artworks?: ArtworkData[];
}

export const Live3DPreview: React.FC<Live3DPreviewProps> = ({
  wallColor,
  ceilingColor,
  defaultFrameStyle,
  defaultFrameColor,
  lightingPreset,
  ambientIntensity,
  spotlightIntensity,
  artworks = [],
}) => {
  return (
    <div className="w-full h-full min-h-[420px] rounded-3xl overflow-hidden bg-neutral-950 border border-white/10 relative shadow-2xl">
      <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-amber-400 tracking-wider uppercase flex items-center gap-1.5 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        Vista Previa 3D en Vivo
      </div>

      <div className="absolute bottom-4 right-4 z-10 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] text-neutral-400 pointer-events-none">
        Arrastra para orbitar | Scroll para zoom
      </div>

      <Canvas
        shadows
        camera={{ position: [0, 2.5, 6], fov: 50 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
      >
        <Suspense fallback={null}>
          <GalleryLighting
            preset={lightingPreset}
            ambientIntensity={ambientIntensity}
            spotlightIntensity={spotlightIntensity}
          />

          <GalleryArchitecture
            wallColor={wallColor}
            ceilingColor={ceilingColor}
          />

          {artworks.slice(0, 4).map((art) => (
            <ArtworkFrame
              key={art.id}
              artwork={art}
              defaultFrameStyle={defaultFrameStyle}
              defaultFrameColor={defaultFrameColor}
            />
          ))}

          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            maxPolarAngle={Math.PI / 2 - 0.05} // No pasar por debajo del suelo
            minDistance={2}
            maxDistance={12}
            target={[0, 1.7, 0]}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};
