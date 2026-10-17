import { describe, expect, it } from "vitest";
import {
  DEFAULT_TUNING,
  framingDistance,
  horizontalFov,
  pitchForFocus,
  glideAt,
  glideDuration,
  restingPose,
} from "./camera-math";

describe("framingDistance", () => {
  it("backs off for wide targets and narrow viewports", () => {
    const near = framingDistance(1.2, 1, 1.6);
    const wide = framingDistance(4, 1, 1.6);
    const phone = framingDistance(1.2, 1, 0.46);
    expect(wide).toBeGreaterThan(near);
    expect(phone).toBeGreaterThan(near);
  });

  it("stays within the allowed range", () => {
    expect(framingDistance(0.1, 0.1, 1.6)).toBe(DEFAULT_TUNING.minDistance);
    expect(framingDistance(50, 50, 0.3)).toBe(DEFAULT_TUNING.maxDistance);
  });

  it("computes a wider horizontal than vertical fov on landscape screens", () => {
    expect(horizontalFov(46, 1.6)).toBeGreaterThan(46);
    expect(horizontalFov(46, 1)).toBeCloseTo(46, 5);
  });
});

describe("restingPose", () => {
  it("puts the subject in the middle of the wall area and keeps the floor to a thin strip", () => {
    const aspect = 1.6;
    const focusY = 1.35;
    const { position, target } = restingPose(3, 1.8, 1.4, focusY, aspect);
    const tanV = Math.tan((DEFAULT_TUNING.fov * Math.PI) / 360);
    const pitch = Math.atan((position.y - target.y) / position.z);
    const ndc = (angleBelowHorizon: number) => -Math.tan(angleBelowHorizon - pitch) / tanV;
    const focusNdc = ndc(Math.atan((position.y - focusY) / position.z));
    expect(focusNdc).toBeCloseTo(DEFAULT_TUNING.floorShare, 5);
    const baseNdc = ndc(Math.atan(position.y / position.z));
    const floorShare = (baseNdc + 1) / 2;
    expect(floorShare).toBeGreaterThan(0.1);
    expect(floorShare).toBeLessThan(0.3);
    expect(pitchForFocus(position.z, focusY)).toBeCloseTo(pitch, 6);
  });

  it("keeps x aligned with the stop and looks at the wall plane", () => {
    const pose = restingPose(-4.2, 1, 1, 1.5, 1.6);
    expect(pose.position.x).toBe(-4.2);
    expect(pose.target.x).toBe(-4.2);
    expect(pose.target.z).toBe(0);
  });

  it("zooms in closer when asked", () => {
    expect(restingPose(0, 1.5, 1.2, 1.4, 1.6, DEFAULT_TUNING, 0.6).position.z).toBeLessThan(restingPose(0, 1.5, 1.2, 1.4, 1.6).position.z);
  });
});

describe("glideAt", () => {
  it("is smootherstep from rest: monotonic, slow at both ends, exact at the end", () => {
    let previous = -1;
    const vel = [0];
    for (let i = 0; i <= 100; i += 1) {
      const value = glideAt(0, 0, 10, 1, i / 100, vel);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(10);
      previous = value;
    }
    expect(glideAt(0, 0, 10, 1, 0.01)).toBeLessThan(0.001);
    expect(glideAt(0, 0, 10, 1, 0.5)).toBeCloseTo(5, 6);
    expect(glideAt(0, 0, 10, 1, 1)).toBe(10);
    expect(glideAt(0, 0, 10, 1, 5)).toBe(10);
    glideAt(0, 0, 10, 1, 0.5, vel);
    expect(vel[0]).toBeCloseTo(18.75, 4);
  });

  it("is deterministic for a given elapsed time, whatever the frame rate", () => {
    const at = (steps: number) => {
      let t = 0;
      for (let i = 0; i < steps; i += 1) t += 0.7 / steps;
      return glideAt(2, 0, 9, 1.2, t);
    };
    expect(at(10)).toBeCloseTo(at(100), 9);
  });

  it("continues an interrupted glide without a velocity jump", () => {
    const vel = [0];
    const x = glideAt(0, 0, 10, 1, 0.4, vel);
    const v = vel[0];
    const resumed = [0];
    expect(glideAt(x, v, 20, 1.2, 0, resumed)).toBeCloseTo(x, 9);
    expect(resumed[0]).toBeCloseTo(v, 6);
  });

  it("does not move when the duration is zero", () => {
    expect(glideAt(1, 0, 4, 0, 0)).toBe(4);
  });
});

describe("glideDuration", () => {
  it("is instant with reduced motion and bounded otherwise", () => {
    expect(glideDuration(12, true)).toBe(0);
    expect(glideDuration(1, false)).toBeLessThan(glideDuration(30, false));
    expect(glideDuration(3.5, false)).toBeGreaterThanOrEqual(0.9);
    expect(glideDuration(500, false)).toBeLessThanOrEqual(1.7);
  });
});
