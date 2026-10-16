"use client";

import React, { useState, useEffect } from "react";
import { DesktopControls } from "./DesktopControls";
import { MobileSceneController } from "./MobileSceneController";

interface MovementControlsProps {
  enabled?: boolean;
}

export const MovementControls: React.FC<MovementControlsProps> = ({
  enabled = true,
}) => {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    setIsTouch(hasTouch);
  }, []);

  if (!enabled) return null;

  return isTouch ? (
    <MobileSceneController enabled={enabled} />
  ) : (
    <DesktopControls enabled={enabled} />
  );
};
