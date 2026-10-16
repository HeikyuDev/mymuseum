"use client";

import React, { useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getTouchControlsState } from "./useTouchControls";

interface MobileSceneControllerProps {
  enabled?: boolean;
}

export const MobileSceneController: React.FC<MobileSceneControllerProps> = ({
  enabled = true,
}) => {
  const { camera } = useThree();
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const isInitialized = useRef(false);

  useFrame((_, delta) => {
    if (!enabled) return;

    if (!isInitialized.current) {
      euler.current.setFromQuaternion(camera.quaternion);
      isInitialized.current = true;
    }

    const touchState = getTouchControlsState();

    // 1. Aplicar rotación táctil (Yaw / Pitch)
    const rotDelta = touchState.consumeRotationDelta();
    if (rotDelta.x !== 0 || rotDelta.y !== 0) {
      euler.current.y -= rotDelta.x * 0.003;
      euler.current.x -= rotDelta.y * 0.003;
      // Limitar pitch para no dar vueltas completas
      euler.current.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, euler.current.x));
      camera.quaternion.setFromEuler(euler.current);
    }

    // 2. Aplicar traslación con Joystick (-1 a 1)
    const { x: joyX, y: joyY } = touchState.moveVector;
    if (joyX !== 0 || joyY !== 0) {
      const speed = 4.0; // Metros por segundo

      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      forward.y = 0;
      forward.normalize();

      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      right.y = 0;
      right.normalize();

      const move = new THREE.Vector3();
      move.addScaledVector(forward, -joyY * speed * delta);
      move.addScaledVector(right, joyX * speed * delta);

      const nextPos = camera.position.clone().add(move);

      // Límites de la galería lineal infinita
      const minX = -12.0;
      const maxX = 300.0;
      const minZ = -3.8;
      const maxZ = 12.0;

      camera.position.x = THREE.MathUtils.clamp(nextPos.x, minX, maxX);
      camera.position.z = THREE.MathUtils.clamp(nextPos.z, minZ, maxZ);
    }

    camera.position.y = 1.7;
  });

  return null;
};
