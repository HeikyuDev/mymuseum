"use client";

import { useMemo } from "react";
import { NormalBlending, ShaderMaterial } from "three";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uStrength;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= 0.82;
    float edge = smoothstep(0.7, 1.5, length(p));
    gl_FragColor = vec4(0.04, 0.03, 0.025, edge * uStrength);
  }
`;

/**
 * A soft vignette drawn inside the canvas as the last, single full-screen quad (not a CSS layer: a translucent
 * element over a WebGL canvas makes the compositor re-blend it every frame). Used by the baked tier, which
 * has no real light falloff of its own.
 */
export function ScreenVignette({ strength = 0.32 }: { strength?: number }) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uStrength: { value: strength } },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: NormalBlending,
        toneMapped: false,
      }),
    [strength],
  );
  return (
    <mesh frustumCulled={false} renderOrder={1000} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
