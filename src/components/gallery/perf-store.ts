// A tiny mutable record shared by the diagnostics overlay (?debug=perf) and the scene.
// Writing a few numbers is free, so the scene always fills it; only the overlay reads it.

export type PerfSnapshot = {
  tier: string;
  /** Rung of the degradation ladder the governor has reached (0 = the tier as detected). */
  level: number;
  /** Drawing-buffer pixel ratio right now (lower while the camera glides). */
  pixelRatio: number;
  fps: number;
  frameMs: number;
  /** CPU time spent inside gl.render per frame. */
  renderCpuMs: number;
  calls: number;
  triangles: number;
  textures: number;
  geometries: number;
  programs: number;
  /** Rough GPU texture memory in MB (width x height x 4 x 1.33 for mipmaps). */
  textureMB: number;
  /** Time spent compiling shaders behind the loading screen. */
  compileMs: number;
  /** performance.now() when the first frame was drawn after the scene mounted. */
  firstFrameMs: number;
};

export const perfStore: PerfSnapshot = {
  tier: "",
  level: 0,
  pixelRatio: 1,
  fps: 0,
  frameMs: 0,
  renderCpuMs: 0,
  calls: 0,
  triangles: 0,
  textures: 0,
  geometries: 0,
  programs: 0,
  textureMB: 0,
  compileMs: 0,
  firstFrameMs: 0,
};

export function isPerfDebug(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("debug") === "perf";
  } catch {
    return false;
  }
}
