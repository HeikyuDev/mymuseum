import { create } from "zustand";

interface TouchControlsState {
  isMobile: boolean;
  setIsMobile: (val: boolean) => void;
  // Desplazamiento desde el joystick virtual (-1 a 1)
  moveVector: { x: number; y: number };
  setMoveVector: (vec: { x: number; y: number }) => void;
  // Delta de rotación táctil (yaw y pitch)
  rotationDelta: { x: number; y: number };
  setRotationDelta: (delta: { x: number; y: number }) => void;
  consumeRotationDelta: () => { x: number; y: number };
}

// Implementación liviana de store sin dependencias pesadas
let listeners: Array<() => void> = [];

let state: TouchControlsState = {
  isMobile: false,
  setIsMobile: (val: boolean) => {
    state.isMobile = val;
    notify();
  },
  moveVector: { x: 0, y: 0 },
  setMoveVector: (vec) => {
    state.moveVector = vec;
  },
  rotationDelta: { x: 0, y: 0 },
  setRotationDelta: (delta) => {
    state.rotationDelta = {
      x: state.rotationDelta.x + delta.x,
      y: state.rotationDelta.y + delta.y,
    };
  },
  consumeRotationDelta: () => {
    const d = { ...state.rotationDelta };
    state.rotationDelta = { x: 0, y: 0 };
    return d;
  },
};

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function getTouchControlsState() {
  return state;
}
