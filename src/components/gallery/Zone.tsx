"use client";

import { Suspense, lazy, useMemo } from "react";
import { BoxGeometry, Color, DoubleSide, MeshLambertMaterial, MeshPhysicalMaterial, PlaneGeometry, type Material } from "three";
import { ROOM_DEPTH, WALL_HEIGHT, type MuseumLayout } from "@/lib/gallery/layout";
import { FLOOR_FINISH, WALL_FINISH, isDarkColor, type ZoneLook } from "@/lib/gallery/scene-look";
import { useGallery } from "./context";
import { metricPlane } from "./geometry";
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
  /** Plain wall extents along x (portal pieces are separate). */
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

  const floorGeometry = resources.geometry(`floor:${f3(floorLength)}:${floorMaps.tileMeters}`, () => metricPlane(floorLength, ROOM_DEPTH, floorMaps.tileMeters));
  const ceilingGeometry = resources.geometry(`ceiling:${f3(floorLength)}`, () => metricPlane(floorLength, ROOM_DEPTH, 2));

  const trim = useMemo(() => {
    const base = new Color(darkWall ? look.wallColor : "#ece8df");
    if (darkWall) base.multiplyScalar(0.55);
    return `#${base.getHexString()}`;
  }, [darkWall, look.wallColor]);
  const ceilingColor = darkWall ? "#c4bdb2" : "#eeeae2";
  const roomBack = darkWall ? look.wallColor : "#e4e0d8";

  const reflective = quality.reflector && floorFinish.reflective && shine > 0.3;
  const tint = `#${new Color(mood.tint).getHexString()}`;
  const floorMaterial = resources.surface(`floor:${look.floorStyle}:${look.floorColor}:${tint}:${shine}`, {
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
  const endGeometry = resources.geometry("room-end", () => new PlaneGeometry(ROOM_DEPTH, WALL_HEIGHT));
  const backGeometry = resources.geometry(`room-back:${f3(floorLength)}`, () => new PlaneGeometry(floorLength, WALL_HEIGHT));

  // Baked stand-ins for what real lights and reflections would do (low tier only).
  const sheenMaterial = quality.baked && floorFinish.reflective && shine > 0.1 ? resources.basic(`sheen:${shine}`, { map: baked.floorSheen, opacity: 0.55 * shine, additive: true }) : null;
  const sheenGeometry = sheenMaterial ? resources.geometry(`sheen:${f3(floorLength)}`, () => new PlaneGeometry(floorLength, 3.4)) : null;
  const floorShade = quality.baked ? resources.basic("floor-ao", { color: "#000000", map: baked.edgeShade, opacity: 1, transparent: true, depthWrite: false }) : null;
  const floorShadeGeometry = floorShade ? resources.geometry(`floor-ao:${f3(floorLength)}`, () => new PlaneGeometry(floorLength, 0.9)) : null;

  return (
    <group userData={{ cull: [f0, f1] }}>
      {wallRanges.map((range) => (
        <WallSegment key={range[0]} range={range} look={look} trim={trim} />
      ))}

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
      {floorShadeGeometry && floorShade ? <mesh geometry={floorShadeGeometry} material={floorShade} position={[floorCenter, 0.003, 0.45]} rotation={[-Math.PI / 2, 0, Math.PI]} renderOrder={1} /> : null}

      {/* ceiling */}
      <mesh geometry={ceilingGeometry} material={ceilingMaterial} position={[floorCenter, WALL_HEIGHT, ROOM_DEPTH / 2]} rotation={[Math.PI / 2, 0, 0]} />

      {/* opposite wall (never framed in normal views, but closes the room) */}
      <mesh geometry={backGeometry} material={backMaterial} position={[floorCenter, WALL_HEIGHT / 2, ROOM_DEPTH]} rotation={[0, Math.PI, 0]} />
      {isFirst ? <mesh geometry={endGeometry} material={backMaterial} position={[f0, WALL_HEIGHT / 2, ROOM_DEPTH / 2]} rotation={[0, Math.PI / 2, 0]} /> : null}
      {isLast ? <mesh geometry={endGeometry} material={backMaterial} position={[f1, WALL_HEIGHT / 2, ROOM_DEPTH / 2]} rotation={[0, -Math.PI / 2, 0]} /> : null}

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
): Material {
  const finish = WALL_FINISH[look.wallStyle];
  const shine = look.lighting.shine;
  const key = `wall:${look.wallStyle}:${look.wallColor}:${tint}:${shine}`;
  if (resources.simple) return resources.material(`${key}:l`, () => new MeshLambertMaterial({ map: maps.color, color: tint }));
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

function WallSegment({ range, look, trim }: { range: readonly [number, number]; look: ZoneLook; trim: string }) {
  const { surfaces, resources, mood, quality, baked } = useGallery();
  const wallMaps = surfaces.wall(look.wallStyle, look.wallColor);
  const wallLength = range[1] - range[0];
  const wallCenter = (range[0] + range[1]) / 2;
  const tint = mood.tint;
  const wallGeometry = resources.geometry(`wall:${f3(wallLength)}:${wallMaps.tileMeters}`, () => metricPlane(wallLength, WALL_HEIGHT, wallMaps.tileMeters));
  const wallMaterial = wallMaterialFor(resources, look, wallMaps, tint);
  const trimMaterial = resources.surface(`trim:${trim}`, { color: trim, roughness: 0.75 });

  // Baseboard, its cap, the crown and its under-rail are one merged piece: one draw call per wall.
  const trimGeometry = resources.geometry(`trim:${f3(wallLength)}`, () => {
    const piece = (w: number, h: number, d: number, y: number, z: number) => new BoxGeometry(w, h, d).translate(0, y, z);
    return mergeAll([
      piece(wallLength, 0.16, 0.04, 0.08, 0.02),
      piece(wallLength, 0.02, 0.026, 0.17, 0.012),
      piece(wallLength, 0.12, 0.1, WALL_HEIGHT - 0.06, 0.05),
      piece(wallLength, 0.1, 0.05, WALL_HEIGHT - 0.17, 0.025),
    ]);
  });

  const shade = quality.baked ? resources.basic("wall-ao", { color: "#000000", map: baked.edgeShade, opacity: 0.55, transparent: true, depthWrite: false }) : null;
  const shadeGeometry = shade ? resources.geometry(`wall-ao:${f3(wallLength)}`, () => new PlaneGeometry(wallLength, 1.1)) : null;

  return (
    <group>
      <mesh geometry={wallGeometry} material={wallMaterial} position={[wallCenter, WALL_HEIGHT / 2, 0]} receiveShadow={quality.shadows} />
      <mesh geometry={trimGeometry} material={trimMaterial} position={[wallCenter, 0, 0]} castShadow={quality.shadows} receiveShadow={quality.shadows} />
      {shadeGeometry && shade ? <mesh geometry={shadeGeometry} material={shade} position={[wallCenter, 0.7, 0.045]} renderOrder={1} /> : null}
    </group>
  );
}
