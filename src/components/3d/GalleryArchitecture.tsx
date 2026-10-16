"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import {
  createParquetTexture,
  createPlasterBumpMap,
} from "./materials/proceduralTextures";

interface GalleryArchitectureProps {
  wallColor?: string;
  ceilingColor?: string;
  artworkCount?: number;
}

export const GalleryArchitecture: React.FC<GalleryArchitectureProps> = ({
  wallColor = "#ECE8E1",
  ceilingColor = "#F9F8F5",
  artworkCount = 6,
}) => {
  const floorTexture = useMemo(() => createParquetTexture(), []);
  const plasterBump = useMemo(() => createPlasterBumpMap(), []);

  // Longitud dinámica de la pared según la cantidad de obras (mínimo 120m para sensación infinita)
  const galleryLength = Math.max(120, (artworkCount + 2) * 12);

  // Material de la pared principal
  const wallMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: wallColor,
        roughness: 0.85,
        metalness: 0.02,
        bumpMap: plasterBump,
        bumpScale: 0.015,
      }),
    [wallColor, plasterBump]
  );

  // Material de zócalos
  const baseboardMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#221E1B",
        roughness: 0.4,
        metalness: 0.2,
      }),
    []
  );

  return (
    <group name="InfiniteGalleryArchitecture">
      {/* 1. Suelo expansivo infinito */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[galleryLength / 3, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[galleryLength * 2, 80]} />
        <meshStandardMaterial
          map={floorTexture}
          roughness={0.28}
          metalness={0.06}
        />
      </mesh>

      {/* 2. Techo arquitectónico de gran altura (5.2m) con rieles de luz */}
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[galleryLength / 3, 5.2, 0]}
      >
        <planeGeometry args={[galleryLength * 2, 80]} />
        <meshStandardMaterial
          color={ceilingColor}
          roughness={0.92}
          metalness={0.0}
        />
      </mesh>

      {/* Riel continuo de iluminación cenital a lo largo de toda la galería */}
      <mesh position={[galleryLength / 3, 5.18, -2.5]}>
        <boxGeometry args={[galleryLength * 2, 0.06, 0.16]} />
        <meshStandardMaterial color="#1A1A1A" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* 3. Gran Pared Continua de Exposición (Z = -5.0) */}
      <mesh
        position={[galleryLength / 3, 2.6, -5.0]}
        material={wallMaterial}
        receiveShadow
      >
        <boxGeometry args={[galleryLength * 2, 5.2, 0.3]} />
      </mesh>

      {/* Zócalo arquitectónico continuo en la base de la pared */}
      <mesh position={[galleryLength / 3, 0.09, -4.83]} material={baseboardMaterial}>
        <boxGeometry args={[galleryLength * 2, 0.18, 0.05]} />
      </mesh>

      {/* 4. Pared trasera lejana (Z = 15.0) para mantener la sala abierta y monumental */}
      <mesh
        position={[galleryLength / 3, 2.6, 15.0]}
        material={wallMaterial}
        receiveShadow
      >
        <boxGeometry args={[galleryLength * 2, 5.2, 0.3]} />
      </mesh>
      <mesh position={[galleryLength / 3, 0.09, 14.83]} material={baseboardMaterial}>
        <boxGeometry args={[galleryLength * 2, 0.18, 0.05]} />
      </mesh>
    </group>
  );
};
