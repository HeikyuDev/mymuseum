"use client";

import React, { useEffect } from "react";
import { X, ExternalLink, Calendar, User, Maximize2 } from "lucide-react";
import { ArtworkData } from "@/types/museum";

interface ArtworkModalProps {
  artwork: ArtworkData | null;
  onClose: () => void;
}

export const ArtworkModal: React.FC<ArtworkModalProps> = ({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-neutral-900/95 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row text-white">
        {/* Botón Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/40 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          title="Cerrar (Esc)"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Columna Izquierda: Imagen de la Obra */}
        <div className="md:w-1/2 bg-neutral-950 flex items-center justify-center p-6 relative group overflow-hidden">
          <img
            src={artwork.imageUrl}
            alt={artwork.title}
            className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-lg group-hover:scale-102 transition-transform duration-300"
          />
          <a
            href={artwork.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 right-4 p-2 rounded-xl bg-black/60 hover:bg-black/90 text-neutral-300 hover:text-white backdrop-blur-sm text-xs flex items-center gap-1.5 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Ver HD</span>
          </a>
        </div>

        {/* Columna Derecha: Ficha Técnica y Curatorial */}
        <div className="md:w-1/2 p-6 md:p-8 flex flex-col justify-between overflow-y-auto">
          <div>
            {/* Cabecera */}
            <div className="mb-4">
              <span className="text-xs uppercase tracking-widest text-amber-400 font-semibold">
                Ficha Curatorial
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-100 mt-1 leading-tight">
                {artwork.title}
              </h2>
            </div>

            {/* Metadatos */}
            <div className="flex flex-wrap gap-4 py-3 border-y border-white/10 mb-5 text-sm text-neutral-300">
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-neutral-400" />
                <span className="font-medium text-white">{artwork.artistName}</span>
              </div>
              {artwork.year && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-neutral-400" />
                  <span>{artwork.year}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-neutral-400">
                <span>{artwork.widthMeters}m × {artwork.heightMeters}m</span>
              </div>
            </div>

            {/* Descripción curatorial */}
            <div className="text-sm text-neutral-300 leading-relaxed space-y-3">
              <p>{artwork.description || "Sin descripción curatorial disponible."}</p>
            </div>
          </div>

          {/* Pie del modal con botón de retorno */}
          <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-neutral-500">
              Marco: <span className="text-neutral-300 uppercase">{artwork.frameStyle || "Estándar"}</span>
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-medium text-sm transition-colors shadow-lg shadow-amber-500/20"
            >
              Volver a la Galería
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
