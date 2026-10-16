// Shared class names for viewer chrome. Colors come from theme tokens only.
const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-theme px-5 text-base font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";

export const btnPrimary = `${base} bg-accent text-on-accent shadow-sm hover:brightness-95`;
export const btnGhost = `${base} border border-line bg-raised text-fg hover:bg-surface`;
export const btnIcon =
  "inline-flex size-12 items-center justify-center rounded-full border border-line bg-raised text-fg transition hover:bg-surface active:scale-95";
