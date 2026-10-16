"use client";

import React from "react";
import { Compass, Sparkles, Navigation } from "lucide-react";
import { ArtworkData } from "@/types/museum";

interface TeleportDockProps {
  artworks: ArtworkData[];
  selectedArtworkId?: string | null;
  onSelectArtwork: (artwork: ArtworkData) => void;
}

export const TeleportDock: React.FC<TeleportDockProps> = ({
  artworks,
  selectedArtworkId,
  onSelectArtwork,
}) => {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 max-w-[95vw] sm:max-w-2xl w-full pointer-events-auto">
      <div className="bg-neutral-900/85 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl flex items-center gap-2 overflow-x-auto no-scrollbar">
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-amber-400 text-xs font-semibold uppercase tracking-wider shrink-0 border-r border-white/10">
          <Navigation className="w-3.5 h-3.5" />
          <span>Teletransporte</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {artworks.map((art, index) => {
            const isSelected = selectedArtworkId === art.id;
            return (
              <button
                key={art.id}
                onClick={() => onSelectArtwork(art)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-all ${
                  isSelected
                    ? "bg-amber-500 text-neutral-950 font-semibold shadow-md shadow-amber-500/20 scale-102"
                    : "bg-neutral-950/70 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-white/5"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                    isSelected ? "bg-black/20 text-neutral-950" : "bg-neutral-800 text-amber-400"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="truncate max-w-[110px] sm:max-w-[140px] text-left">
                  {art.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
