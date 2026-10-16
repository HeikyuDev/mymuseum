"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ShieldAlert,
  UserPlus,
  Eye,
  Sliders,
  Trash2,
  ExternalLink,
  Layers,
  Users,
  Compass,
} from "lucide-react";
import { createMuseumAdminAction, deleteMuseumAction } from "@/app/actions/siteAdminActions";

interface SiteAdminPortalProps {
  museums: Array<{
    id: string;
    title: string;
    slug: string;
    isPublished: boolean;
    createdAt: Date;
    user: {
      id: string;
      name: string;
      email: string;
    };
    _count: {
      artworks: number;
    };
  }>;
}

export const SiteAdminPortal: React.FC<SiteAdminPortalProps> = ({ museums }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [museumTitle, setMuseumTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const handleTitleChange = (val: string) => {
    setMuseumTitle(val);
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setSlug(generatedSlug);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setMessage(null);

      const res = await createMuseumAdminAction({
        name,
        email,
        museumTitle,
        slug,
      });

      if (res.success) {
        setMessage({ text: "¡Administrador y museo dados de alta exitosamente!" });
        setName("");
        setEmail("");
        setMuseumTitle("");
        setSlug("");
        window.location.reload();
      } else {
        setMessage({ text: res.error || "Error al registrar.", isError: true });
      }
    } catch (err: any) {
      setMessage({ text: err.message || "Error al procesar la solicitud.", isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (confirm(`¿Estás seguro de dar de baja el museo "${title}"?`)) {
      await deleteMuseumAction(id);
      window.location.reload();
    }
  };

  const totalArtworks = museums.reduce((acc, m) => acc + m._count.artworks, 0);

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col">
      {/* 1. Header */}
      <header className="border-b border-white/10 bg-neutral-900/60 backdrop-blur-md px-6 py-5 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-neutral-950 font-bold shadow-md shadow-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">
                Panel de Administración General
              </h1>
              <p className="text-[11px] text-neutral-400">
                Gestión global de inquilinos (Tenants), administradores y acceso directo a museos 3D
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Cuerpo Principal */}
      <main className="max-w-7xl w-full mx-auto p-6 space-y-8 flex-1">
        {/* Métricas Globales */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-neutral-900/50 border border-white/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-neutral-400">Total de Museos</p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{museums.length}</h3>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-neutral-900/50 border border-white/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-neutral-400">Admins de Museo</p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{museums.length}</h3>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-neutral-900/50 border border-white/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-neutral-400">Total de Obras Colgadas</p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{totalArtworks}</h3>
            </div>
          </div>
        </div>

        {/* Formulario para dar de alta nuevo administrador de museo */}
        <div className="bg-neutral-900/40 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-6">
            <UserPlus className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">Dar de Alta Nuevo Administrador de Museo</h2>
          </div>

          {message && (
            <div
              className={`p-4 rounded-2xl mb-6 text-xs font-medium ${
                message.isError
                  ? "bg-red-500/20 text-red-300 border border-red-500/30"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                Nombre del Administrador / Curador *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Sofía Rossi"
                required
                className="w-full px-4 py-3 rounded-2xl bg-neutral-950 border border-white/10 text-white text-sm focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                Correo Electrónico *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sofia@museo.com"
                required
                className="w-full px-4 py-3 rounded-2xl bg-neutral-950 border border-white/10 text-white text-sm focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                Título del Museo *
              </label>
              <input
                type="text"
                value={museumTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Ej. Galería de Arte Contemporáneo"
                required
                className="w-full px-4 py-3 rounded-2xl bg-neutral-950 border border-white/10 text-white text-sm focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                Slug Público (URL) *
              </label>
              <div className="flex items-center">
                <span className="px-3.5 py-3 rounded-l-2xl bg-neutral-800 border border-r-0 border-white/10 text-xs text-neutral-400 font-mono">
                  /m/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="galeria-arte-contemporaneo"
                  required
                  className="w-full px-4 py-3 rounded-r-2xl bg-neutral-950 border border-white/10 text-white text-sm font-mono focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            <div className="sm:col-span-2 pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {isSubmitting ? "Registrando..." : "Crear Museo & Dar de Alta"}
              </button>
            </div>
          </form>
        </div>

        {/* Tabla de Museos Registrados */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-white">Museos Registrados en la Plataforma</h3>

          <div className="bg-neutral-900/40 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase text-neutral-400 bg-neutral-950/40">
                    <th className="py-4 px-6 font-semibold">Museo</th>
                    <th className="py-4 px-6 font-semibold">Admin / Curador</th>
                    <th className="py-4 px-6 font-semibold">Obras</th>
                    <th className="py-4 px-6 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {museums.map((m) => (
                    <tr key={m.id} className="hover:bg-neutral-800/30 transition-colors">
                      <td className="py-4 px-6">
                        <span className="font-semibold text-white block">{m.title}</span>
                        <span className="text-xs text-amber-400/80 font-mono">/m/{m.slug}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-white block font-medium">{m.user.name}</span>
                        <span className="text-xs text-neutral-400">{m.user.email}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 rounded-full bg-neutral-800 text-xs font-semibold text-neutral-200">
                          {m._count.artworks} obras
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/m/${m.slug}`}
                            target="_blank"
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                            title="Recorrer en 3D"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Visitar 3D</span>
                          </Link>

                          <Link
                            href="/admin"
                            className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs flex items-center gap-1.5 transition-colors"
                            title="Administrar Museo"
                          >
                            <Sliders className="w-3.5 h-3.5 text-neutral-400" />
                            <span>Gestionar</span>
                          </Link>

                          <button
                            onClick={() => handleDelete(m.id, m.title)}
                            className="p-2 rounded-xl text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Eliminar Museo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
