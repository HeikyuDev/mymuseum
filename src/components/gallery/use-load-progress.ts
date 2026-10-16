"use client";

import { useEffect, useState } from "react";
import { DefaultLoadingManager } from "three";

export type LoadProgress = { active: boolean; progress: number; total: number };

/**
 * Progress of the photos registered with three's loading manager (only the artworks next to the
 * camera register, so the loading screen never waits for the whole museum). A light replacement
 * for drei's useProgress, which would pull the whole drei bundle into the page.
 */
export function useLoadProgress(): LoadProgress {
  const [state, setState] = useState<LoadProgress>({ active: false, progress: 0, total: 0 });
  useEffect(() => {
    const manager = DefaultLoadingManager;
    const previous = { onStart: manager.onStart, onProgress: manager.onProgress, onLoad: manager.onLoad };
    manager.onStart = (_url, loaded, total) => setState({ active: true, progress: total ? (loaded / total) * 100 : 100, total });
    manager.onProgress = (_url, loaded, total) => setState({ active: true, progress: total ? (loaded / total) * 100 : 100, total });
    manager.onLoad = () => setState((current) => ({ ...current, active: false, progress: 100 }));
    return () => {
      manager.onStart = previous.onStart;
      manager.onProgress = previous.onProgress;
      manager.onLoad = previous.onLoad;
    };
  }, []);
  return state;
}
