"use client";

import React, { useState } from "react";
import { GalleryCanvas } from "./GalleryCanvas";
import { ArtworkFrame } from "./ArtworkFrame";
import { CameraFocusController } from "./CameraFocusController";
import { ArtworkDrawer } from "@/components/ui/ArtworkDrawer";
import { TeleportDock } from "./TeleportDock";
import { MuseumWithRelations, ArtworkData } from "@/types/museum";
import { Sparkles, Sliders } from "lucide-react";
import Link from "next/link";

interface MuseumViewerProps {
  museum: MuseumWithRelations;
}

export const MuseumViewer: React.FC<MuseumViewerProps> = ({ museum }) => {
  const [selectedArtwork, setSelectedArtwork] = useState<ArtworkData | null>(
    null
  );

  const settings = museum.settings;
  const activeArtworks = museum.artworks.filter((a) => a.isActive);

  const handleSelectArtwork = (art: ArtworkData) => {
    // Liberar cursor para interactuar con la ficha sin problemas
    if (typeof document !== "undefined" && document.pointerLockElement) {
      document.exitPointerLock();
    }
    setSelectedArtwork(art);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-neutral-950 font-sans select-none">
      {/* 1. Barra de cabecera flotante */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4 sm:p-6 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto bg-black/40 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 shadow-lg">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <div>
            <h1 className="text-white text-sm font-semibold tracking-wide">
              {museum.title}
            </h1>
            <p className="text-[11px] text-neutral-400">
              {activeArtworks.length} obras en secuencia continua
            </p>
          </div>
        </div>

        {/* Acceso directo a administración */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/10 text-xs text-neutral-300 hover:text-white transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>Admin de Galería</span>
          </Link>
        </div>
      </header>

      {/* 2. Escena 3D WebGL Infinita */}
      <GalleryCanvas
        wallColor={settings?.wallColor}
        ceilingColor={settings?.ceilingColor}
        lightingPreset={settings?.lightingPreset}
        ambientIntensity={settings?.ambientIntensity}
        spotlightIntensity={settings?.spotlightIntensity}
        controlsEnabled={!selectedArtwork}
      >
        {/* Neblina ambiental arquitectónica para profundidad infinita */}
        <color attach="background" args={["#121110"]} />
        <fog attach="fog" args={["#121110", 15, 80]} />

        {/* Renderizado de obras */}
        {activeArtworks.map((artwork) => (
          <ArtworkFrame
            key={artwork.id}
            artwork={artwork}
            defaultFrameStyle={settings?.defaultFrameStyle}
            defaultFrameColor={settings?.defaultFrameColor}
            isFocused={selectedArtwork?.id === artwork.id}
            onSelect={handleSelectArtwork}
          />
        ))}

        {/* Controlador cinemático para transiciones y teletransporte */}
        <CameraFocusController focusedArtwork={selectedArtwork} />
      </GalleryCanvas>

      {/* 3. Barra de teletransporte rápido en la parte inferior */}
      <TeleportDock
        artworks={activeArtworks}
        selectedArtworkId={selectedArtwork?.id}
        onSelectArtwork={handleSelectArtwork}
      />

      {/* 4. Side Drawer no intrusivo que preserva el contexto del espacio 3D */}
      <ArtworkDrawer
        artwork={selectedArtwork}
        onClose={() => setSelectedArtwork(null)}
      />
    </div>
  );
};
