"use client";

import { MeshReflectorMaterial } from "@react-three/drei";
import type { Texture } from "three";

type Props = {
  map: Texture;
  bumpMap: Texture;
  roughnessMap: Texture;
  color: string;
  roughness: number;
  resolution: number;
  mixStrength: number;
};

/** Polished floor with a real planar reflection. Loaded lazily: only the high tier needs it. */
export default function ReflectorFloor({ map, bumpMap, roughnessMap, color, roughness, resolution, mixStrength }: Props) {
  return (
    <MeshReflectorMaterial
      map={map}
      bumpMap={bumpMap}
      bumpScale={0.35}
      roughnessMap={roughnessMap}
      color={color}
      roughness={roughness}
      metalness={0}
      resolution={resolution}
      blur={[220, 60]}
      mixBlur={1.6}
      mixStrength={mixStrength}
      mixContrast={1.05}
      mirror={0.75}
      depthScale={0}
      minDepthThreshold={0.4}
      maxDepthThreshold={1.4}
      envMapIntensity={0.5}
    />
  );
}
