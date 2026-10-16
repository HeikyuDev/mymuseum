"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ArtworkData, FrameStyle } from "@/types/museum";

interface ArtworkFrameProps {
  artwork: ArtworkData;
  defaultFrameStyle?: FrameStyle;
  defaultFrameColor?: string;
  isFocused?: boolean;
  onSelect?: (artwork: ArtworkData) => void;
}

export const ArtworkFrame: React.FC<ArtworkFrameProps> = ({
  artwork,
  defaultFrameStyle = "MINIMALIST",
  defaultFrameColor = "#1A1A1A",
  isFocused = false,
  onSelect,
}) => {
  const { camera } = useThree();
  const [hovered, setHovered] = useState(false);
  const [isNear, setIsNear] = useState(true);
  const meshRef = useRef<THREE.Group>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  const style = (artwork.frameStyle || defaultFrameStyle) as FrameStyle;
  const frameColor = artwork.frameColor || defaultFrameColor;
  const { widthMeters: width, heightMeters: height } = artwork;

  // Optimización de distancia (LOD / Frustum culling):
  // Comprobamos distancia a la cámara para activar focos y recursos pesados solo cuando es necesario
  useFrame(() => {
    if (meshRef.current) {
      const dist = camera.position.distanceTo(meshRef.current.position);
      const shouldBeNear = dist < 35.0;
      if (shouldBeNear !== isNear) {
        setIsNear(shouldBeNear);
      }
    }
  });

  // Carga asíncrona segura con fallback procedimental inmediato
  useEffect(() => {
    let isMounted = true;

    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 512, 512);
        grad.addColorStop(0, "#2A2725");
        grad.addColorStop(1, "#151413");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);

        ctx.strokeStyle = "rgba(212, 175, 55, 0.4)";
        ctx.lineWidth = 3;
        ctx.strokeRect(20, 20, 472, 472);

        ctx.fillStyle = "#EAEAEA";
        ctx.font = "bold 24px Georgia, serif";
        ctx.textAlign = "center";
        ctx.fillText(artwork.title.slice(0, 26), 256, 240);
        ctx.font = "italic 16px sans-serif";
        ctx.fillStyle = "#A8A8A8";
        ctx.fillText(artwork.artistName.slice(0, 30), 256, 280);
      }
      const placeholder = new THREE.CanvasTexture(canvas);
      placeholder.colorSpace = THREE.SRGBColorSpace;
      setTexture(placeholder);
    }

    if (artwork.imageUrl) {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin("anonymous");
      loader.load(
        artwork.imageUrl,
        (loadedTex) => {
          if (!isMounted) return;
          loadedTex.colorSpace = THREE.SRGBColorSpace;
          loadedTex.generateMipmaps = true;
          loadedTex.minFilter = THREE.LinearMipmapLinearFilter;
          setTexture(loadedTex);
        },
        undefined,
        (err) => {
          console.warn(`Fallback para "${artwork.title}" activo.`);
        }
      );
    }

    return () => {
      isMounted = false;
    };
  }, [artwork.imageUrl, artwork.title, artwork.artistName]);

  const frameProps = useMemo(() => {
    switch (style) {
      case "WOOD":
        return {
          borderWidth: 0.08,
          depth: 0.06,
          metalness: 0.05,
          roughness: 0.65,
          color: frameColor || "#3B2219",
        };
      case "GOLD":
        return {
          borderWidth: 0.09,
          depth: 0.07,
          metalness: 0.85,
          roughness: 0.32,
          color: frameColor || "#D4AF37",
        };
      case "METALLIC":
        return {
          borderWidth: 0.04,
          depth: 0.05,
          metalness: 0.95,
          roughness: 0.18,
          color: frameColor || "#C0C0C0",
        };
      case "CANVAS_WRAP":
        return {
          borderWidth: 0.0,
          depth: 0.04,
          metalness: 0.0,
          roughness: 0.9,
          color: "#FFFFFF",
        };
      case "MINIMALIST":
      default:
        return {
          borderWidth: 0.03,
          depth: 0.04,
          metalness: 0.3,
          roughness: 0.4,
          color: frameColor || "#1A1A1A",
        };
    }
  }, [style, frameColor]);

  const frameMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: frameProps.color,
      metalness: frameProps.metalness,
      roughness: frameProps.roughness,
      emissive: hovered || isFocused ? "#FFEAA7" : "#000000",
      emissiveIntensity: hovered || isFocused ? 0.3 : 0.0,
    });
  }, [frameProps, hovered, isFocused]);

  const bw = frameProps.borderWidth;
  const depth = frameProps.depth;

  return (
    <group
      ref={meshRef}
      position={[artwork.positionX, artwork.positionY, artwork.positionZ]}
      rotation={[0, artwork.rotationY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        // Liberar cursor al hacer clic para que el usuario no pierda el mouse
        if (typeof document !== "undefined" && document.pointerLockElement) {
          document.exitPointerLock();
        }
        onSelect?.(artwork);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        if (typeof document !== "undefined") document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        if (typeof document !== "undefined") document.body.style.cursor = "auto";
      }}
    >
      {/* 1. Lienzo principal de la obra */}
      <mesh position={[0, 0, depth / 2 + 0.002]} castShadow={isNear} receiveShadow>
        <planeGeometry args={[width, height]} />
        {texture ? (
          <meshStandardMaterial
            map={texture}
            roughness={0.6}
            metalness={0.05}
          />
        ) : (
          <meshStandardMaterial color="#262423" roughness={0.8} />
        )}
      </mesh>

      {/* 2. Marco 3D */}
      {style !== "CANVAS_WRAP" && (
        <group position={[0, 0, depth / 2]}>
          <mesh position={[0, height / 2 + bw / 2, 0]} material={frameMaterial} castShadow={isNear}>
            <boxGeometry args={[width + bw * 2, bw, depth]} />
          </mesh>
          <mesh position={[0, -height / 2 - bw / 2, 0]} material={frameMaterial} castShadow={isNear}>
            <boxGeometry args={[width + bw * 2, bw, depth]} />
          </mesh>
          <mesh position={[-width / 2 - bw / 2, 0, 0]} material={frameMaterial} castShadow={isNear}>
            <boxGeometry args={[bw, height, depth]} />
          </mesh>
          <mesh position={[width / 2 + bw / 2, 0, 0]} material={frameMaterial} castShadow={isNear}>
            <boxGeometry args={[bw, height, depth]} />
          </mesh>
        </group>
      )}

      {style === "CANVAS_WRAP" && (
        <mesh position={[0, 0, depth / 2]} castShadow={isNear}>
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial color="#FAF9F6" roughness={0.8} />
        </mesh>
      )}

      {/* 3. Cartela informativa en la pared */}
      <group position={[0, -height / 2 - bw - 0.14, 0.02]}>
        <mesh receiveShadow>
          <boxGeometry args={[0.34, 0.1, 0.01]} />
          <meshStandardMaterial color="#22201D" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.035, 0.006]}>
          <boxGeometry args={[0.28, 0.004, 0.002]} />
          <meshStandardMaterial color="#D4AF37" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* 4. Foco cenital (solo activo cuando el visitante está cerca para no sobrecargar el renderizador) */}
      {isNear && (
        <spotLight
          position={[0, 2.2, 2.0]}
          target={meshRef.current || undefined}
          intensity={1.3}
          angle={0.5}
          penumbra={0.7}
          color="#FFF6E5"
          distance={8}
          castShadow
        />
      )}
    </group>
  );
};
