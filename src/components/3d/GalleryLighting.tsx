"use client";

import React from "react";
import { LightingPreset } from "@/types/museum";

interface GalleryLightingProps {
  preset?: LightingPreset;
  ambientIntensity?: number;
  spotlightIntensity?: number;
}

export const GalleryLighting: React.FC<GalleryLightingProps> = ({
  preset = "WARM_GALLERY",
  ambientIntensity = 0.5,
  spotlightIntensity = 1.2,
}) => {
  switch (preset) {
    case "COLD_CONTEMPORARY":
      return (
        <group name="GalleryLighting_Cold">
          <ambientLight color="#F0F4F8" intensity={ambientIntensity * 0.9} />
          <hemisphereLight
            color="#FFFFFF"
            groundColor="#4A5568"
            intensity={ambientIntensity * 0.7}
          />
          {/* Focos generales hacia paredes */}
          <directionalLight
            position={[0, 4.0, -3]}
            target-position={[0, 1.7, -8]}
            intensity={spotlightIntensity * 1.0}
            color="#FFFFFF"
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <directionalLight
            position={[5, 4.0, 0]}
            target-position={[12, 1.7, 0]}
            intensity={spotlightIntensity * 0.9}
            color="#F8FAFC"
          />
          <directionalLight
            position={[-5, 4.0, 0]}
            target-position={[-12, 1.7, 0]}
            intensity={spotlightIntensity * 0.9}
            color="#F8FAFC"
          />
        </group>
      );

    case "NEON_NOIR":
      return (
        <group name="GalleryLighting_Neon">
          <ambientLight color="#1A0B2E" intensity={ambientIntensity * 0.45} />
          <hemisphereLight
            color="#3B1C5A"
            groundColor="#0D0614"
            intensity={ambientIntensity * 0.4}
          />
          {/* Acentos de luz neón Cyan y Magenta */}
          <pointLight
            position={[-6, 3.8, -5]}
            color="#00F0FF"
            intensity={spotlightIntensity * 2.2}
            distance={16}
          />
          <pointLight
            position={[6, 3.8, -5]}
            color="#FF007F"
            intensity={spotlightIntensity * 2.2}
            distance={16}
          />
          <pointLight
            position={[0, 3.8, 3]}
            color="#9D00FF"
            intensity={spotlightIntensity * 1.8}
            distance={14}
          />
          <directionalLight
            position={[0, 4.0, -2]}
            target-position={[0, 1.7, -8]}
            intensity={spotlightIntensity * 0.7}
            color="#E0F7FA"
          />
        </group>
      );

    case "DRAMATIC_SPOTLIGHT":
      return (
        <group name="GalleryLighting_Dramatic">
          <ambientLight color="#0D0D0D" intensity={ambientIntensity * 0.3} />
          <hemisphereLight
            color="#1F1F1F"
            groundColor="#000000"
            intensity={ambientIntensity * 0.25}
          />
          {/* Focos intensos y dirigidos con haz cerrado */}
          <spotLight
            position={[-5, 4.1, -4]}
            target-position={[-5, 1.7, -8]}
            angle={0.4}
            penumbra={0.5}
            intensity={spotlightIntensity * 3.5}
            color="#FFE6C2"
            castShadow
          />
          <spotLight
            position={[0, 4.1, -4]}
            target-position={[0, 1.7, -8]}
            angle={0.35}
            penumbra={0.5}
            intensity={spotlightIntensity * 3.5}
            color="#FFE6C2"
            castShadow
          />
          <spotLight
            position={[5, 4.1, -4]}
            target-position={[5, 1.7, -8]}
            angle={0.4}
            penumbra={0.5}
            intensity={spotlightIntensity * 3.5}
            color="#FFE6C2"
            castShadow
          />
        </group>
      );

    case "WARM_GALLERY":
    default:
      return (
        <group name="GalleryLighting_Warm">
          <ambientLight color="#FFF5E6" intensity={ambientIntensity * 1.0} />
          <hemisphereLight
            color="#FFEEDB"
            groundColor="#8B7355"
            intensity={ambientIntensity * 0.6}
          />
          {/* Foco principal hacia pared norte */}
          <directionalLight
            position={[0, 4.1, -2]}
            target-position={[0, 1.7, -8]}
            intensity={spotlightIntensity * 1.2}
            color="#FFF2DE"
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.0001}
          />
          {/* Focos laterales cálidos */}
          <directionalLight
            position={[6, 4.1, 0]}
            target-position={[12, 1.7, 0]}
            intensity={spotlightIntensity * 1.0}
            color="#FFF4E0"
          />
          <directionalLight
            position={[-6, 4.1, 0]}
            target-position={[-12, 1.7, 0]}
            intensity={spotlightIntensity * 1.0}
            color="#FFF4E0"
          />
          {/* Foco de acento en pared sur */}
          <directionalLight
            position={[0, 4.1, 2]}
            target-position={[0, 1.7, 8]}
            intensity={spotlightIntensity * 0.8}
            color="#FFECC7"
          />
        </group>
      );
  }
};
