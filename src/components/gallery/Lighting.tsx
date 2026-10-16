/* eslint-disable react-hooks/immutability -- three.js objects (camera, lights, renderer) are mutated imperatively inside the render loop by design */
"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, Fog, Object3D, PCFSoftShadowMap, PMREMGenerator, SpotLight, type DirectionalLight, type HemisphereLight } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EYE_CENTER, ROOM_DEPTH, WALL_HEIGHT, zoneBlendAt } from "@/lib/gallery/layout";
import { useGallery } from "./context";

type Slot = { art: number; level: number; target: number };

const SPOT_Z = 2.5;

/** Hemisphere + fill + pooled spotlights + a procedural reflection environment. */
export function Lighting() {
  const { layout, looks, mood, quality, cameraX, snapshot } = useGallery();
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);

  const hemi = useRef<HemisphereLight>(null);
  const fill = useRef<DirectionalLight>(null);

  const colors = useMemo(
    () => ({ a: new Color(), b: new Color(), c: new Color() }),
    [],
  );

  const pool = useMemo(
    () =>
      Array.from({ length: quality.spotCount }, (_, i) => {
        const light = new SpotLight("#ffffff", 0, 22, 0.6, 0.9, 2);
        light.castShadow = quality.shadows && i < quality.shadowLights;
        if (light.castShadow) {
          light.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
          light.shadow.bias = -0.00035;
          light.shadow.normalBias = 0.012;
          light.shadow.radius = 5;
          light.shadow.camera.near = 0.5;
          light.shadow.camera.far = 14;
        }
        const target = new Object3D();
        light.target = target;
        return { light, target, slot: { art: -1, level: 0, target: 0 } as Slot };
      }),
    [quality.spotCount, quality.shadows, quality.shadowLights, quality.shadowMapSize],
  );

  useEffect(() => {
    gl.shadowMap.enabled = quality.shadows;
    gl.shadowMap.type = PCFSoftShadowMap;
    scene.fog = new Fog(mood.background, 22, 70);
    return () => {
      scene.fog = null;
    };
  }, [gl, scene, quality.shadows, mood.background]);

  useEffect(
    () => () => {
      pool.forEach(({ light }) => light.dispose());
    },
    [pool],
  );

  // Procedural reflection environment (a softly lit neutral room): metal frames and polished floors
  // need something to reflect, and generating it needs no network request.
  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = 0.55;
    generator.dispose();
    room.dispose();
    invalidate();
    return () => {
      scene.environment = null;
      try {
        target.dispose();
      } catch {
        // The renderer may already be disposed when a one-shot photo scene unmounts.
      }
    };
  }, [gl, scene, invalidate]);

  useFrame((_, delta) => {
    const blend = zoneBlendAt(layout, cameraX.current);
    const from = looks[blend.from]?.lighting;
    const to = looks[blend.to]?.lighting;
    if (!from || !to) return;
    const t = blend.amount;
    const lerp = (a: number, b: number) => a + (b - a) * t;

    if (hemi.current) {
      colors.a.set(from.hemiSky).lerp(colors.b.set(to.hemiSky), t);
      hemi.current.color.copy(colors.a);
      colors.a.set(from.hemiGround).lerp(colors.b.set(to.hemiGround), t);
      hemi.current.groundColor.copy(colors.a);
      hemi.current.intensity = lerp(from.hemiIntensity, to.hemiIntensity) * mood.ambientScale;
    }
    if (fill.current) {
      colors.a.set(from.fill).lerp(colors.b.set(to.fill), t);
      fill.current.color.copy(colors.a);
      fill.current.intensity = lerp(from.fillIntensity, to.fillIntensity) * mood.ambientScale;
      fill.current.position.set(cameraX.current + 1.5, 3.6, ROOM_DEPTH - 1);
      fill.current.target.position.set(cameraX.current, 1.2, 0);
      fill.current.target.updateMatrixWorld();
    }
    if (scene.fog) {
      colors.a.set(from.fog).lerp(colors.b.set(to.fog), t);
      (scene.fog as Fog).color.copy(colors.a);
    }
    gl.toneMappingExposure = lerp(from.exposure, to.exposure);

    // ---- spotlight pool: the lights follow the artworks nearest the camera ----
    const cx = cameraX.current;
    const wanted = layout.artworks
      .map((a) => ({ index: a.index, distance: Math.abs(a.x - cx) }))
      .sort((p, q) => p.distance - q.distance)
      .slice(0, pool.length)
      .map((entry) => entry.index);
    const wantedSet = new Set(wanted);
    let animating = false;

    for (const { slot } of pool) {
      slot.target = slot.art >= 0 && wantedSet.has(slot.art) ? 1 : 0;
      if (slot.target === 0 && slot.level < 0.02) slot.art = -1;
    }
    const assigned = new Set(pool.map(({ slot }) => slot.art));
    for (const index of wanted) {
      if (assigned.has(index)) continue;
      const free = pool.find(({ slot }) => slot.art === -1);
      if (!free) break;
      free.slot.art = index;
      free.slot.target = 1;
      if (snapshot) free.slot.level = 1;
      assigned.add(index);
    }

    const rate = Math.min(1, delta * 5);
    for (const { light, target, slot } of pool) {
      slot.level = snapshot ? slot.target : slot.level + (slot.target - slot.level) * rate;
      if (Math.abs(slot.target - slot.level) > 0.01) animating = true;
      const art = slot.art >= 0 ? layout.artworks[slot.art] : null;
      if (!art) {
        light.intensity = 0;
        continue;
      }
      const look = looks[art.zoneIndex]?.lighting ?? from;
      light.position.set(art.x, WALL_HEIGHT - 0.3, SPOT_Z);
      target.position.set(art.x, EYE_CENTER - 0.2, 0);
      target.updateMatrixWorld();
      light.color.set(look.spot);
      light.angle = look.spotAngle;
      light.penumbra = look.spotPenumbra;
      light.intensity = look.spotIntensity * slot.level * (0.6 + 0.4 * mood.ambientScale);
    }
    if (animating) invalidate();
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#ffffff", "#e6dfd3", 1.2]} />
      <directionalLight ref={fill} args={["#fff8ee", 0.9]} />
      {pool.map(({ light, target }, i) => (
        <group key={i}>
          <primitive object={light} />
          <primitive object={target} />
        </group>
      ))}
    </>
  );
}
