"use client";

import React, { useRef, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ArtworkData } from "@/types/museum";

interface CameraFocusControllerProps {
  focusedArtwork: ArtworkData | null;
  onFocusReached?: () => void;
}

export const CameraFocusController: React.FC<CameraFocusControllerProps> = ({
  focusedArtwork,
  onFocusReached,
}) => {
  const { camera } = useThree();

  const targetPosition = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());
  const isTransitioning = useRef(false);
  const dummy = useRef(new THREE.Object3D());

  useEffect(() => {
    if (focusedArtwork) {
      // Posicionar la cámara a 2.8m de distancia frente al cuadro
      targetPosition.current.set(
        focusedArtwork.positionX,
        1.7,
        focusedArtwork.positionZ + 2.8
      );

      // Mirar exactamente al centro de la obra
      targetLookAt.current.set(
        focusedArtwork.positionX,
        1.7,
        focusedArtwork.positionZ
      );

      isTransitioning.current = true;
    } else {
      isTransitioning.current = false;
    }
  }, [focusedArtwork]);

  useFrame((_, delta) => {
    if (!focusedArtwork || !isTransitioning.current) return;

    // 1. Interpolación suave de posición
    camera.position.lerp(targetPosition.current, Math.min(1.0, delta * 5.0));

    // 2. Orientación frontal usando Object3D.lookAt en espacio de mundo
    dummy.current.position.copy(camera.position);
    dummy.current.lookAt(targetLookAt.current);
    camera.quaternion.slerp(dummy.current.quaternion, Math.min(1.0, delta * 6.0));

    // Finalizar transición si ya estamos en posición
    if (camera.position.distanceTo(targetPosition.current) < 0.08) {
      isTransitioning.current = false;
      onFocusReached?.();
    }
  });

  return null;
};
