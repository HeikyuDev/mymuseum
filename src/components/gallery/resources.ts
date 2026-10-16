import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Material,
  type Side,
  type Texture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Shares geometries and materials by key for one scene, so repeated elements (mouldings,
 * baseboards, frames of the same size, props) cost one upload and one program, and disposes
 * everything together when the scene goes away.
 */
export class Resources {
  private readonly geometries = new Map<string, BufferGeometry>();
  private readonly materials = new Map<string, Material>();
  private readonly textures = new Map<string, Texture>();

  constructor(
    /** Lambert materials with pre-lit textures instead of PBR (low tier). */
    readonly simple: boolean,
  ) {}

  geometry(key: string, create: () => BufferGeometry): BufferGeometry {
    let entry = this.geometries.get(key);
    if (!entry) {
      entry = create();
      this.geometries.set(key, entry);
    }
    return entry;
  }

  texture<T extends Texture>(key: string, create: () => T): T {
    let entry = this.textures.get(key);
    if (!entry) {
      entry = create();
      this.textures.set(key, entry);
    }
    return entry as T;
  }

  material<T extends Material>(key: string, create: () => T): T {
    let entry = this.materials.get(key);
    if (!entry) {
      entry = create();
      this.materials.set(key, entry);
    }
    return entry as T;
  }

  /** Flat, unlit material (labels, glows, baked gradients). */
  basic(key: string, params: { color?: string; map?: Texture | null; opacity?: number; transparent?: boolean; additive?: boolean; side?: Side; depthWrite?: boolean }): MeshBasicMaterial {
    return this.material(`basic:${key}`, () => {
      const material = new MeshBasicMaterial({
        color: params.color ?? "#ffffff",
        map: params.map ?? null,
        transparent: params.transparent ?? (params.opacity !== undefined || params.additive === true),
        opacity: params.opacity ?? 1,
        depthWrite: params.depthWrite ?? params.additive !== true,
        side: params.side,
        toneMapped: false,
      });
      if (params.additive) material.blending = 2; // AdditiveBlending
      return material;
    });
  }

  /**
   * A lit surface: PBR on medium and high, Lambert on low. `shine` scales the environment
   * reflections (0 = matte) so halls with the lights off stay free of glare.
   */
  surface(
    key: string,
    params: {
      color?: string;
      map?: Texture | null;
      bumpMap?: Texture | null;
      bumpScale?: number;
      roughnessMap?: Texture | null;
      roughness?: number;
      metalness?: number;
      envMapIntensity?: number;
      shine?: number;
      side?: Side;
      vertexColors?: boolean;
    },
  ): MeshStandardMaterial | MeshLambertMaterial {
    return this.material(`surface:${this.simple ? "s" : "p"}:${key}`, () => {
      if (this.simple) {
        // Metals read as dark without reflections; lift them toward their own color.
        const color = new Color(params.color ?? "#ffffff");
        if ((params.metalness ?? 0) > 0.5) color.multiplyScalar(0.85);
        return new MeshLambertMaterial({ color, map: params.map ?? null, side: params.side, vertexColors: params.vertexColors });
      }
      return new MeshStandardMaterial({
        color: params.color ?? "#ffffff",
        map: params.map ?? null,
        bumpMap: params.bumpMap ?? null,
        bumpScale: params.bumpScale ?? 1,
        roughnessMap: params.roughnessMap ?? null,
        roughness: params.roughness ?? 0.9,
        metalness: params.metalness ?? 0,
        envMapIntensity: (params.envMapIntensity ?? 0.25) * (params.shine ?? 1),
        side: params.side,
        vertexColors: params.vertexColors,
      });
    });
  }

  /** Acrylic front panel of floating-glass frames: a subtle sheen, nothing more. */
  glass(shine: number): MeshPhysicalMaterial {
    return this.material(`glass:${shine}`, () =>
      new MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.1, roughness: 0.08, metalness: 0, clearcoat: 0.6, envMapIntensity: 1.2 * shine, depthWrite: false }),
    );
  }

  dispose() {
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.geometries.clear();
    this.textures.forEach((texture) => texture.dispose());
    this.materials.clear();
    this.textures.clear();
  }
}

/** Paints every vertex of a geometry with one color (for merged props that share one material). */
export function colored<T extends BufferGeometry>(geometry: T, hex: string): T {
  const color = new Color(hex);
  const count = geometry.getAttribute("position").count;
  const data = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) color.toArray(data, i * 3);
  geometry.setAttribute("color", new Float32BufferAttribute(data, 3));
  return geometry;
}

/** Merges geometries that share a material into one (one draw call). Inputs are disposed. */
export function mergeAll(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  if (!merged) throw new Error("geometries could not be merged");
  return merged;
}
