import type { Texture } from "three";
import type { FloorStyle, WallStyle } from "@/types/database";
import { disposeMaps, makeFloorMaps, makePileMaps, makeRugTexture, makeWallMaps, type SurfaceMaps } from "./surfaces";

/** Memoizes procedural textures for one scene and disposes them all together. */
export class SurfaceCache {
  private readonly maps = new Map<string, SurfaceMaps>();
  private readonly rugs = new Map<string, Texture>();

  constructor(
    private readonly size: number,
    private readonly anisotropy: number,
    /** Skip bump and roughness maps (the cheap tier uses unlit-by-PBR Lambert materials). */
    private readonly colorOnly = false,
  ) {}

  private surface(key: string, create: () => SurfaceMaps): SurfaceMaps {
    let entry = this.maps.get(key);
    if (!entry) {
      entry = create();
      this.maps.set(key, entry);
    }
    return entry;
  }

  wall(style: WallStyle, color: string): SurfaceMaps {
    return this.surface(`wall:${style}:${color}`, () => makeWallMaps(style, color, this.size, this.anisotropy, this.colorOnly));
  }

  floor(style: FloorStyle, color: string): SurfaceMaps {
    return this.surface(`floor:${style}:${color}`, () => makeFloorMaps(style, color, this.size, this.anisotropy, this.colorOnly));
  }

  pile(color: string): SurfaceMaps {
    return this.surface(`pile:${color}`, () => makePileMaps(color, Math.min(this.size, 512), this.anisotropy, this.colorOnly));
  }

  /** Wood used for frames, tinted by the frame color. */
  wood(color: string): SurfaceMaps {
    return this.surface(`wood:${color}`, () => makeFloorMaps("dark_wood", color, Math.min(this.size, 512), this.anisotropy, this.colorOnly));
  }

  rug(color: string, persian: boolean): Texture {
    const key = `${persian ? "p" : "g"}:${color}`;
    let texture = this.rugs.get(key);
    if (!texture) {
      texture = makeRugTexture(color, persian, this.anisotropy);
      this.rugs.set(key, texture);
    }
    return texture;
  }

  dispose() {
    this.maps.forEach(disposeMaps);
    this.maps.clear();
    this.rugs.forEach((texture) => texture.dispose());
    this.rugs.clear();
  }
}
