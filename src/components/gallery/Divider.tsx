"use client";

import { useEffect, useMemo } from "react";
import { BoxGeometry, Color } from "three";
import { DIVIDER_LETTERING_WIDTH, DIVIDER_WIDTH, WALL_HEIGHT } from "@/lib/gallery/layout";
import { isDarkColor, microcementColor, type ZoneLook } from "@/lib/gallery/scene-look";
import { zoneTitle, useGallery } from "./context";
import { LETTERING_ASPECT, LedCove } from "./EntranceWall";
import { makeWallLettering } from "./lettering";
import { WallSegment } from "./Zone";

/**
 * The wall between two categories: the same language as the entrance wall (fine microcement, a recessed LED strip
 * along the ceiling line, a slim baseboard, the category name in large minimal lettering) on the same wall plane as
 * the artworks. It is a pause in the rhythm of the wall, not an opening: the floor, the ceiling and any carpet run
 * straight through it.
 */
export function Divider({ index, x }: { index: number; x: number }) {
  const { looks, zones, fonts, museumTitle, otherLabel, resources } = useGallery();
  const look = looks[index];
  const before = looks[index - 1] ?? look;

  // A neutral tone shared by the two neighbouring halls' palettes.
  const color = useMemo(() => `#${new Color(microcementColor(before.wallColor)).lerp(new Color(microcementColor(look.wallColor)), 0.5).getHexString()}`, [before.wallColor, look.wallColor]);
  const dark = isDarkColor(color);
  const dividerLook = useMemo<ZoneLook>(() => ({ ...look, wallStyle: "plaster", wallColor: color }), [look, color]);
  const spotColor = useMemo(() => new Color(look.lighting.spot), [look.lighting.spot]);
  const trim = dark ? "#2a2724" : "#ddd8ce";

  const texture = useMemo(
    () => makeWallLettering({ title: zoneTitle(zones[index], otherLabel), subtitle: museumTitle, family: fonts.body, dark, aspect: LETTERING_ASPECT }),
    [zones, index, otherLabel, museumTitle, fonts.body, dark],
  );
  useEffect(() => () => texture.dispose(), [texture]);

  const reveal = resources.geometry("divider-reveal", () => new BoxGeometry(0.028, WALL_HEIGHT - 0.2, 0.018).translate(0, (WALL_HEIGHT - 0.2) / 2 + 0.1, 0.009));
  const revealMaterial = resources.surface(`divider-reveal:${dark ? "d" : "l"}`, { color: dark ? "#0f0e0d" : "#8a857c", roughness: 0.8 });
  const half = DIVIDER_WIDTH / 2;

  return (
    <group userData={{ cull: [x - half, x + half] }}>
      <WallSegment range={[x - half, x + half]} look={dividerLook} trim={trim} modern zoneIndex={index} spots={[]} spotColor={spotColor} />
      <mesh position={[x, 2.12, 0.012]}>
        <planeGeometry args={[DIVIDER_LETTERING_WIDTH, DIVIDER_LETTERING_WIDTH / LETTERING_ASPECT]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <LedCove length={DIVIDER_WIDTH} x={x} />
      <mesh geometry={reveal} material={revealMaterial} position={[x - half, 0, 0]} />
      <mesh geometry={reveal} material={revealMaterial} position={[x + half, 0, 0]} />
    </group>
  );
}
