"use client";

import { MeshReflectorMaterial } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { Color, DoubleSide } from "three";
import { ROOM_DEPTH, WALL_HEIGHT, type MuseumLayout } from "@/lib/gallery/layout";
import { FLOOR_FINISH, WALL_FINISH, isDarkColor, type ZoneLook } from "@/lib/gallery/scene-look";
import { useGallery } from "./context";
import { metricPlane } from "./geometry";
import { FloorDecoration } from "./FloorDecoration";
import { Props3d } from "./Props3d";

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

export function Zone({ zoneIndex, floorRange, wallRanges, layout, isFirst, isLast, look }: Props) {
  const { surfaces, mood, quality } = useGallery();
  const [f0, f1] = floorRange;
  const floorLength = f1 - f0;
  const floorCenter = (f0 + f1) / 2;

  const floorMaps = surfaces.floor(look.floorStyle, look.floorColor);
  const floorFinish = FLOOR_FINISH[look.floorStyle];
  const darkWall = isDarkColor(look.wallColor);

  const floorGeometry = useMemo(() => metricPlane(floorLength, ROOM_DEPTH, floorMaps.tileMeters), [floorLength, floorMaps.tileMeters]);
  const ceilingGeometry = useMemo(() => metricPlane(floorLength, ROOM_DEPTH, 2), [floorLength]);
  useEffect(() => () => floorGeometry.dispose(), [floorGeometry]);
  useEffect(() => () => ceilingGeometry.dispose(), [ceilingGeometry]);

  const trim = useMemo(() => {
    const base = new Color(darkWall ? look.wallColor : "#f4f1ea");
    if (darkWall) base.multiplyScalar(0.55);
    return `#${base.getHexString()}`;
  }, [darkWall, look.wallColor]);
  const ceilingColor = darkWall ? "#cdc6bb" : "#f5f2ec";

  const reflective = quality.reflector && floorFinish.reflective;
  const floorColor = useMemo(() => `#${new Color(mood.tint).getHexString()}`, [mood.tint]);

  return (
    <group>
      {wallRanges.map((range) => (
        <WallSegment key={range[0]} range={range} look={look} trim={trim} />
      ))}

      {/* floor */}
      <mesh geometry={floorGeometry} position={[floorCenter, 0, ROOM_DEPTH / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        {reflective ? (
          <MeshReflectorMaterial
            map={floorMaps.color}
            bumpMap={floorMaps.bump}
            bumpScale={0.35}
            roughnessMap={floorMaps.rough}
            color={floorColor}
            roughness={floorFinish.roughness}
            metalness={0}
            resolution={quality.reflectorResolution}
            blur={[220, 60]}
            mixBlur={1.6}
            mixStrength={look.floorStyle === "marble" ? 0.9 : 0.55}
            mixContrast={1.05}
            mirror={0.75}
            depthScale={0}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            envMapIntensity={0.5}
          />
        ) : (
          <meshStandardMaterial
            map={floorMaps.color}
            bumpMap={floorMaps.bump}
            bumpScale={0.35}
            roughnessMap={floorMaps.rough}
            color={floorColor}
            roughness={floorFinish.roughness}
            metalness={floorFinish.metalness}
            envMapIntensity={floorFinish.reflective ? 0.9 : 0.25}
          />
        )}
      </mesh>

      {/* ceiling */}
      <mesh geometry={ceilingGeometry} position={[floorCenter, WALL_HEIGHT, ROOM_DEPTH / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={ceilingColor} roughness={0.95} side={DoubleSide} />
      </mesh>

      {/* opposite wall (never framed in normal views, but closes the room) */}
      <mesh position={[floorCenter, WALL_HEIGHT / 2, ROOM_DEPTH]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[floorLength, WALL_HEIGHT]} />
        <meshStandardMaterial color={darkWall ? look.wallColor : "#efebe4"} roughness={0.95} />
      </mesh>
      {isFirst ? (
        <mesh position={[f0, WALL_HEIGHT / 2, ROOM_DEPTH / 2]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[ROOM_DEPTH, WALL_HEIGHT]} />
          <meshStandardMaterial color={darkWall ? look.wallColor : "#efebe4"} roughness={0.95} />
        </mesh>
      ) : null}
      {isLast ? (
        <mesh position={[f1, WALL_HEIGHT / 2, ROOM_DEPTH / 2]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[ROOM_DEPTH, WALL_HEIGHT]} />
          <meshStandardMaterial color={darkWall ? look.wallColor : "#efebe4"} roughness={0.95} />
        </mesh>
      ) : null}

      <FloorDecoration zoneIndex={zoneIndex} look={look} layout={layout} range={floorRange} />
      <Props3d zoneIndex={zoneIndex} look={look} layout={layout} />
    </group>
  );
}

function WallSegment({ range, look, trim }: { range: readonly [number, number]; look: ZoneLook; trim: string }) {
  const { surfaces, mood } = useGallery();
  const wallMaps = surfaces.wall(look.wallStyle, look.wallColor);
  const finish = WALL_FINISH[look.wallStyle];
  const wallLength = range[1] - range[0];
  const wallCenter = (range[0] + range[1]) / 2;
  const wallGeometry = useMemo(() => metricPlane(wallLength, WALL_HEIGHT, wallMaps.tileMeters), [wallLength, wallMaps.tileMeters]);
  useEffect(() => () => wallGeometry.dispose(), [wallGeometry]);
  return (
    <group>
      <mesh geometry={wallGeometry} position={[wallCenter, WALL_HEIGHT / 2, 0]} receiveShadow>
      {look.wallStyle === "velvet" || look.wallStyle === "linen" ? (
        <meshPhysicalMaterial
          map={wallMaps.color}
          bumpMap={wallMaps.bump}
          bumpScale={finish.bump}
          roughnessMap={wallMaps.rough}
          roughness={finish.roughness}
          color={mood.tint}
          sheen={finish.sheen}
          sheenRoughness={0.6}
          sheenColor={look.wallStyle === "velvet" ? "#b04a66" : "#fff6e4"}
          envMapIntensity={0.2}
        />
      ) : (
        <meshStandardMaterial
          map={wallMaps.color}
          bumpMap={wallMaps.bump}
          bumpScale={finish.bump}
          roughnessMap={wallMaps.rough}
          roughness={finish.roughness}
          color={mood.tint}
          envMapIntensity={look.wallStyle === "marble" ? 0.9 : 0.25}
        />
      )}
    </mesh>

    {/* baseboard and crown moulding */}
    <mesh position={[wallCenter, 0.08, 0.02]} castShadow receiveShadow>
      <boxGeometry args={[wallLength, 0.16, 0.04]} />
      <meshStandardMaterial color={trim} roughness={0.55} />
    </mesh>
    <mesh position={[wallCenter, 0.17, 0.012]} receiveShadow>
      <boxGeometry args={[wallLength, 0.02, 0.026]} />
      <meshStandardMaterial color={trim} roughness={0.55} />
    </mesh>
    <mesh position={[wallCenter, WALL_HEIGHT - 0.06, 0.05]} receiveShadow>
      <boxGeometry args={[wallLength, 0.12, 0.1]} />
      <meshStandardMaterial color={trim} roughness={0.6} />
    </mesh>
    <mesh position={[wallCenter, WALL_HEIGHT - 0.17, 0.025]} receiveShadow>
      <boxGeometry args={[wallLength, 0.1, 0.05]} />
      <meshStandardMaterial color={trim} roughness={0.6} />
    </mesh>
    </group>
  );
}
