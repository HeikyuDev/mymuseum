"use client";

import {
  animate,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { ViewerHall } from "@/lib/museum-data";
import { ArtworkSlot } from "./ArtworkSlot";
import { DECOR_REGISTRY } from "./decor";
import {
  FLOOR_DECORATION_SPECS,
  LIGHTING,
  decorationBody,
  floorLayer,
  wallLayer,
} from "./scenery";

// Parallax factors: how far each layer travels per px of camera travel.
const WALL_PARALLAX = 0.35;
const FLOOR_PARALLAX = 0.9;
const DECOR_PARALLAX = 1.12;
const FLOOR_TILT_DEG = 58;

function useElementSize() {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, size] as const;
}

type Props = {
  hall: ViewerHall;
  /** Active slot: 0..n-1 are artworks, -1 is the previous-hall door, n is the next-hall door. */
  slot: number;
  prevHall: ViewerHall | null;
  nextHall: ViewerHall | null;
  reduced: boolean;
  spring: { stiffness: number; damping: number };
  onSelect: (slot: number) => void;
  onEnter: (direction: 1 | -1) => void;
  onOpen: () => void;
};

export function HallScene({ hall, slot, prevHall, nextHall, reduced, spring, onSelect, onEnter, onOpen }: Props) {
  const [setNode, { w: W, h: H }] = useElementSize();
  const style = hall.style;
  const n = hall.artworks.length;

  const cam = useMotionValue(0);
  const springCam = useSpring(cam, { stiffness: spring.stiffness, damping: spring.damping, mass: 1.1, restDelta: 0.5 });
  const camera = reduced ? cam : springCam;

  const velocity = useVelocity(camera);
  const smoothVelocity = useSpring(velocity, { stiffness: 160, damping: 28 });
  const tilt = useTransform(smoothVelocity, [-2600, 0, 2600], [4, 0, -4]);

  const fade = useMotionValue(1);

  // Geometry (all derived from the measured stage size).
  const S = W < 640 ? W * 0.84 : Math.max(W * 0.55, 540);
  const wallH = H * 0.7;
  const floorH = H - wallH;
  const centerY = wallH * 0.5;
  const maxArtW = Math.min(S * 0.82, W * 0.9);
  const maxArtH = wallH * 0.62;
  const doorH = wallH * 0.84;
  const doorW = Math.min(S * 0.5, doorH * 0.58);
  const wallExtra = WALL_PARALLAX * S * (n + 2);
  const floorExtra = FLOOR_PARALLAX * S * (n + 2);
  const depthUnit = floorH * 1.1;

  const prevS = useRef(0);
  useEffect(() => {
    if (!S) return;
    const target = slot * S;
    cam.set(target);
    if (prevS.current !== S) {
      springCam.jump(target);
      prevS.current = S;
    }
  }, [slot, S, cam, springCam]);

  useEffect(() => {
    if (!reduced) {
      fade.set(1);
      return;
    }
    fade.set(0.15);
    const controls = animate(fade, 1, { duration: 0.25 });
    return () => controls.stop();
  }, [slot, reduced, fade]);

  const wallX = useTransform(camera, (v) => -v * WALL_PARALLAX);
  const floorX = useTransform(camera, (v) => -v * FLOOR_PARALLAX);
  const artX = useTransform(camera, (v) => -v);
  const decorX = useTransform(camera, (v) => -v * DECOR_PARALLAX);

  const lighting = LIGHTING[style.lighting];
  const wall = wallLayer(style.wallStyle, style.wallColor);
  const floor = floorLayer(style.floorStyle);

  const decoration = style.floorDecoration === "none" ? null : FLOOR_DECORATION_SPECS[style.floorDecoration];
  const decorationColor = style.floorDecorationColor ?? decoration?.color ?? "#000000";
  const floorCenterX = (i: number) => floorExtra + W / 2 + FLOOR_PARALLAX * i * S;

  return (
    <div ref={setNode} className="absolute inset-0 overflow-hidden" style={{ perspective: 1500 }}>
      {W > 0 && H > 0 ? (
        <>
          <motion.div
            className="absolute inset-0"
            style={{ rotateY: reduced ? 0 : tilt, scale: 1.05, opacity: fade, transformOrigin: "50% 60%" }}
          >
            {/* Wall */}
            <motion.div
              className="absolute top-0"
              style={{ left: -wallExtra, width: W + 2 * wallExtra, height: wallH, x: wallX, ...wall }}
            />
            <div
              aria-hidden
              className="absolute inset-x-0 top-0"
              style={{ height: wallH * 0.22, background: "linear-gradient(rgba(0,0,0,.2), rgba(0,0,0,0))" }}
            />
            <div
              aria-hidden
              className="absolute inset-x-0"
              style={{
                top: wallH - H * 0.03,
                height: H * 0.03,
                background: "linear-gradient(rgba(255,255,255,.7), rgba(255,255,255,.4))",
                boxShadow: "0 -1px 0 rgba(0,0,0,.18), 0 2px 4px rgba(0,0,0,.25)",
              }}
            />

            {/* Floor in perspective */}
            <div
              className="absolute inset-x-0 bottom-0 overflow-hidden"
              style={{ height: floorH, perspective: floorH * 2.2, perspectiveOrigin: "50% 0%" }}
            >
              <motion.div
                className="absolute top-0"
                style={{
                  left: -floorExtra,
                  width: W + 2 * floorExtra,
                  height: depthUnit * 2.6,
                  x: floorX,
                  rotateX: FLOOR_TILT_DEG,
                  transformOrigin: "50% 0%",
                  ...floor,
                }}
              >
                {decoration?.kind === "runner" && style.floorDecoration !== "none" ? (
                  <div
                    className="absolute inset-x-0 box-border"
                    style={{ top: depthUnit * 0.27, height: depthUnit * 0.46, ...decorationBody(style.floorDecoration, decorationColor) }}
                  />
                ) : null}
                {decoration && decoration.kind !== "runner" && style.floorDecoration !== "none"
                  ? Array.from({ length: n }, (_, i) => {
                      const width = decoration.kind === "rug" ? S * 0.62 : S * 0.7;
                      const height = decoration.kind === "rug" ? depthUnit * 0.42 : depthUnit * 0.4;
                      return (
                        <div
                          key={i}
                          className="absolute box-border"
                          style={{
                            left: floorCenterX(i) - width / 2,
                            top: depthUnit * 0.3,
                            width,
                            height,
                            ...(style.floorDecoration === "spotlight_pool"
                              ? { borderRadius: "50%" }
                              : {}),
                            ...decorationBody(style.floorDecoration as Exclude<typeof style.floorDecoration, "none">, decorationColor),
                          }}
                        />
                      );
                    })
                  : null}
              </motion.div>
              {/* Depth shading: dark at the wall junction, lit toward the viewer */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{ background: "linear-gradient(rgba(0,0,0,.38), rgba(0,0,0,.04) 55%, rgba(255,255,255,.06))" }}
              />
            </div>

            {/* Artworks and doors, camera-locked */}
            <motion.div className="absolute top-0 h-full w-0" style={{ left: W / 2, x: artX }}>
              {hall.artworks.map((artwork, i) => (
                <ArtworkSlot
                  key={artwork.id}
                  artwork={artwork}
                  index={i}
                  isActive={i === slot}
                  spacing={S}
                  camera={camera}
                  maxW={maxArtW}
                  maxH={maxArtH}
                  centerY={centerY}
                  wallTop={0}
                  lighting={lighting}
                  nearActive={Math.abs(i - slot) <= 1}
                  onActivate={onSelect}
                  onOpen={onOpen}
                />
              ))}
              {prevHall ? (
                <Door
                  index={-1}
                  dest={prevHall}
                  direction={-1}
                  spacing={S}
                  camera={camera}
                  w={doorW}
                  h={doorH}
                  top={wallH - doorH}
                  isActive={slot === -1}
                  onSelect={onSelect}
                  onEnter={onEnter}
                />
              ) : null}
              {nextHall ? (
                <Door
                  index={n}
                  dest={nextHall}
                  direction={1}
                  spacing={S}
                  camera={camera}
                  w={doorW}
                  h={doorH}
                  top={wallH - doorH}
                  isActive={slot === n}
                  onSelect={onSelect}
                  onEnter={onEnter}
                />
              ) : null}
            </motion.div>

            {/* Foreground props (extra parallax gives depth) */}
            {style.decor.length > 0 ? (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute top-0 h-full w-0"
                style={{ left: W / 2, x: decorX }}
              >
                {style.decor.flatMap((id) =>
                  DECOR_REGISTRY[id].positions(n).map((pos) => (
                    <div
                      key={`${id}-${pos}`}
                      className="absolute -translate-x-1/2 -translate-y-full"
                      style={{ left: pos * S * DECOR_PARALLAX, top: wallH + floorH * (id === "rope_barriers" ? 0.78 : 0.62) }}
                    >
                      {DECOR_REGISTRY[id].render(Math.max(floorH / 240, 0.5))}
                    </div>
                  )),
                )}
              </motion.div>
            ) : null}
          </motion.div>

          {/* Room lighting */}
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: lighting.ambient }} />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 50% 42%, rgba(${lighting.tint}, ${lighting.cone * 0.35}) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,${lighting.vignette}) 100%)`,
            }}
          />
        </>
      ) : null}
    </div>
  );
}

type DoorProps = {
  index: number;
  dest: ViewerHall;
  direction: 1 | -1;
  spacing: number;
  camera: MotionValue<number>;
  w: number;
  h: number;
  top: number;
  isActive: boolean;
  onSelect: (slot: number) => void;
  onEnter: (direction: 1 | -1) => void;
};

/** Archway leading to the neighbouring hall. Its interior previews that hall's wall. */
function Door({ index, dest, direction, spacing, camera, w, h, top, isActive, onSelect, onEnter }: DoorProps) {
  const distance = useTransform(camera, (v) => Math.min(Math.abs(v - index * spacing) / spacing, 1.4));
  const opacity = useTransform(distance, [0, 1, 1.4], [1, 0.65, 0.5]);
  const scale = useTransform(distance, [0, 1, 1.4], [1, 0.92, 0.9]);
  const destWall = wallLayer(dest.style.wallStyle, dest.style.wallColor);
  const radius = `${w / 2}px ${w / 2}px 0 0`;

  return (
    <div className="absolute -translate-x-1/2" style={{ left: index * spacing, top }}>
      <motion.div style={{ opacity, scale, transformOrigin: "50% 100%" }}>
        <button
          type="button"
          onClick={() => (isActive ? onEnter(direction) : onSelect(index))}
          aria-label={isActive ? `Enter ${dest.name}` : `Go to the door to ${dest.name}`}
          className="group relative block cursor-pointer"
          style={{
            width: w,
            height: h,
            borderRadius: radius,
            padding: Math.max(8, w * 0.08),
            background: "linear-gradient(135deg, #e9e5dc, #bcb5a6 55%, #d8d3c8)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,.6), 6px 10px 22px rgba(0,0,0,.35)",
          }}
        >
          <span
            className="block h-full w-full"
            style={{
              borderRadius: `${w / 2}px ${w / 2}px 0 0`,
              backgroundColor: destWall.backgroundColor,
              backgroundImage: `radial-gradient(ellipse at 50% 80%, rgba(255,248,230,.95), rgba(255,236,200,.5) 50%, rgba(0,0,0,.25) 100%)`,
              boxShadow: "inset 0 0 28px rgba(0,0,0,.45)",
            }}
          />
          <span
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-normal text-center rounded-full border border-line bg-raised/95 px-3 py-1 text-xs font-medium text-fg shadow-sm"
            style={{ top: "58%", width: "92%" }}
          >
            {direction === 1 ? "Next hall" : "Previous hall"}: {dest.name}
          </span>
        </button>
      </motion.div>
    </div>
  );
}
