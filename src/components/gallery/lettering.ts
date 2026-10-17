import type { CanvasTexture } from "three";
import { makeWallLetteringTexture } from "./text-textures";

/** Lettering tones for a wall: dark letters on a light wall, light letters on a dark one. */
export function makeWallLettering({ title, subtitle, family, dark, aspect }: { title: string; subtitle: string; family: string; dark: boolean; aspect: number }): CanvasTexture {
  return makeWallLetteringTexture({
    title,
    subtitle,
    aspect,
    family,
    color: dark ? "#efe7d8" : "#2b2825",
    light: dark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.85)",
    dark: dark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.22)",
    pixelHeight: 256,
  });
}
