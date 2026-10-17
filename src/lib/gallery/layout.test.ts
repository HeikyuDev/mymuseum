import { describe, expect, it } from "vitest";
import { artworkSize, photoSize } from "./frame-specs";
import {
  ENTRANCE_LETTERING_WIDTH,
  EYE_CENTER,
  DIVIDER_WIDTH,
  buildLayout,
  gapBetween,
  hallStopIndex,
  nearestStop,
  zoneBlendAt,
  zoneIndexAt,
  type LayoutZoneInput,
} from "./layout";

const art = (id: string, aspect: number | null, frameStyle: "minimal" | "wood" = "minimal", mat = false) => ({
  id,
  title: `Title ${id}`,
  aspect,
  frameStyle,
  mat,
});

const zones: LayoutZoneInput[] = [
  { id: "h1", name: "Hall one", kind: "hall", artworks: [art("a", 1.5), art("b", 0.7, "wood", true), art("c", 1)] },
  { id: "h2", name: "Hall two", kind: "hall", artworks: [art("d", 3), art("e", null)] },
  { id: "empty", name: "Empty", kind: "hall", artworks: [] },
  { id: "other", name: "Other", kind: "other", artworks: [art("f", 1.2)] },
];

describe("photoSize", () => {
  it("keeps a consistent visual weight across aspect ratios", () => {
    const areas = [0.8, 1, 1.5, 2].map((a) => {
      const s = photoSize(a);
      return s.w * s.h;
    });
    for (const area of areas) expect(area).toBeGreaterThanOrEqual(1.65);
    for (const area of areas) expect(area).toBeLessThanOrEqual(1.9);
  });

  it("scales small and square photos up so they do not float on a large wall", () => {
    expect(photoSize(1).h).toBeGreaterThanOrEqual(1.25);
    for (const a of [0.7, 1, 1.4, 2, 2.6]) expect(Math.min(photoSize(a).w, photoSize(a).h)).toBeGreaterThanOrEqual(0.94);
  });

  it("clamps panoramas and falls back for missing aspects", () => {
    const pano = photoSize(5);
    expect(pano.w).toBeLessThanOrEqual(2.6 + 1e-9);
    expect(pano.w / pano.h).toBeCloseTo(5, 5);
    expect(photoSize(null).w / photoSize(null).h).toBeCloseTo(4 / 3, 5);
    expect(photoSize(Number.NaN).w).toBeGreaterThan(0);
  });

  it("never exceeds the maximum height for tall portraits", () => {
    expect(photoSize(0.3).h).toBeLessThanOrEqual(1.6 + 1e-9);
  });
});

describe("artworkSize", () => {
  it("adds the mat and frame around the photo", () => {
    const plain = artworkSize(1.5, "minimal", false);
    const matted = artworkSize(1.5, "wood", true);
    expect(plain.outerW).toBeGreaterThan(plain.imageW);
    expect(matted.outerW).toBeGreaterThan(matted.openingW);
    expect(matted.openingW).toBeGreaterThan(matted.imageW);
  });

  it("ignores the mat for canvas wraps and floating glass", () => {
    expect(artworkSize(1.5, "canvas_wrap", true).matW).toBe(0);
    expect(artworkSize(1.5, "floating_glass", true).matW).toBe(0);
  });
});

