import { z } from "zod";
import {
  DECOR_IDS,
  FLOOR_DECORATIONS,
  FLOOR_STYLES,
  FRAME_STYLES,
  LIGHTING_PRESETS,
  WALL_STYLES,
} from "@/lib/hall-style";
import { FONT_PAIRING_STACKS, THEME_OVERRIDE_OPTIONS, THEME_PRESETS } from "@/lib/theme";
import { slugSchema } from "@/lib/validation/slug";
import type {
  FloorDecoration,
  FloorStyle,
  FontPairing,
  FrameStyle,
  LightingPreset,
  ThemePreset,
  WallStyle,
} from "@/types/database";

function enumOf<T extends string>(values: readonly T[]) {
  return z.enum(values as unknown as [T, ...T[]], { error: "Choose one of the available options." });
}

const HEX = /^#[0-9a-fA-F]{6}$/;
export const hexSchema = z.string().regex(HEX, "Use a color like #c9a227.");
const optionalHex = hexSchema.nullish().transform((value) => value ?? null);

/** Trims, enforces a max length and turns empty input into null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .nullish()
    .transform((value) => (value ? value : null));

const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `Use at most ${max} characters.`);

export const uuidSchema = z.uuid({ error: "Invalid identifier." });
const optionalUuid = uuidSchema.nullish().transform((value) => value ?? null);

export const museumCreateSchema = z.object({
  title: requiredText("Title", 120),
  slug: slugSchema,
  tagline: optionalText(200),
});

export const museumSettingsSchema = z.object({
  title: requiredText("Title", 120),
  slug: slugSchema,
  tagline: optionalText(200),
  description: optionalText(2000),
});

export const appearanceSchema = z.object({
  theme_preset: enumOf(Object.keys(THEME_PRESETS) as ThemePreset[]),
  accent_color: hexSchema,
  font_pairing: enumOf(Object.keys(FONT_PAIRING_STACKS) as FontPairing[]),
  theme_overrides: z.object({
    radius: enumOf(THEME_OVERRIDE_OPTIONS.radius),
    density: enumOf(THEME_OVERRIDE_OPTIONS.density),
    motion: enumOf(THEME_OVERRIDE_OPTIONS.motion),
  }),
  default_hall_id: optionalUuid,
  cover_image_path: z.string().max(300).nullish().transform((value) => value || null),
});

const decorSchema = z
  .object(Object.fromEntries(DECOR_IDS.map((id) => [id, z.boolean().optional()])) as Record<
    (typeof DECOR_IDS)[number],
    z.ZodOptional<z.ZodBoolean>
  >)
  .transform((bag) => Object.fromEntries(DECOR_IDS.map((id) => [id, bag[id] === true])));

export const hallFieldsSchema = z
  .object({
    name: requiredText("Name", 80),
    description: optionalText(1000),
    is_visible: z.boolean(),
    wall_style: enumOf<WallStyle>(WALL_STYLES),
    wall_color: optionalHex,
    floor_style: enumOf<FloorStyle>(FLOOR_STYLES),
    floor_decoration: enumOf<FloorDecoration>(FLOOR_DECORATIONS),
    floor_decoration_color: optionalHex,
    lighting_preset: enumOf<LightingPreset>(LIGHTING_PRESETS),
    default_frame_style: enumOf<FrameStyle>(FRAME_STYLES),
    accent_color: optionalHex,
    decor: decorSchema,
  })
  .refine((value) => value.wall_style !== "custom_color" || value.wall_color !== null, {
    path: ["wall_color"],
    message: "Pick a wall color for the custom color style.",
  });

export const hallCreateSchema = z.object({
  name: requiredText("Name", 80),
  description: optionalText(1000),
});

const year = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === null || value === undefined || value === "") return null;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 3000) {
      ctx.addIssue({ code: "custom", message: "Enter a year between 0 and 3000." });
      return z.NEVER;
    }
    return n;
  });

export const artworkFieldsSchema = z.object({
  title: requiredText("Title", 160),
  description: optionalText(2000),
  author_name: optionalText(120),
  year,
  hall_id: optionalUuid,
  /** null = inherit the hall's default frame style. */
  frame_style: enumOf<FrameStyle>(FRAME_STYLES).nullish().transform((value) => value ?? null),
  frame_color: optionalHex,
  mat: z.boolean(),
  mat_color: optionalHex,
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(1_000_000),
});

export const artworkCreateSchema = z.object({
  id: uuidSchema,
  image_path: z.string().min(3).max(300),
  title: requiredText("Title", 160),
  hall_id: optionalUuid,
  width_px: z.number().int().positive().max(20000),
  height_px: z.number().int().positive().max(20000),
  aspect_ratio: z.number().positive().max(1000),
});

export type MuseumCreateInput = z.input<typeof museumCreateSchema>;
export type HallFieldsInput = z.input<typeof hallFieldsSchema>;
export type ArtworkFieldsInput = z.input<typeof artworkFieldsSchema>;
export type AppearanceInput = z.input<typeof appearanceSchema>;

/** Flattens Zod issues into `{ field: firstMessage }` for form display. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}
