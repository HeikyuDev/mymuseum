import { resolveMuseumTheme } from "@/lib/theme";

// The admin UI is deliberately NOT themed by the museum preset, so owners can
// always read it. It reuses the same CSS variable tokens with a fixed light palette.
export const ADMIN_THEME = resolveMuseumTheme({
  theme_preset: "minimal_mono",
  accent_color: "#2b4acb",
  font_pairing: "modern",
  theme_overrides: { radius: "soft", density: "comfortable", motion: "normal" },
});
