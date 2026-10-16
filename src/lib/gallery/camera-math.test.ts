import { describe, expect, it } from "vitest";
import {
  DEFAULT_TUNING,
  framingDistance,
  horizontalFov,
  pitchForFloorShare,
  restingPose,
  smoothDamp,
  travelTime,
  type DampState,
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
  it("puts the wall base at the requested share of the viewport", () => {
    const aspect = 1.6;
    const pose = restingPose(3, 1.8, 1.6, aspect);
    const { position, target } = pose;
    const pitch = Math.atan((position.y - target.y) / position.z);
    const baseAngle = Math.atan(position.y / position.z);
    const relative = baseAngle - pitch; // below the optical axis
    const ndc = -Math.tan(relative) / Math.tan((DEFAULT_TUNING.fov * Math.PI) / 360);
    const share = (ndc + 1) / 2;
    expect(share).toBeCloseTo(DEFAULT_TUNING.floorShare, 2);
    expect(pitchForFloorShare(position.z)).toBeCloseTo(pitch, 6);
  });

  it("keeps x aligned with the stop and looks at the wall plane", () => {
    const pose = restingPose(-4.2, 1, 1, 1.6);
    expect(pose.position.x).toBe(-4.2);
    expect(pose.target.x).toBe(-4.2);
    expect(pose.target.z).toBe(0);
  });

  it("zooms in closer when asked", () => {
    expect(restingPose(0, 1.5, 1.2, 1.6, DEFAULT_TUNING, 0.6).position.z).toBeLessThan(restingPose(0, 1.5, 1.2, 1.6).position.z);
  });
});

describe("smoothDamp", () => {
  it("moves continuously without teleporting and converges without overshoot", () => {
    const state: DampState = { value: 0, velocity: 0 };
    let previous = 0;
    let maxStep = 0;
    for (let i = 0; i < 600; i += 1) {
      const value = smoothDamp(state, 10, 0.7, 1 / 60);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
      expect(value).toBeLessThanOrEqual(10 + 1e-9);
      maxStep = Math.max(maxStep, value - previous);
      previous = value;
    }
    expect(maxStep).toBeLessThan(0.5);
    expect(state.value).toBeCloseTo(10, 3);
  });

  it("starts and ends slowly (ease in and out)", () => {
    const state: DampState = { value: 0, velocity: 0 };
    const first = smoothDamp(state, 10, 0.7, 1 / 60);
    expect(first).toBeLessThan(0.05);
  });

  it("respects the maximum speed", () => {
    const state: DampState = { value: 0, velocity: 0 };
    let previous = 0;
    for (let i = 0; i < 120; i += 1) {
      const value = smoothDamp(state, 1000, 0.5, 1 / 60, 4);
      expect((value - previous) * 60).toBeLessThan(4.5);
      previous = value;
    }
  });
});

describe("travelTime", () => {
  it("is instant with reduced motion and bounded otherwise", () => {
    expect(travelTime(12, true)).toBeLessThan(0.01);
    expect(travelTime(1, false)).toBeLessThan(travelTime(30, false));
    expect(travelTime(500, false)).toBeLessThanOrEqual(1.35);
  });
});
