"use client";

import React, { useEffect } from "react";
import { X, Calendar, User, Maximize2, Compass } from "lucide-react";
import { ArtworkData } from "@/types/museum";

interface ArtworkDrawerProps {
  artwork: ArtworkData | null;
  onClose: () => void;
}

export const ArtworkDrawer: React.FC<ArtworkDrawerProps> = ({
  artwork,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!artwork) return null;

  return (
    <aside className="fixed top-0 right-0 bottom-0 w-full sm:w-[420px] z-40 bg-neutral-900/90 border-l border-white/10 backdrop-blur-xl shadow-2xl flex flex-col justify-between text-white animate-in slide-in-from-right duration-300">
      {/* 1. Cabecera del Drawer */}
      <div className="p-6 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
          <Compass className="w-4 h-4" />
          <span>Ficha de la Obra</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          title="Cerrar detalle (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Cuerpo del Drawer */}
      <div className="p-6 overflow-y-auto space-y-6 flex-1">
        {/* Imagen enmarcada */}
        <div className="relative rounded-2xl overflow-hidden bg-neutral-950 border border-white/10 p-3 group">
          <img
            src={artwork.imageUrl}
            alt={artwork.title}
            className="w-full h-56 object-contain rounded-xl"
          />
          <a
            href={artwork.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-5 right-5 p-2 rounded-xl bg-black/70 hover:bg-black/90 text-neutral-200 hover:text-white backdrop-blur-sm text-xs flex items-center gap-1.5 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>HD</span>
          </a>
        </div>

        {/* Título y Autor */}
        <div>
          <h2 className="text-2xl font-serif font-bold text-white leading-tight">
            {artwork.title}
          </h2>
          <div className="flex items-center gap-2 mt-2 text-neutral-300 text-sm">
            <User className="w-4 h-4 text-amber-400" />
            <span className="font-medium text-white">{artwork.artistName}</span>
          </div>
        </div>

        {/* Ficha técnica resumida */}
        <div className="grid grid-cols-2 gap-3 py-3 px-4 rounded-2xl bg-neutral-950/60 border border-white/5 text-xs text-neutral-400">
          <div>
            <span className="text-neutral-500 block">Año</span>
            <span className="text-neutral-200 font-medium">{artwork.year || "Desconocido"}</span>
          </div>
          <div>
            <span className="text-neutral-500 block">Dimensiones</span>
            <span className="text-neutral-200 font-medium">{artwork.widthMeters}m × {artwork.heightMeters}m</span>
          </div>
        </div>

        {/* Reseña curatorial */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-neutral-400 font-semibold mb-2">
            Contexto Curatorial
          </h4>
          <p className="text-sm text-neutral-300 leading-relaxed font-light">
            {artwork.description || "Sin descripción curatorial disponible."}
          </p>
        </div>
      </div>

      {/* 3. Pie del Drawer */}
      <div className="p-6 border-t border-white/10 bg-neutral-950/40 flex items-center justify-between">
        <span className="text-xs text-neutral-500">
          Ubicación: <span className="text-neutral-300 font-medium">Slot #{artwork.sortOrder}</span>
        </span>
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs transition-colors shadow-lg shadow-amber-500/20"
        >
          Volver a Caminar
        </button>
      </div>
    </aside>
  );
};
