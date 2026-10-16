"use client";

import React, { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";

interface DesktopControlsProps {
  enabled?: boolean;
}

export const DesktopControls: React.FC<DesktopControlsProps> = ({
  enabled = true,
}) => {
  const { camera } = useThree();

  // Estados de teclas
  const keys = useRef<{
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    sprint: boolean;
  }>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  });

  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          keys.current.forward = true;
          break;
        case "KeyS":
        case "ArrowDown":
          keys.current.backward = true;
          break;
        case "KeyA":
        case "ArrowLeft":
          keys.current.left = true;
          break;
        case "KeyD":
        case "ArrowRight":
          keys.current.right = true;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          keys.current.sprint = true;
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          keys.current.forward = false;
          break;
        case "KeyS":
        case "ArrowDown":
          keys.current.backward = false;
          break;
        case "KeyA":
        case "ArrowLeft":
          keys.current.left = false;
          break;
        case "KeyD":
        case "ArrowRight":
          keys.current.right = false;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          keys.current.sprint = false;
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    if (!enabled) return;

    // Amortiguación inercial (fricción)
    velocity.current.x -= velocity.current.x * 10.0 * delta;
    velocity.current.z -= velocity.current.z * 10.0 * delta;

    // Velocidad base o acelerada
    const moveSpeed = keys.current.sprint ? 50.0 : 32.0;

    direction.current.z =
      Number(keys.current.forward) - Number(keys.current.backward);
    direction.current.x =
      Number(keys.current.right) - Number(keys.current.left);
    direction.current.normalize();

    if (keys.current.forward || keys.current.backward) {
      velocity.current.z -= direction.current.z * moveSpeed * delta;
    }
    if (keys.current.left || keys.current.right) {
      velocity.current.x -= direction.current.x * moveSpeed * delta;
    }

    // Traslación en el plano local de la cámara (ignora pitch en Y)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    right.normalize();

    const moveVector = new THREE.Vector3();
    moveVector.addScaledVector(forward, -velocity.current.z * delta);
    moveVector.addScaledVector(right, -velocity.current.x * delta);

    const nextPosition = camera.position.clone().add(moveVector);

    // Límites de la galería lineal infinita
    const minX = -12.0;
    const maxX = 300.0;
    const minZ = -3.8; // Pared continua en Z = -5.0
    const maxZ = 12.0; // Amplitud abierta hacia atrás

    camera.position.x = THREE.MathUtils.clamp(nextPosition.x, minX, maxX);
    camera.position.z = THREE.MathUtils.clamp(nextPosition.z, minZ, maxZ);

    // Altura fija de los ojos del visitante
    camera.position.y = 1.7;
  });

  return <PointerLockControls />;
};
