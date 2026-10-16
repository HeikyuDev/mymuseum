"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Eye,
  Sliders,
  Image as ImageIcon,
  Settings,
  Plus,
  Trash2,
  ExternalLink,
  Check,
  CheckCircle2,
  Sun,
  Flame,
  Palette,
} from "lucide-react";
import {
  MuseumWithRelations,
  ArtworkData,
  LightingPreset,
  FrameStyle,
} from "@/types/museum";
import {
  updateMuseumSettingsAction,
  updateMuseumGeneralAction,
  deleteArtworkAction,
  toggleArtworkActiveAction,
} from "@/app/actions/museumActions";
import { Live3DPreview } from "./Live3DPreview";
import { AddArtworkModal } from "./AddArtworkModal";

interface AdminDashboardProps {
  initialMuseum: MuseumWithRelations;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  initialMuseum,
}) => {
  const [activeTab, setActiveTab] = useState<"artworks" | "design" | "settings">("design");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Estados de diseño reactivos para Live 3D Preview
  const [wallColor, setWallColor] = useState(
    initialMuseum.settings?.wallColor || "#ECE8E1"
  );
  const [ceilingColor, setCeilingColor] = useState(
    initialMuseum.settings?.ceilingColor || "#F9F8F5"
  );
  const [defaultFrameStyle, setDefaultFrameStyle] = useState<FrameStyle>(
    (initialMuseum.settings?.defaultFrameStyle as FrameStyle) || "GOLD"
  );
  const [defaultFrameColor, setDefaultFrameColor] = useState(
    initialMuseum.settings?.defaultFrameColor || "#C5A059"
  );
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>(
    (initialMuseum.settings?.lightingPreset as LightingPreset) || "WARM_GALLERY"
  );
  const [ambientIntensity, setAmbientIntensity] = useState(
    initialMuseum.settings?.ambientIntensity || 0.5
  );
  const [spotlightIntensity, setSpotlightIntensity] = useState(
    initialMuseum.settings?.spotlightIntensity || 1.2
  );

  // Estados de configuración general
  const [title, setTitle] = useState(initialMuseum.title);
  const [slug, setSlug] = useState(initialMuseum.slug);
  const [description, setDescription] = useState(initialMuseum.description || "");
  const [isPublished, setIsPublished] = useState(initialMuseum.isPublished);

  // Feedback de guardado
  const [isSavingDesign, setIsSavingDesign] = useState(false);
  const [designSavedFeedback, setDesignSavedFeedback] = useState(false);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [generalFeedback, setGeneralFeedback] = useState("");

  const handleSaveDesign = async () => {
    try {
      setIsSavingDesign(true);
      await updateMuseumSettingsAction({
        wallColor,
        ceilingColor,
        defaultFrameStyle,
        defaultFrameColor,
        lightingPreset,
        ambientIntensity,
        spotlightIntensity,
      });
      setDesignSavedFeedback(true);
      setTimeout(() => setDesignSavedFeedback(false), 2500);
    } catch (err: any) {
      alert("Error al guardar diseño: " + err.message);
    } finally {
      setIsSavingDesign(false);
    }
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingGeneral(true);
      setGeneralFeedback("");
      const res = await updateMuseumGeneralAction({
        title,
        slug,
        description,
        isPublished,
      });
      if (res.success) {
        setGeneralFeedback("Ajustes guardados correctamente.");
        setTimeout(() => setGeneralFeedback(""), 3000);
      } else {
        setGeneralFeedback(res.error || "Error al actualizar.");
      }
    } catch (err: any) {
      setGeneralFeedback(err.message || "Error al actualizar.");
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const handleDeleteArtwork = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de descolgar la obra "${name}"?`)) {
      await deleteArtworkAction(id);
      window.location.reload();
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await toggleArtworkActiveAction(id, current);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col">
      {/* 1. Navbar Superior del Panel */}
      <header className="border-b border-white/10 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-neutral-950 font-bold shadow-md shadow-amber-500/20"
            >
              <Sparkles className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white text-sm">{title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">
                  {isPublished ? "Público" : "Borrador"}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">Panel de Curaduría & Arquitectura 3D</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/m/${slug}`}
              target="_blank"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-xs font-medium text-white transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>Visitar Galería 3D</span>
              <ExternalLink className="w-3 h-3 text-neutral-400" />
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Barra de Pestañas de Navegación */}
      <div className="border-b border-white/10 bg-neutral-900/30 px-6">
        <div className="max-w-7xl mx-auto flex gap-6">
          <button
            onClick={() => setActiveTab("design")}
            className={`py-3.5 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "design"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-neutral-400 hover:text-white"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Diseño & 3D en Vivo</span>
          </button>

          <button
            onClick={() => setActiveTab("artworks")}
            className={`py-3.5 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "artworks"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-neutral-400 hover:text-white"
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Colección de Obras ({initialMuseum.artworks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`py-3.5 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "settings"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-neutral-400 hover:text-white"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Ajustes Generales</span>
          </button>
        </div>
      </div>

      {/* 3. Contenido de las Pestañas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {/* PESTAÑA: DISEÑO Y LIVE 3D PREVIEW */}
        {activeTab === "design" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Columna Izquierda: Controles Estéticos */}
            <div className="lg:col-span-5 space-y-6 bg-neutral-900/40 border border-white/10 p-6 rounded-3xl backdrop-blur-sm">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 text-amber-400" />
                  Personalizador de Espacio
                </h3>
                <button
                  onClick={handleSaveDesign}
                  disabled={isSavingDesign}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  {designSavedFeedback ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>¡Guardado!</span>
                    </>
                  ) : isSavingDesign ? (
                    <span>Guardando...</span>
                  ) : (
                    <span>Guardar Cambios</span>
                  )}
                </button>
              </div>

              {/* 1. Color de Paredes */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-2">
                  Color de Paredes del Museo
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={wallColor}
                    onChange={(e) => setWallColor(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={wallColor}
                    onChange={(e) => setWallColor(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-white/10 text-xs font-mono text-white w-24"
                  />
                  {/* Paleta sugerida */}
                  <div className="flex gap-1.5 ml-auto">
                    {[
                      { c: "#ECE8E1", name: "Lino Clásico" },
                      { c: "#1A222D", name: "Azul Prusiano" },
                      { c: "#171717", name: "Negro Galería" },
                      { c: "#D9C9B8", name: "Arena Suave" },
                      { c: "#3E433E", name: "Verde Salvia" },
                    ].map((p) => (
                      <button
                        key={p.c}
                        type="button"
                        onClick={() => setWallColor(p.c)}
                        title={p.name}
                        className="w-6 h-6 rounded-full border border-white/20 transition-transform hover:scale-110"
                        style={{ backgroundColor: p.c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Preset de Iluminación */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-2">
                  Atmósfera Lumínica
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "WARM_GALLERY", label: "Cálida de Galería", desc: "Tonalidad ámbar clásica" },
                    { id: "COLD_CONTEMPORARY", label: "Fría Contemporánea", desc: "Luz blanca MoMA" },
                    { id: "NEON_NOIR", label: "Neón Futurista", desc: "Acentos cyan y magenta" },
                    { id: "DRAMATIC_SPOTLIGHT", label: "Foco Teatral", desc: "Fondo oscuro y foco alto" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setLightingPreset(p.id as LightingPreset)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        lightingPreset === p.id
                          ? "border-amber-500 bg-amber-500/10 text-white shadow-md"
                          : "border-white/10 bg-neutral-950/60 text-neutral-400 hover:border-white/20"
                      }`}
                    >
                      <p className="text-xs font-semibold">{p.label}</p>
                      <p className="text-[10px] text-neutral-500 mt-0.5">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Estilo de Marco Predeterminado */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-2">
                  Estilo de Marco General
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "MINIMALIST", label: "Minimalista" },
                    { id: "WOOD", label: "Madera Noble" },
                    { id: "GOLD", label: "Dorado Clásico" },
                    { id: "METALLIC", label: "Metálico" },
                    { id: "CANVAS_WRAP", label: "Lienzo Puro" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setDefaultFrameStyle(f.id as FrameStyle)}
                      className={`p-2.5 rounded-xl border text-center text-xs font-medium transition-all ${
                        defaultFrameStyle === f.id
                          ? "border-amber-500 bg-amber-500/10 text-amber-400"
                          : "border-white/10 bg-neutral-950 text-neutral-400 hover:text-white"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Intensidad de Iluminación */}
              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs text-neutral-300 mb-1">
                    <span>Luz Ambiental</span>
                    <span className="font-mono text-amber-400">{ambientIntensity.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.5"
                    step="0.05"
                    value={ambientIntensity}
                    onChange={(e) => setAmbientIntensity(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-neutral-300 mb-1">
                    <span>Intensidad de Focos Directos</span>
                    <span className="font-mono text-amber-400">{spotlightIntensity.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.5"
                    step="0.1"
                    value={spotlightIntensity}
                    onChange={(e) => setSpotlightIntensity(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Columna Derecha: Mini-Visor 3D en Vivo */}
            <div className="lg:col-span-7 h-[580px]">
              <Live3DPreview
                wallColor={wallColor}
                ceilingColor={ceilingColor}
                defaultFrameStyle={defaultFrameStyle}
                defaultFrameColor={defaultFrameColor}
                lightingPreset={lightingPreset}
                ambientIntensity={ambientIntensity}
                spotlightIntensity={spotlightIntensity}
                artworks={initialMuseum.artworks}
              />
            </div>
          </div>
        )}

        {/* PESTAÑA: COLECCIÓN DE OBRAS */}
        {activeTab === "artworks" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Obras en Exhibición</h2>
                <p className="text-xs text-neutral-400 mt-1">
                  Gestiona las obras colgadas, su orden y estado activo en la sala 3D.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Colgar Nueva Obra</span>
              </button>
            </div>

            {/* Grilla de Cuadros */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {initialMuseum.artworks.map((artwork) => (
                <div
                  key={artwork.id}
                  className="rounded-3xl bg-neutral-900/50 border border-white/10 overflow-hidden flex flex-col justify-between hover:border-white/20 transition-all group"
                >
                  <div className="relative aspect-4/3 bg-neutral-950 flex items-center justify-center p-4 overflow-hidden">
                    <img
                      src={artwork.imageUrl}
                      alt={artwork.title}
                      className="max-h-full max-w-full object-contain rounded-md group-hover:scale-103 transition-transform duration-300"
                    />
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-semibold text-amber-400 border border-white/10">
                      Pared {artwork.wallIndex === 0 ? "Norte" : artwork.wallIndex === 1 ? "Este" : artwork.wallIndex === 2 ? "Sur" : "Oeste"}
                    </span>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-semibold text-base text-white">{artwork.title}</h4>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {artwork.artistName} {artwork.year ? `(${artwork.year})` : ""}
                      </p>
                      <p className="text-xs text-neutral-500 line-clamp-2 mt-2 leading-relaxed">
                        {artwork.description || "Sin descripción."}
                      </p>
                    </div>

                    <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between text-xs">
                      <button
                        onClick={() => handleToggleActive(artwork.id, artwork.isActive)}
                        className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                          artwork.isActive
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : "bg-neutral-800 text-neutral-400"
                        }`}
                      >
                        {artwork.isActive ? "Visible" : "Oculta"}
                      </button>

                      <button
                        onClick={() => handleDeleteArtwork(artwork.id, artwork.title)}
                        className="p-2 rounded-xl text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Descolgar obra"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PESTAÑA: AJUSTES GENERALES */}
        {activeTab === "settings" && (
          <div className="max-w-2xl bg-neutral-900/40 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
            <h3 className="text-lg font-bold text-white mb-6">Configuración General del Museo</h3>

            <form onSubmit={handleSaveGeneral} className="space-y-6">
              {generalFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs ${
                    generalFeedback.includes("correctamente")
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-red-500/20 text-red-300 border border-red-500/30"
                  }`}
                >
                  {generalFeedback}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                  Título del Museo
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-950 border border-white/10 text-white text-sm focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                  URL Pública (Slug)
                </label>
                <div className="flex items-center">
                  <span className="px-4 py-3 rounded-l-2xl bg-neutral-800 border border-r-0 border-white/10 text-xs text-neutral-400 font-mono">
                    mimuseo.com/m/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    required
                    className="flex-1 px-4 py-3 rounded-r-2xl bg-neutral-950 border border-white/10 text-white text-sm font-mono focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                  Descripción Curatorial / Biografía
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-950 border border-white/10 text-white text-sm focus:outline-hidden focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="publishedToggle"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
                <label htmlFor="publishedToggle" className="text-xs text-neutral-300 font-medium cursor-pointer">
                  Publicar museo para acceso público por URL
                </label>
              </div>

              <div className="pt-4 border-t border-white/10">
                <button
                  type="submit"
                  disabled={isSavingGeneral}
                  className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {isSavingGeneral ? "Guardando..." : "Actualizar Información"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Modal para añadir obras */}
      <AddArtworkModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => window.location.reload()}
      />
    </div>
  );
};
