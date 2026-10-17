"use client";

import { useEffect, useMemo } from "react";
import { BoxGeometry, PlaneGeometry } from "three";
import { ENTRANCE_LETTERING_WIDTH, WALL_HEIGHT } from "@/lib/gallery/layout";
import { isDarkColor, microcementColor } from "@/lib/gallery/scene-look";
import { zoneTitle, useGallery } from "./context";
import { makeWallLetteringTexture } from "./text-textures";

/** Ceiling line of the cove: the LED strip sits in a shallow recess just under the crown. */
const COVE_Y = WALL_HEIGHT - 0.13;
const LETTERING_ASPECT = 2.6 / 1.1;

/** The tone of the microcement of the entrance and end walls for a hall look. */
export function useMicrocement(wallColor: string): { color: string; dark: boolean } {
  return useMemo(() => {
    const color = microcementColor(wallColor);
    return { color, dark: isDarkColor(color) };
  }, [wallColor]);
}

/**
 * A slim recessed LED strip along the ceiling line with a soft wash falling down the wall. Two merged
 * pieces and one additive quad per wall, shared materials: it costs the same on every quality tier.
 */
export function LedCove({ length, x, z = 0, rotationY = 0 }: { length: number; x: number; z?: number; rotationY?: number }) {
  const { resources, baked } = useGallery();
  const key = length.toFixed(3);
  const recess = resources.geometry(`cove-recess:${key}`, () => new BoxGeometry(length, 0.07, 0.02).translate(0, COVE_Y, 0.01));
  const strip = resources.geometry(`cove-strip:${key}`, () => new BoxGeometry(length - 0.12, 0.018, 0.012).translate(0, COVE_Y, 0.02));
  const wash = resources.geometry(`cove-wash:${key}`, () => new PlaneGeometry(length, 1.15).translate(0, COVE_Y - 0.57, 0.012));
  const recessMaterial = resources.basic("cove-recess", { color: "#1c1a18" });
  const stripMaterial = resources.basic("cove-strip", { color: "#fff3d8" });
  const washMaterial = resources.basic("cove-wash", { color: "#fff0d2", map: baked.ledWash, opacity: 0.34, additive: true });
  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      <mesh geometry={recess} material={recessMaterial} />
      <mesh geometry={strip} material={stripMaterial} />
      <mesh geometry={wash} material={washMaterial} renderOrder={1} />
    </group>
  );
}

/**
 * The feature wall the visit starts in front of: the museum name in large, minimal lettering (and the
 * first hall's name under a hairline), a recessed LED strip along the ceiling line and a thin reveal where
 * the microcement meets the first hall's wall. The wall itself is a regular wall segment (see Zone).
 */
export function EntranceWall() {
  const { layout, museumTitle, fonts, looks, zones, otherLabel } = useGallery();
  const { entrance } = layout;
  const length = entrance.end - entrance.start;
  const { color, dark } = useMicrocement(looks[0].wallColor);
  const hallName = zones[0] ? zoneTitle(zones[0], otherLabel) : "";

  const texture = useMemo(
    () =>
      makeWallLetteringTexture({
        title: museumTitle,
        subtitle: hallName,
        aspect: LETTERING_ASPECT,
        family: fonts.body,
        color: dark ? "#efe7d8" : "#2b2825",
        light: dark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.85)",
        dark: dark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.22)",
        pixelHeight: 256,
      }),
    [museumTitle, hallName, fonts.body, dark],
  );
  useEffect(() => () => texture.dispose(), [texture]);

  const { resources } = useGallery();
  const reveal = resources.geometry("entrance-reveal", () => new BoxGeometry(0.028, WALL_HEIGHT - 0.2, 0.018).translate(0, (WALL_HEIGHT - 0.2) / 2 + 0.1, 0.009));
  const revealMaterial = resources.surface(`entrance-reveal:${color}`, { color: dark ? "#0f0e0d" : "#8a857c", roughness: 0.8 });

  return (
    <group userData={{ cull: [entrance.start, entrance.end] }}>
      <mesh position={[entrance.centerX, 2.12, 0.012]}>
        <planeGeometry args={[ENTRANCE_LETTERING_WIDTH, ENTRANCE_LETTERING_WIDTH / LETTERING_ASPECT]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <LedCove length={length} x={(entrance.start + entrance.end) / 2} />
      <mesh geometry={reveal} material={revealMaterial} position={[entrance.end, 0, 0]} />
    </group>
  );
}
