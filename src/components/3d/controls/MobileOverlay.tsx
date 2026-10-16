"use client";

import React, { useRef, useState, useEffect } from "react";
import { getTouchControlsState } from "./useTouchControls";

export const MobileOverlay: React.FC = () => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });

  const joystickOrigin = useRef({ x: 0, y: 0 });
  const touchState = getTouchControlsState();

  const lastDragPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // Detectar si el dispositivo tiene capacidades táctiles
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(hasTouch);
  }, []);

  if (!isTouchDevice) return null;

  // Manejo de Joystick (Mitad izquierda de pantalla)
  const handleJoystickStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    joystickOrigin.current = { x: touch.clientX, y: touch.clientY };
    setJoystickActive(true);
    setJoystickPos({ x: 0, y: 0 });
  };

  const handleJoystickMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!joystickActive) return;
    const touch = e.touches[0];
    const dx = touch.clientX - joystickOrigin.current.x;
    const dy = touch.clientY - joystickOrigin.current.y;

    const maxDist = 48; // Radio máximo en px
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, maxDist);
    const angle = Math.atan2(dy, dx);

    const clampedX = Math.cos(angle) * clampedDist;
    const clampedY = Math.sin(angle) * clampedDist;

    setJoystickPos({ x: clampedX, y: clampedY });
    // Vector normalizado (-1 a 1)
    touchState.setMoveVector({
      x: clampedX / maxDist,
      y: clampedY / maxDist,
    });
  };

  const handleJoystickEnd = () => {
    setJoystickActive(false);
    setJoystickPos({ x: 0, y: 0 });
    touchState.setMoveVector({ x: 0, y: 0 });
  };

  // Manejo de Cámara (Mitad derecha de pantalla)
  const handleLookStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    lastDragPos.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!lastDragPos.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - lastDragPos.current.x;
    const dy = touch.clientY - lastDragPos.current.y;

    touchState.setRotationDelta({ x: dx, y: dy });
    lastDragPos.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookEnd = () => {
    lastDragPos.current = null;
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-30 flex select-none touch-none">
      {/* Zona Izquierda: Joystick Virtual */}
      <div
        className="w-1/2 h-full pointer-events-auto relative flex items-end p-8"
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
        onTouchCancel={handleJoystickEnd}
      >
        <div className="w-32 h-32 rounded-full border-2 border-white/30 bg-black/25 backdrop-blur-md flex items-center justify-center relative shadow-2xl">
          {/* Thumbstick central */}
          <div
            className="w-12 h-12 rounded-full bg-white/80 shadow-lg transition-transform duration-75 flex items-center justify-center"
            style={{
              transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
            }}
          >
            <div className="w-4 h-4 rounded-full bg-neutral-800/40" />
          </div>
          <span className="absolute -bottom-6 text-[10px] text-white/50 tracking-wider uppercase font-semibold">
            Mover
          </span>
        </div>
      </div>

      {/* Zona Derecha: Arrastre para rotación de vista */}
      <div
        className="w-1/2 h-full pointer-events-auto relative flex items-end justify-end p-8"
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        onTouchCancel={handleLookEnd}
      >
        <div className="p-3 rounded-full bg-black/20 border border-white/20 backdrop-blur-sm text-white/60 text-xs">
          Arrastra para mirar
        </div>
      </div>
    </div>
  );
};
