"use client";

import React, { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { GalleryArchitecture } from "./GalleryArchitecture";
import { GalleryLighting } from "./GalleryLighting";
import { MovementControls } from "./controls/MovementControls";
import { MobileOverlay } from "./controls/MobileOverlay";
import { LightingPreset } from "@/types/museum";

interface GalleryCanvasProps {
  wallColor?: string;
  ceilingColor?: string;
  lightingPreset?: LightingPreset;
  ambientIntensity?: number;
  spotlightIntensity?: number;
  controlsEnabled?: boolean;
  children?: React.ReactNode;
}

export const GalleryCanvas: React.FC<GalleryCanvasProps> = ({
  wallColor = "#ECE8E1",
  ceilingColor = "#F9F8F5",
  lightingPreset = "WARM_GALLERY",
  ambientIntensity = 0.5,
  spotlightIntensity = 1.2,
  controlsEnabled = true,
  children,
}) => {
  const [isLocked, setIsLocked] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    setIsTouch(hasTouch);

    const onPointerLockChange = () => {
      setIsLocked(document.pointerLockElement !== null);
    };

    document.addEventListener("pointerlockchange", onPointerLockChange);
    return () => {
      document.removeEventListener("pointerlockchange", onPointerLockChange);
    };
  }, []);

  if (!isMounted) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-neutral-950 text-neutral-400">
        <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-sm tracking-widest uppercase">Inicializando espacio 3D...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-neutral-950 overflow-hidden select-none">
      {/* 1. Canvas 3D de WebGL a pantalla completa */}
      <div className="absolute inset-0 z-0">
        <Canvas
          shadows
          dpr={[1, Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2)]}
          camera={{
            fov: 65,
            position: [0, 1.7, 0],
            near: 0.1,
            far: 60,
          }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0,
            powerPreference: "high-performance",
          }}
          className="w-full h-full cursor-crosshair"
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

            <MovementControls enabled={controlsEnabled} />

            {children}
          </Suspense>
        </Canvas>
      </div>

      {/* 2. Retícula central para interacción (Crosshair) */}
      {!isTouch && controlsEnabled && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20">
          <div className="w-2.5 h-2.5 rounded-full border border-white/60 bg-white/20 transition-transform duration-150" />
        </div>
      )}

      {/* 3. Indicador de controles de escritorio */}
      {!isTouch && !isLocked && controlsEnabled && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20">
          <div className="bg-neutral-900/90 border border-white/10 px-8 py-6 rounded-3xl shadow-2xl text-center max-w-sm pointer-events-auto">
            <h3 className="text-white font-medium text-base mb-2">
              Haz clic para explorar la galería
            </h3>
            <p className="text-neutral-400 text-xs mb-4 leading-relaxed">
              Usa <span className="text-amber-400 font-semibold">WASD</span> o flechas para caminar, y mueve el mouse para mirar alrededor.
            </p>
            <div className="text-[11px] text-neutral-500 uppercase tracking-wider">
              <span>Presiona <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">ESC</kbd> para liberar el cursor</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Overlay de controles táctiles en dispositivos móviles */}
      {isTouch && controlsEnabled && <MobileOverlay />}
    </div>
  );
};
