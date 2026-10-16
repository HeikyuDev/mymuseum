import { PlaneGeometry, type BufferGeometry } from "three";

/** A plane whose UVs are in tiles (1 uv unit = `tileMeters` of surface). */
export function metricPlane(width: number, height: number, tileMeters: number): PlaneGeometry {
  const geometry = new PlaneGeometry(width, height);
  scaleUv(geometry, width / tileMeters, height / tileMeters);
  return geometry;
}

export function scaleUv(geometry: BufferGeometry, su: number, sv: number): void {
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
}

/** Converts UVs expressed in meters (ShapeGeometry) into tile units. */
export function metersToTiles(geometry: BufferGeometry, tileMeters: number): void {
  scaleUv(geometry, 1 / tileMeters, 1 / tileMeters);
}
