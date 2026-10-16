"use client";

import { useSyncExternalStore } from "react";
import { QUALITY, detectTier, type QualitySettings, type QualityTier } from "@/lib/gallery/quality";

export type DeviceProfile = {
  webgl: boolean;
  tier: QualityTier;
  reducedMotion: boolean;
};

let cached: DeviceProfile | null = null;

function hasWebgl(): { ok: boolean; software: boolean } {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return { ok: false, software: false };
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { ok: true, software: /swiftshader|llvmpipe|software|basic render/i.test(renderer) };
  } catch {
    return { ok: false, software: false };
  }
}

function detect(embedded: boolean): DeviceProfile {
  const { ok, software } = hasWebgl();
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const forced = new URLSearchParams(window.location.search).get("quality");
  const override = forced === "low" || forced === "medium" || forced === "high" ? forced : null;
  const tier =
    override ??
    detectTier({
      viewportWidth: window.innerWidth,
      coarsePointer: window.matchMedia("(pointer: coarse)").matches,
      deviceMemory: nav.deviceMemory,
      hardwareConcurrency: nav.hardwareConcurrency,
      softwareRenderer: software,
      embedded,
      reducedData: nav.connection?.saveData === true,
    });
  return { webgl: ok, tier, reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches };
}

const subscribe = () => () => {};

/** Browser capabilities, computed once per page. `null` during server render and hydration. */
export function useDeviceProfile(embedded = false): DeviceProfile | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      cached ??= detect(embedded);
      return cached;
    },
    () => null,
  );
}

export function qualityFor(profile: DeviceProfile): QualitySettings {
  return QUALITY[profile.tier];
}
