export type Role = "USER" | "ADMIN";

export type FrameStyle =
  | "MINIMALIST"
  | "WOOD"
  | "GOLD"
  | "METALLIC"
  | "CANVAS_WRAP";

export type LightingPreset =
  | "WARM_GALLERY"
  | "COLD_CONTEMPORARY"
  | "NEON_NOIR"
  | "DRAMATIC_SPOTLIGHT";

export type WallTexture = "plaster_smooth" | "concrete" | "brick";

export type FloorTexture = "wood_parquet" | "polished_marble" | "concrete";

export interface MuseumSettingsData {
  id: string;
  museumId: string;
  wallColor: string;
  wallTexture: WallTexture;
  floorTexture: FloorTexture;
  ceilingColor: string;
  defaultFrameStyle: FrameStyle;
  defaultFrameColor: string;
  lightingPreset: LightingPreset;
  ambientIntensity: number;
  spotlightIntensity: number;
  backgroundMusicUrl?: string | null;
  updatedAt: Date;
}

export interface ArtworkData {
  id: string;
  museumId: string;
  title: string;
  artistName: string;
  description?: string | null;
  year?: number | null;
  imageUrl: string;
  thumbnailUrl?: string | null;
  aspectRatio: number;
  widthMeters: number;
  heightMeters: number;
  wallIndex: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationY: number;
  frameStyle?: FrameStyle | null;
  frameColor?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MuseumWithRelations {
  id: string;
  userId: string;
  title: string;
  slug: string;
  description?: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  settings: MuseumSettingsData | null;
  artworks: ArtworkData[];
}
