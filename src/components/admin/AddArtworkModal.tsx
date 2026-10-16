"use client";

import React, { useState } from "react";
import { X, Upload, Image as ImageIcon, Sparkles, Check } from "lucide-react";
import { createArtworkAction } from "@/app/actions/museumActions";
import { FrameStyle } from "@/types/museum";

interface AddArtworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddArtworkModal: React.FC<AddArtworkModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [aspectRatio, setAspectRatio] = useState<number>(1.0);
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [year, setYear] = useState<string>("");
  const [description, setDescription] = useState("");
  const [wallIndex, setWallIndex] = useState<number>(0);
  const [widthMeters, setWidthMeters] = useState<number>(1.8);
  const [heightMeters, setHeightMeters] = useState<number>(1.5);
  const [frameStyle, setFrameStyle] = useState<string>("");
  const [frameColor, setFrameColor] = useState<string>("#C5A059");

  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  if (!isOpen) return null;

  // Manejo de selección de archivo e inferencia de relación de aspecto
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    const objectUrl = URL.createObjectURL(selected);
    setPreviewUrl(objectUrl);

    // Detección de dimensiones naturales
    const img = new Image();
    img.src = objectUrl;
    img.onload = () => {
      const ratio = img.width / img.height;
      setAspectRatio(ratio);

      // Calcular dimensiones sugeridas en metros
      const defaultWidth = 1.8;
      const calculatedHeight = parseFloat((defaultWidth / ratio).toFixed(2));
      setWidthMeters(defaultWidth);
      setHeightMeters(calculatedHeight);
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewUrl) {
      setErrorMsg("Debes seleccionar una imagen para la obra.");
      return;
    }
    if (!title.trim()) {
      setErrorMsg("El título de la obra es obligatorio.");
      return;
    }

    try {
      setIsUploading(true);
      setErrorMsg("");

      let finalImageUrl = previewUrl;

      // Si es un archivo local nuevo, lo subimos al servidor
      if (file) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Fallo en la subida de imagen.");
        }
        finalImageUrl = data.url;
      }

      // Invocar Server Action
      await createArtworkAction({
        title,
        artistName: artistName || "Desconocido",
        year: year ? parseInt(year, 10) : null,
        description: description || undefined,
        imageUrl: finalImageUrl,
        aspectRatio,
        widthMeters,
        heightMeters,
        wallIndex,
        frameStyle: frameStyle || null,
        frameColor: frameStyle ? frameColor : null,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al registrar la obra.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white max-h-[90vh]">
        {/* Cabecera */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-semibold text-white">Añadir Nueva Obra al Museo</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Zona de Subida de Imagen */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-400 font-semibold mb-2">
              Imagen de la Obra *
            </label>
            <div className="border-2 border-dashed border-white/15 hover:border-amber-500/50 rounded-2xl p-6 flex flex-col items-center justify-center bg-neutral-950/50 transition-colors relative cursor-pointer group">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {previewUrl ? (
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={previewUrl}
                    alt="Previsualización"
                    className="max-h-48 object-contain rounded-lg shadow-md"
                  />
                  <span className="text-xs text-neutral-400 group-hover:text-amber-400">
                    Clic para cambiar imagen (Aspecto: {aspectRatio.toFixed(2)})
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-neutral-400">
                  <Upload className="w-8 h-8 text-neutral-500 group-hover:text-amber-400 transition-colors" />
                  <p className="text-sm font-medium text-white">Arrastra o haz clic para subir</p>
                  <p className="text-xs text-neutral-500">Formatos admitidos: JPG, PNG, WebP (Máx. 10MB)</p>
                </div>
              )}
            </div>
          </div>

          {/* Datos Curatorial */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-400 font-medium mb-1">Título de la Obra *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. La Noche Estrellada"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm focus:outline-hidden focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 font-medium mb-1">Artista / Autor</label>
              <input
                type="text"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="Ej. Vincent van Gogh"
                className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-neutral-400 font-medium mb-1">Año de Creación</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="Ej. 1889"
                className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm focus:outline-hidden focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 font-medium mb-1">Ancho (metros)</label>
              <input
                type="number"
                step="0.1"
                min="0.4"
                max="6.0"
                value={widthMeters}
                onChange={(e) => {
                  const w = parseFloat(e.target.value) || 1.8;
                  setWidthMeters(w);
                  setHeightMeters(parseFloat((w / aspectRatio).toFixed(2)));
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm focus:outline-hidden focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 font-medium mb-1">Alto (metros)</label>
              <input
                type="number"
                step="0.1"
                min="0.4"
                max="6.0"
                value={heightMeters}
                onChange={(e) => setHeightMeters(parseFloat(e.target.value) || 1.5)}
                className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          {/* Asignación de Pared */}
          <div>
            <label className="block text-xs text-neutral-400 font-medium mb-1">Ubicación en Sala (Pared)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { idx: 0, label: "Pared Norte (Frente)" },
                { idx: 1, label: "Pared Este (Derecha)" },
                { idx: 2, label: "Pared Sur (Atrás)" },
                { idx: 3, label: "Pared Oeste (Izquierda)" },
              ].map((p) => (
                <button
                  key={p.idx}
                  type="button"
                  onClick={() => setWallIndex(p.idx)}
                  className={`p-3 rounded-xl border text-xs font-medium transition-all ${
                    wallIndex === p.idx
                      ? "border-amber-500 bg-amber-500/10 text-amber-400 shadow-md"
                      : "border-white/10 bg-neutral-950/60 text-neutral-400 hover:border-white/30"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Estilo de Marco Individual */}
          <div>
            <label className="block text-xs text-neutral-400 font-medium mb-1">Estilo de Marco</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { key: "", label: "Por Defecto" },
                { key: "MINIMALIST", label: "Minimalista" },
                { key: "WOOD", label: "Madera" },
                { key: "GOLD", label: "Dorado" },
                { key: "METALLIC", label: "Metálico" },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFrameStyle(f.key)}
                  className={`py-2 px-3 rounded-xl border text-xs transition-all ${
                    frameStyle === f.key
                      ? "border-amber-500 bg-amber-500/10 text-amber-400 font-semibold"
                      : "border-white/10 bg-neutral-950 text-neutral-400 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs text-neutral-400 font-medium mb-1">Descripción / Ficha Curatorial</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles sobre el contexto histórico, técnica y significado de la obra..."
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm focus:outline-hidden focus:border-amber-500 resize-none"
            />
          </div>

          {/* Botones de acción */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-neutral-400 hover:text-white text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {isUploading ? "Guardando..." : "Colgar en la Galería"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
