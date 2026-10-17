import { BufferGeometry, Color, Float32BufferAttribute, PlaneGeometry, type BufferAttribute } from "three";
import { floorLightInto, tintChannel, wallLightInto, type BakedLight, type BakedSpot } from "@/lib/gallery/baked-light";
import { scaleUv } from "./geometry";

// Geometry builders for the baked tier: walls and floors with their lighting stored in vertex colors.

const WALL_ROW = 0.3;
const WALL_COLUMN = 0.45;
const FLOOR_CELL = 0.5;

type Bake = { spots: readonly BakedSpot[]; glow: number; spot: Color; /** `darkness` of the surface color. */ lift: number };

function paintVertex(colors: Float32Array, index: number, light: BakedLight, spot: Color) {
  const base = index * 3;
  colors[base] = light.gain * tintChannel(1, spot.r, light.pool);
  colors[base + 1] = light.gain * tintChannel(1, spot.g, light.pool);
  colors[base + 2] = light.gain * tintChannel(1, spot.b, light.pool);
}

/** A wall plane (centered on `centerX`, standing on the floor) with the baked light in its vertex colors. */
export function bakedWall(length: number, height: number, tileMeters: number, centerX: number, bake: Bake): BufferGeometry {
  const geometry = new PlaneGeometry(length, height, Math.max(1, Math.ceil(length / WALL_COLUMN)), Math.max(1, Math.ceil(height / WALL_ROW)));
  scaleUv(geometry, length / tileMeters, height / tileMeters);
  const position = geometry.getAttribute("position") as BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  const light: BakedLight = { gain: 1, pool: 0 };
  for (let i = 0; i < position.count; i += 1) {
    wallLightInto(light, centerX + position.getX(i), position.getY(i) + height / 2, height, bake.spots, bake.glow, bake.lift);
    paintVertex(colors, i, light, bake.spot);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}

/**
 * A horizontal floor plane (rotate it with `rotation={[-PI / 2, 0, 0]}` and place it at z = depth / 2): the
 * plane's local +y points toward the wall, so the distance from the wall is `depth / 2 - y`.
 */
export function bakedFloor(length: number, depth: number, tileMeters: number, centerX: number, bake: Bake): BufferGeometry {
  const geometry = new PlaneGeometry(length, depth, Math.max(1, Math.ceil(length / FLOOR_CELL)), Math.max(1, Math.ceil(depth / FLOOR_CELL)));
  scaleUv(geometry, length / tileMeters, depth / tileMeters);
  const position = geometry.getAttribute("position") as BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  const light: BakedLight = { gain: 1, pool: 0 };
  for (let i = 0; i < position.count; i += 1) {
    floorLightInto(light, centerX + position.getX(i), depth / 2 - position.getY(i), depth, bake.spots, bake.glow, bake.lift);
    paintVertex(colors, i, light, bake.spot);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}
