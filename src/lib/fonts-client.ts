import { FONT_PAIRING_STACKS } from "@/lib/theme";
import type { FontPairing } from "@/types/database";

// Browser-only: turns the next/font CSS variables into real family names that
// canvases (plaques, the exported photo) can use, and waits for the faces to load.

export type CanvasFonts = { display: string; body: string };

/** Replaces `var(--x)` references with the family names next/font generated at runtime. */
export function resolveFontStack(stack: string): string {
  const root = getComputedStyle(document.documentElement);
  return stack.replace(/var\((--[\w-]+)\)/g, (_, name: string) => root.getPropertyValue(name).trim() || "serif");
}

export function resolveCanvasFonts(pairing: FontPairing): CanvasFonts {
  const stacks = FONT_PAIRING_STACKS[pairing];
  return { display: resolveFontStack(stacks.display), body: resolveFontStack(stacks.body) };
}

/** Makes sure the faces used by canvas text are loaded; never hangs on a slow font. */
export async function loadCanvasFonts(fonts: CanvasFonts, sample: string): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const text = `${sample} ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789`;
  const faces = [`600 48px ${fonts.display}`, `400 48px ${fonts.display}`, `500 24px ${fonts.body}`];
  const loading = Promise.all(faces.map((face) => document.fonts.load(face, text).catch(() => [])));
  await Promise.race([loading, new Promise((resolve) => setTimeout(resolve, 3500))]);
}
