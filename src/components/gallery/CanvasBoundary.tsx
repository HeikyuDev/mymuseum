"use client";

import { Component, type ReactNode } from "react";

type Props = { fallback: ReactNode; children: ReactNode };

/**
 * Catches what the canvas throws at mount (a WebGL context that cannot be created, for example while the quality
 * is switched on a device short of memory) so the visitor gets the plain list of artworks instead of a blank page.
 */
export class CanvasBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[gallery] the 3D canvas failed", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
