"use client";

import { useSyncExternalStore } from "react";
import { QUALITY, detectTier, parsePreference, type QualityPreference, type QualitySettings, type QualityTier } from "@/lib/gallery/quality";

export type DeviceProfile = {
  webgl: boolean;
  /** Tier chosen from the device signals (or forced with ?quality=). The governor may go lower. */
  tier: QualityTier;
  /** True when ?quality= forced the tier: the governor and the stored preference stay out of it. */
  forced: boolean;
  reducedMotion: boolean;
};

let cached: DeviceProfile | null = null;

function probeWebgl(): { ok: boolean; software: boolean; renderer: string; maxTexture: number } {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return { ok: false, software: false, renderer: "", maxTexture: 0 };
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    const maxTexture = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { ok: true, software: /swiftshader|llvmpipe|software|basic render/i.test(renderer), renderer, maxTexture };
  } catch {
    return { ok: false, software: false, renderer: "", maxTexture: 0 };
  }
}

function detect(embedded: boolean): DeviceProfile {
  const gl = probeWebgl();
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const forced = new URLSearchParams(window.location.search).get("quality");
  const override = forced === "low" || forced === "medium" || forced === "high" ? forced : null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tier =
    override ??
    detectTier({
      viewportWidth: window.innerWidth,
      coarsePointer: window.matchMedia("(pointer: coarse)").matches,
      deviceMemory: nav.deviceMemory,
      hardwareConcurrency: nav.hardwareConcurrency,
      softwareRenderer: gl.software,
      rendererName: gl.renderer,
      maxTextureSize: gl.maxTexture || undefined,
      embedded,
      reducedData: nav.connection?.saveData === true,
      reducedMotion,
    });
  return { webgl: gl.ok, tier, forced: override !== null, reducedMotion };
}

/** The tier this device would start on (used by exports to size their memory budget). */
export function detectDeviceTier(): QualityTier {
  cached ??= detect(false);
  return cached.tier;
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

// ---- stored preference (Auto / High / Low) --------------------------------------------------

const PREFERENCE_KEY = "mymuseum.quality";

export function readPreference(): QualityPreference {
  try {
    return parsePreference(window.localStorage.getItem(PREFERENCE_KEY));
  } catch {
    return "auto";
  }
}

export function writePreference(value: QualityPreference): void {
  try {
    if (value === "auto") window.localStorage.removeItem(PREFERENCE_KEY);
    else window.localStorage.setItem(PREFERENCE_KEY, value);
  } catch {
    // Storage can be blocked (private windows); the choice then lasts for this visit only.
  }
}
