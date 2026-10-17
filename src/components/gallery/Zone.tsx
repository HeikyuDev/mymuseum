"use client";

import { Suspense, lazy, useMemo } from "react";
import { BoxGeometry, Color, DoubleSide, MeshLambertMaterial, MeshPhysicalMaterial, PlaneGeometry, type Material } from "three";
import { darkness, type BakedSpot } from "@/lib/gallery/baked-light";
import { ROOM_DEPTH, WALL_HEIGHT, type MuseumLayout } from "@/lib/gallery/layout";
import { FLOOR_FINISH, WALL_FINISH, isDarkColor, type ZoneLook } from "@/lib/gallery/scene-look";
import { useGallery } from "./context";
import { metricPlane } from "./geometry";
import { bakedFloor, bakedWall } from "./baked-surfaces";
import { LedCove, useMicrocement } from "./EntranceWall";
import { FloorDecoration } from "./FloorDecoration";
import { Props3d } from "./Props3d";
import { mergeAll } from "./resources";

// The polished-floor reflector pulls in a large part of drei, so it is only fetched (as its
// own chunk) when a high-tier visitor actually has a glossy floor.
const ReflectorFloor = lazy(() => import("./ReflectorFloor"));

type Props = {
  zoneIndex: number;
  /** Floor and ceiling extent along x. */
  floorRange: readonly [number, number];
  /** Plain wall extents along x (the divider walls between categories are separate). */
  wallRanges: readonly (readonly [number, number])[];
  layout: MuseumLayout;
  isFirst: boolean;
  isLast: boolean;
  look: ZoneLook;
};

const f3 = (value: number) => value.toFixed(3);