describe("buildLayout", () => {
  const layout = buildLayout(zones);

  it("is deterministic", () => {
    expect(buildLayout(zones)).toEqual(layout);
  });

  it("skips empty halls and keeps the Other zone last", () => {
    expect(layout.zones.map((z) => z.id)).toEqual(["h1", "h2", "other"]);
    expect(layout.zones[2].kind).toBe("other");
  });

  it("returns an empty layout without artworks", () => {
    const empty = buildLayout([{ id: "x", name: "X", kind: "hall", artworks: [] }]);
    expect(empty.stops).toEqual([]);
    expect(empty.artworks).toEqual([]);
  });

  it("hangs every artwork centered at eye level, strictly left to right without overlap", () => {
    for (const a of layout.artworks) expect(a.y).toBe(EYE_CENTER);
    for (let i = 1; i < layout.artworks.length; i += 1) {
      const prev = layout.artworks[i - 1];
      const next = layout.artworks[i];
      expect(next.x - next.outerW / 2).toBeGreaterThanOrEqual(prev.x + prev.outerW / 2 + 1.1 - 1e-9);
    }
  });

  it("scales the gap with the neighbours' widths", () => {
    expect(gapBetween(2.4, 2.4)).toBeGreaterThan(gapBetween(0.8, 0.8));
    expect(gapBetween(0.2, 0.2)).toBe(1.1);
    expect(gapBetween(9, 9)).toBe(1.9);
  });

  it("places dividers so artworks never touch them", () => {
    for (const zone of layout.zones) {
      const inZone = layout.artworks.filter((a) => a.zoneIndex === zone.zoneIndex);
      for (const a of inZone) {
        expect(a.x - a.outerW / 2).toBeGreaterThan(zone.dividerX + DIVIDER_WIDTH / 2);
      }
    }
    for (let i = 1; i < layout.zones.length; i += 1) {
      const prevLast = layout.artworks.filter((a) => a.zoneIndex === i - 1).at(-1)!;
      expect(layout.zones[i].dividerX - DIVIDER_WIDTH / 2).toBeGreaterThan(prevLast.x + prevLast.outerW / 2);
    }
  });

  it("makes zones contiguous: each zone ends where the next starts", () => {
    for (let i = 0; i < layout.zones.length - 1; i += 1) expect(layout.zones[i].end).toBe(layout.zones[i + 1].start);
    expect(layout.minX).toBeLessThan(layout.zones[0].dividerX);
    expect(layout.maxX).toBe(layout.zones.at(-1)!.end);
  });

  it("creates one stop per artwork plus one per hall entrance, in walking order", () => {
    expect(layout.stops).toHaveLength(layout.artworks.length + layout.zones.length);
    const xs = layout.stops.map((s) => s.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(layout.stops[0].kind).toBe("hall");
    expect(layout.stops[layout.firstArtworkStop].kind).toBe("artwork");
    expect(hallStopIndex(layout, 1)).toBe(layout.stops.findIndex((s) => s.id === "hall:h2"));
  });

  it("starts in front of a solid entrance wall: the first stop frames it, no doorway is needed", () => {
    const { entrance } = layout;
    expect(entrance.start).toBe(layout.minX);
    expect(entrance.centerX).toBe((entrance.start + entrance.end) / 2);
    expect(layout.stops[0]).toMatchObject({ kind: "hall", zoneIndex: 0, x: entrance.centerX });
    // The lettered area fits inside the wall and ends well before the first frame.
    expect(entrance.end - entrance.start).toBeGreaterThan(ENTRANCE_LETTERING_WIDTH + 1);
    const first = layout.artworks[0];
    expect(entrance.end).toBeLessThan(first.x - first.outerW / 2);
    expect(entrance.centerX).toBeLessThan(first.x);
    expect(layout.stops[layout.firstArtworkStop].x).toBeGreaterThan(entrance.end);
  });

  it("keeps the doorways between halls where they were", () => {
    expect(layout.stops.filter((stop) => stop.kind === "hall")).toHaveLength(layout.zones.length);
    expect(layout.stops.find((stop) => stop.id === "hall:h2")?.x).toBe(layout.zones[1].dividerX);
  });

  it("puts the plaque below the frame, inside the wall", () => {
    for (const a of layout.artworks) {
      expect(a.plaque.y + a.plaque.h / 2).toBeLessThan(a.y - a.outerH / 2);
      expect(a.plaque.y - a.plaque.h / 2).toBeGreaterThan(0.2);
    }
  });
});

describe("zone lookups", () => {
  const layout = buildLayout(zones);

  it("finds the nearest stop and owning zone", () => {
    const stop = layout.stops[4];
    expect(nearestStop(layout, stop.x + 0.01)).toBe(4);
    expect(zoneIndexAt(layout, layout.minX - 5)).toBe(0);
    expect(zoneIndexAt(layout, layout.zones[1].dividerX + 0.1)).toBe(1);
    expect(zoneIndexAt(layout, layout.maxX)).toBe(layout.zones.length - 1);
  });

  it("blends smoothly around dividers and is flat elsewhere", () => {
    const divider = layout.zones[1].dividerX;
    expect(zoneBlendAt(layout, divider - 10)).toEqual({ from: 0, to: 0, amount: 0 });
    expect(zoneBlendAt(layout, divider).amount).toBeCloseTo(0.5, 5);
    expect(zoneBlendAt(layout, divider + 2.6)).toEqual({ from: 1, to: 1, amount: 0 });
    let last = -1;
    for (let x = divider - 3; x <= divider + 3; x += 0.25) {
      const { amount, from, to } = zoneBlendAt(layout, x);
      if (from !== to) {
        expect(amount).toBeGreaterThanOrEqual(last);
        last = amount;
      }
    }
  });
});
