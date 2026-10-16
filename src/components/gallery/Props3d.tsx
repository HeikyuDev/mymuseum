"use client";

import { useMemo } from "react";
import { CatmullRomCurve3, Vector3 } from "three";
import { PORTAL_WIDTH, type MuseumLayout } from "@/lib/gallery/layout";
import type { ZoneLook } from "@/lib/gallery/scene-look";
import { useGallery } from "./context";

// Simple, tasteful gallery furniture: benches, plants, rope barriers.

type Props = { zoneIndex: number; look: ZoneLook; layout: MuseumLayout };

export function Props3d({ zoneIndex, look, layout }: Props) {
  const { quality } = useGallery();
  if (!quality.props || look.decor.length === 0) return null;
  const artworks = layout.artworks.filter((a) => a.zoneIndex === zoneIndex);
  const zone = layout.zones[zoneIndex];
  return (
    <group>
      {look.decor.includes("rope_barriers") ? <RopeLine artworks={artworks} /> : null}
      {look.decor.includes("benches")
        ? artworks
            .filter((_, i) => i % 3 === 1)
            .map((a) => <Bench key={a.id} x={a.x} width={Math.min(1.8, Math.max(1.1, a.outerW * 0.8))} dark={look.wallStyle === "wood_panel"} />)
        : null}
      {look.decor.includes("plants") ? (
        <>
          <Plant x={zone.portalX - PORTAL_WIDTH / 2 - 0.6} scale={0.9} />
          <Plant x={zone.portalX + PORTAL_WIDTH / 2 + 0.6} scale={0.9} />
        </>
      ) : null}
    </group>
  );
}

function Bench({ x, width, dark }: { x: number; width: number; dark: boolean }) {
  const seat = dark ? "#2a2018" : "#2b2622";
  return (
    <group position={[x, 0, 1.45]}>
      <mesh position={[0, 0.43, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.08, 0.42]} />
        <meshStandardMaterial color="#3a3029" roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.465, 0]} castShadow>
        <boxGeometry args={[width - 0.04, 0.03, 0.38]} />
        <meshStandardMaterial color={seat} roughness={0.8} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (width / 2 - 0.12), 0.2, 0]} castShadow>
          <boxGeometry args={[0.05, 0.4, 0.36]} />
          <meshStandardMaterial color="#1e1b19" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function Plant({ x, scale = 1 }: { x: number; scale?: number }) {
  const leaves = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        theta: (i / 16) * Math.PI * 2 + (i % 3) * 0.25,
        phi: 0.12 + (i % 5) * 0.1,
        length: 0.75 + ((i * 7) % 6) * 0.1,
        tone: i % 2 === 0 ? "#2f5d3a" : "#3f7a4b",
      })),
    [],
  );
  return (
    <group position={[x, 0, 0.75]} scale={scale}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.26, 0.2, 0.6, 28]} />
        <meshStandardMaterial color="#d9d3c6" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.235, 0.235, 0.02, 24]} />
        <meshStandardMaterial color="#2a1f17" roughness={1} />
      </mesh>
      {leaves.map((leaf) => (
        <group key={leaf.theta} position={[0, 0.6, 0]} rotation={[0, leaf.theta, 0]}>
          <mesh
            position={[Math.sin(leaf.phi) * leaf.length * 0.5, Math.cos(leaf.phi) * leaf.length * 0.5, 0]}
            rotation={[0, 0, -leaf.phi]}
            scale={[0.07, leaf.length * 0.5, 0.018]}
            castShadow
          >
            <sphereGeometry args={[1, 12, 10]} />
            <meshStandardMaterial color={leaf.tone} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function RopeLine({ artworks }: { artworks: MuseumLayout["artworks"] }) {
  const { snapshot } = useGallery();
  const posts = useMemo(() => {
    // Posts stand in the gaps between artworks so they never hide a placard.
    const xs: number[] = [];
    artworks.forEach((a, i) => {
      const left = a.x - a.outerW / 2;
      const right = a.x + a.outerW / 2;
      if (i === 0) xs.push(left - 0.7);
      const next = artworks[i + 1];
      xs.push(next ? (right + (next.x - next.outerW / 2)) / 2 : right + 0.7);
    });
    return xs;
  }, [artworks]);
  const z = 1.55;
  return (
    <group>
      {posts.map((x) => (
        <group key={x} position={[x, 0, z]}>
          <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.17, 0.19, 0.04, 28]} />
            <meshStandardMaterial color="#b8923a" metalness={1} roughness={0.3} envMapIntensity={1.4} />
          </mesh>
          <mesh position={[0, 0.48, 0]} castShadow>
            <cylinderGeometry args={[0.028, 0.028, 0.92, 16]} />
            <meshStandardMaterial color="#b8923a" metalness={1} roughness={0.28} envMapIntensity={1.4} />
          </mesh>
          <mesh position={[0, 0.95, 0]} castShadow>
            <sphereGeometry args={[0.052, 16, 12]} />
            <meshStandardMaterial color="#b8923a" metalness={1} roughness={0.25} envMapIntensity={1.4} />
          </mesh>
        </group>
      ))}
      {/* a photographer unhooks the ropes so they never cross the placards in a photo */}
      {snapshot
        ? null
        : posts.slice(0, -1).map((x, i) => <Rope key={x} from={x} to={posts[i + 1]} z={z} />)}
    </group>
  );
}

function Rope({ from, to, z }: { from: number; to: number; z: number }) {
  const geometry = useMemo(() => {
    const sag = Math.min(0.2, (to - from) * 0.045);
    const points = [0, 0.25, 0.5, 0.75, 1].map((t) => new Vector3(from + (to - from) * t, 0.86 - Math.sin(t * Math.PI) * sag, z));
    const curve = new CatmullRomCurve3(points);
    return { curve, segments: 36 };
  }, [from, to, z]);
  return (
    <mesh castShadow>
      <tubeGeometry args={[geometry.curve, geometry.segments, 0.017, 10, false]} />
      <meshStandardMaterial color="#7b1426" roughness={0.75} />
    </mesh>
  );
}
