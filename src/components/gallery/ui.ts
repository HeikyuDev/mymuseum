// Shared class names for the floating controls over the 3D scene.
// Flat, semi-opaque fills only: backdrop blur, big shadows and filters over a WebGL canvas force the
// compositor to re-blend the canvas every frame, which is what phones cannot afford.
export const glass =
  "inline-flex items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/30 transition-[background-color,transform] duration-200 active:scale-95";
export const glassHover = "hover:bg-black/60 hover:ring-white/50";