export function Zone({ zoneIndex, floorRange, wallRanges, layout, isFirst, isLast, look }: Props) {
  const { surfaces, resources, mood, quality, baked } = useGallery();
  const [f0, f1] = floorRange;
  const floorLength = f1 - f0;
  const floorCenter = (f0 + f1) / 2;
  const shine = look.lighting.shine;

  const floorMaps = surfaces.floor(look.floorStyle, look.floorColor);
  const floorFinish = FLOOR_FINISH[look.floorStyle];
  const darkWall = isDarkColor(look.wallColor);

  // The baked tier carries its lighting in vertex colors: pools of light in front of every artwork.
  const spots = useMemo<BakedSpot[]>(() => layout.artworks.filter((a) => a.zoneIndex === zoneIndex).map((a) => ({ x: a.x, halfWidth: a.outerW / 2 })), [layout, zoneIndex]);
  const spotColor = useMemo(() => new Color(look.lighting.spot), [look.lighting.spot]);
  const bakedLit = quality.baked;
  const floorGeometry = resources.geometry(`floor:${bakedLit ? `b${zoneIndex}:` : ""}${f3(floorLength)}:${floorMaps.tileMeters}`, () =>
    bakedLit ? bakedFloor(floorLength, ROOM_DEPTH, floorMaps.tileMeters, floorCenter, { spots, glow: look.lighting.glow, spot: spotColor, lift: darkness(look.floorColor) }) : metricPlane(floorLength, ROOM_DEPTH, floorMaps.tileMeters),
  );
  const ceilingGeometry = resources.geometry(`ceiling:${f3(floorLength)}`, () => metricPlane(floorLength, ROOM_DEPTH, 2));

  const trim = useMemo(() => {
    const base = new Color(darkWall ? look.wallColor : "#ece8df");
    if (darkWall) base.multiplyScalar(0.55);
    return `#${base.getHexString()}`;
  }, [darkWall, look.wallColor]);
  // The entrance and end walls are fine microcement in a neutral tone that belongs to this hall.
  const micro = useMicrocement(look.wallColor);
  const entranceLook = useMemo<ZoneLook>(() => ({ ...look, wallStyle: "plaster", wallColor: micro.color }), [look, micro.color]);
  const microTrim = micro.dark ? "#2a2724" : "#ddd8ce";
  const endMaps = surfaces.wall("plaster", micro.color);
  const ceilingColor = darkWall ? "#c4bdb2" : "#eeeae2";
  const roomBack = darkWall ? look.wallColor : "#e4e0d8";

  const reflective = quality.reflector && floorFinish.reflective && shine > 0.3;
  const tint = `#${new Color(mood.tint).getHexString()}`;
  const floorMaterial = resources.surface(`floor:${look.floorStyle}:${look.floorColor}:${tint}:${shine}${bakedLit ? ":vc" : ""}`, {
    vertexColors: bakedLit,
    map: floorMaps.color,
    bumpMap: floorMaps.bump,
    bumpScale: 0.35,
    roughnessMap: floorMaps.rough,
    color: tint,
    roughness: Math.min(1, floorFinish.roughness + (1 - shine) * 0.4),
    metalness: floorFinish.metalness,
    envMapIntensity: floorFinish.reflective ? 0.9 : 0.25,
    shine,
  });
  const ceilingMaterial = resources.surface(`ceiling:${ceilingColor}`, { color: ceilingColor, roughness: 0.95, side: DoubleSide });
  const backMaterial = resources.surface(`back:${roomBack}`, { color: roomBack, roughness: 0.95 });
  const endGeometry = resources.geometry(`room-end:${endMaps.tileMeters}`, () => metricPlane(ROOM_DEPTH, WALL_HEIGHT, endMaps.tileMeters));
  const endMaterial = wallMaterialFor(resources, entranceLook, endMaps, mood.tint, false);
  const backGeometry = resources.geometry(`room-back:${f3(floorLength)}`, () => new PlaneGeometry(floorLength, WALL_HEIGHT));

  // Baked stand-ins for what real lights and reflections would do (low tier only).
  const sheenMaterial = quality.baked && floorFinish.reflective && shine > 0.1 ? resources.basic(`sheen:${shine}`, { map: baked.floorSheen, opacity: 0.55 * shine, additive: true }) : null;
  const sheenGeometry = sheenMaterial ? resources.geometry(`sheen:${f3(floorLength)}`, () => new PlaneGeometry(floorLength, 3.4)) : null;

  return (
    <group userData={{ cull: [f0, f1] }}>
      {wallRanges.map((range) => {
        const entrance = isFirst && range[0] === layout.minX;
        return <WallSegment key={range[0]} range={range} look={entrance ? entranceLook : look} trim={entrance ? microTrim : trim} modern={entrance} zoneIndex={zoneIndex} spots={spots} spotColor={spotColor} />;
      })}

      {/* floor */}
      <mesh geometry={floorGeometry} position={[floorCenter, 0, ROOM_DEPTH / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={quality.shadows} material={reflective ? undefined : floorMaterial}>
        {reflective ? (
          <Suspense fallback={<primitive object={floorMaterial} attach="material" />}>
            <ReflectorFloor
              map={floorMaps.color}
              bumpMap={floorMaps.bump}
              roughnessMap={floorMaps.rough}
              color={tint}
              roughness={floorFinish.roughness + (1 - shine) * 0.4}
              resolution={quality.reflectorResolution}
              mixStrength={(look.floorStyle === "marble" ? 0.7 : 0.4) * shine}
            />
          </Suspense>
        ) : null}
      </mesh>
      {sheenGeometry && sheenMaterial ? <mesh geometry={sheenGeometry} material={sheenMaterial} position={[floorCenter, 0.004, 2.2]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1} /> : null}

      {/* ceiling */}
      <mesh geometry={ceilingGeometry} material={ceilingMaterial} position={[floorCenter, WALL_HEIGHT, ROOM_DEPTH / 2]} rotation={[Math.PI / 2, 0, 0]} />

      {/* opposite wall (never framed in normal views, but closes the room) */}
      <mesh geometry={backGeometry} material={backMaterial} position={[floorCenter, WALL_HEIGHT / 2, ROOM_DEPTH]} rotation={[0, Math.PI, 0]} />
      {isFirst ? <mesh geometry={endGeometry} material={endMaterial} position={[f0, WALL_HEIGHT / 2, ROOM_DEPTH / 2]} rotation={[0, Math.PI / 2, 0]} receiveShadow={quality.shadows} /> : null}
      {isFirst ? <LedCove length={ROOM_DEPTH} x={f0} z={ROOM_DEPTH / 2} rotationY={Math.PI / 2} /> : null}
      {isLast ? <mesh geometry={endGeometry} material={endMaterial} position={[f1, WALL_HEIGHT / 2, ROOM_DEPTH / 2]} rotation={[0, -Math.PI / 2, 0]} receiveShadow={quality.shadows} /> : null}
      {isLast ? <LedCove length={ROOM_DEPTH} x={f1} z={ROOM_DEPTH / 2} rotationY={-Math.PI / 2} /> : null}
      {isLast ? <LedCove length={6} x={f1 - 3} /> : null}

      <FloorDecoration zoneIndex={zoneIndex} look={look} layout={layout} range={floorRange} />
      <Props3d zoneIndex={zoneIndex} look={look} layout={layout} />
    </group>
  );
}

/** Wall material for a look: PBR (sheen for velvet and linen), or Lambert on the cheap tier. */
export function wallMaterialFor(
  resources: ReturnType<typeof useGallery>["resources"],
  look: ZoneLook,
  maps: { color: ReturnType<ReturnType<typeof useGallery>["surfaces"]["wall"]>["color"]; bump: ReturnType<ReturnType<typeof useGallery>["surfaces"]["wall"]>["bump"]; rough: ReturnType<ReturnType<typeof useGallery>["surfaces"]["wall"]>["rough"] },
  tint: string,
  /** The geometry carries baked light in its vertex colors (baked tier). */
  vertexColors = false,
): Material {
  const finish = WALL_FINISH[look.wallStyle];
  const shine = look.lighting.shine;
  const key = `wall:${look.wallStyle}:${look.wallColor}:${tint}:${shine}`;
  if (resources.simple) return resources.material(`${key}:l${vertexColors ? ":vc" : ""}`, () => new MeshLambertMaterial({ map: maps.color, color: tint, vertexColors }));
  if (look.wallStyle === "velvet" || look.wallStyle === "linen") {
    return resources.material(
      key,
      () =>
        new MeshPhysicalMaterial({
          map: maps.color,
          bumpMap: maps.bump,
          bumpScale: finish.bump,
          roughnessMap: maps.rough,
          roughness: finish.roughness,
          color: tint,
          sheen: finish.sheen * Math.min(1, shine + 0.2),
          sheenRoughness: 0.7,
          sheenColor: new Color(look.wallStyle === "velvet" ? "#9c4a62" : "#f2ebdc"),
          envMapIntensity: 0.15 * shine,
        }),
    );
  }
  return resources.surface(key, {
    map: maps.color,
    bumpMap: maps.bump,
    bumpScale: finish.bump,
    roughnessMap: maps.rough,
    roughness: Math.min(1, finish.roughness + (1 - shine) * 0.2),
    color: tint,
    envMapIntensity: look.wallStyle === "marble" ? 0.7 : 0.2,
    shine,
  });
}

export function WallSegment({ range, look, trim, modern = false, zoneIndex, spots, spotColor }: { range: readonly [number, number]; look: ZoneLook; trim: string; modern?: boolean; zoneIndex: number; spots: readonly BakedSpot[]; spotColor: Color }) {
  const { surfaces, resources, mood, quality } = useGallery();
  const wallMaps = surfaces.wall(look.wallStyle, look.wallColor);
  const wallLength = range[1] - range[0];
  const wallCenter = (range[0] + range[1]) / 2;
  const tint = mood.tint;
  const bakedLit = quality.baked;
  const wallGeometry = resources.geometry(`wall:${bakedLit ? `b${zoneIndex}:${look.wallStyle}:` : ""}${f3(wallCenter)}:${f3(wallLength)}:${wallMaps.tileMeters}`, () =>
    bakedLit ? bakedWall(wallLength, WALL_HEIGHT, wallMaps.tileMeters, wallCenter, { spots, glow: look.lighting.glow, spot: spotColor, lift: darkness(look.wallColor) }) : metricPlane(wallLength, WALL_HEIGHT, wallMaps.tileMeters),
  );
  const wallMaterial = wallMaterialFor(resources, look, wallMaps, tint, bakedLit);
  const trimMaterial = resources.surface(`trim:${trim}`, { color: trim, roughness: 0.75 });

  // Baseboard, its cap, the crown and its under-rail are one merged piece: one draw call per wall.
  const trimGeometry = resources.geometry(`trim:${modern ? "m" : "c"}:${f3(wallLength)}`, () => {
    const piece = (w: number, h: number, d: number, y: number, z: number) => new BoxGeometry(w, h, d).translate(0, y, z);
    // Modern walls: only a slim, almost flush baseboard (the ceiling line belongs to the LED cove).
    if (modern) return mergeAll([piece(wallLength, 0.09, 0.014, 0.045, 0.007)]);
    return mergeAll([
      piece(wallLength, 0.16, 0.04, 0.08, 0.02),
      piece(wallLength, 0.02, 0.026, 0.17, 0.012),
      piece(wallLength, 0.12, 0.1, WALL_HEIGHT - 0.06, 0.05),
      piece(wallLength, 0.1, 0.05, WALL_HEIGHT - 0.17, 0.025),
    ]);
  });

  return (
    <group>
      <mesh geometry={wallGeometry} material={wallMaterial} position={[wallCenter, WALL_HEIGHT / 2, 0]} receiveShadow={quality.shadows} />
      <mesh geometry={trimGeometry} material={trimMaterial} position={[wallCenter, 0, 0]} castShadow={quality.shadows} receiveShadow={quality.shadows} />
    </group>
  );
}
