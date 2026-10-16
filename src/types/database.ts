// Hand-written types matching the migrations in supabase/migrations (initial schema,
// museum theme, nullable artwork frame, one museum per user).

export type UserRole = "super_admin" | "owner";
export type FontPairing = "classic" | "modern" | "editorial" | "handwritten";
export type WallStyle =
  | "plaster"
  | "brick"
  | "concrete"
  | "wood_panel"
  | "marble"
  | "velvet"
  | "linen"
  | "custom_color";
export type ThemePreset =
  | "dark_elegant"
  | "light_modern"
  | "warm_classic"
  | "midnight_blue"
  | "minimal_mono";
export type FloorStyle = "parquet" | "marble" | "concrete" | "carpet" | "dark_wood";
export type FloorDecoration =
  | "none"
  | "red_carpet"
  | "runner_gold_trim"
  | "rug_persian"
  | "rug_geometric"
  | "spotlight_pool";
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };
export type LightingPreset = "warm" | "cold" | "dramatic" | "soft";
export type FrameStyle =
  | "minimal"
  | "wood"
  | "gold"
  | "metallic"
  | "canvas_wrap"
  | "black_gallery"
  | "vintage_ornate"
  | "floating_glass";

export type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type ProfileInsert = Pick<ProfileRow, "id" | "email"> &
  Partial<Omit<ProfileRow, "id" | "email">>;
export type ProfileUpdate = Partial<ProfileRow>;

/** A museum. Each owner has at most one (unique index on owner_id). */
export type MuseumRow = {
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  is_published: boolean;
  accent_color: string;
  font_pairing: FontPairing;
  theme_preset: ThemePreset;
  theme_overrides: Json;
  default_hall_id: string | null;
  cover_image_path: string | null;
  created_at: string;
  updated_at: string;
};
export type MuseumInsert = Pick<MuseumRow, "owner_id" | "slug" | "title"> &
  Partial<Omit<MuseumRow, "owner_id" | "slug" | "title">>;
export type MuseumUpdate = Partial<MuseumRow>;

export type HallRow = {
  id: string;
  museum_id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  wall_style: WallStyle;
  wall_color: string | null;
  floor_style: FloorStyle;
  floor_decoration: FloorDecoration;
  floor_decoration_color: string | null;
  decor: Json;
  lighting_preset: LightingPreset;
  default_frame_style: FrameStyle;
  accent_color: string | null;
  cover_artwork_id: string | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
};
export type HallInsert = Pick<HallRow, "museum_id" | "name" | "slug"> &
  Partial<Omit<HallRow, "museum_id" | "name" | "slug">>;
export type HallUpdate = Partial<HallRow>;

export type ArtworkRow = {
  id: string;
  museum_id: string;
  hall_id: string | null;
  title: string;
  description: string | null;
  author_name: string | null;
  year: number | null;
  image_path: string | null;
  external_image_url: string | null;
  width_px: number | null;
  height_px: number | null;
  aspect_ratio: number | null;
  /** Null (after migration 20261017000000) means "use the hall's default frame style". */
  frame_style: FrameStyle | null;
  frame_color: string | null;
  mat: boolean;
  mat_color: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type ArtworkInsert = Pick<ArtworkRow, "museum_id" | "title"> &
  Partial<Omit<ArtworkRow, "museum_id" | "title">>;
export type ArtworkUpdate = Partial<ArtworkRow>;

export type Database = {
  public: {
    Tables: {
      profiles: { Row: ProfileRow; Insert: ProfileInsert; Update: ProfileUpdate; Relationships: [] };
      museums: { Row: MuseumRow; Insert: MuseumInsert; Update: MuseumUpdate; Relationships: [] };
      halls: { Row: HallRow; Insert: HallInsert; Update: HallUpdate; Relationships: [] };
      artworks: { Row: ArtworkRow; Insert: ArtworkInsert; Update: ArtworkUpdate; Relationships: [] };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
