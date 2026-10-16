import { resolveOverrides, type ThemeOverrides } from "@/lib/theme";

/**
 * Applies a partial change on top of the museum's stored `theme_overrides`.
 * Fields the patch leaves out (or sets to undefined) keep their current value,
 * so the style editor and the settings form can each save their own fields
 * without overwriting the other's. Old rows without `defaultLocale` resolve to
 * the default language.
 */
export function mergeOverrides(current: unknown, patch: Partial<ThemeOverrides>): ThemeOverrides {
  const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
  return resolveOverrides({ ...resolveOverrides(current), ...defined });
}
