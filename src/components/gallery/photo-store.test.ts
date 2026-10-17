import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebGLRenderer } from "three";

const loads: { url: string; size: number; resolve: () => void; dispose: ReturnType<typeof vi.fn> }[] = [];

vi.mock("./photo-loader", () => ({
  loadPhotoTexture: (url: string, size: number) =>
    new Promise((resolve) => {
      const dispose = vi.fn();
      loads.push({ url, size, resolve: () => resolve({ texture: { dispose }, width: size, height: size }), dispose });
    }),
}));

const { PhotoStore, bandOf } = await import("./photo-store");

const spec = (name: string) => ({ url: `/${name}.jpg`, thumbUrl: `/${name}-t.webp`, smallSize: 1024, fullSize: 2048, upgrade: true, anisotropy: 4, maxLoads: 2 });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(resting = { value: true }) {
  const store = new PhotoStore(true);
  const uploaded: unknown[] = [];
  const gl = { initTexture: (texture: unknown) => uploaded.push(texture) } as unknown as WebGLRenderer;
  store.attach(gl, () => {}, () => resting.value);
  return { store, uploaded, resting };
}

beforeEach(() => {
  loads.length = 0;
});

describe("bandOf", () => {
  it("groups artworks by distance to the focus", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => bandOf(d, 3))).toEqual([0, 1, 2, 2, 3, 3, 4]);
  });
});

describe("PhotoStore", () => {
  it("loads the thumbnail first and the full image only for the artwork in front of the camera", async () => {
    const { store } = setup();
    store.setBand("a", spec("a"), 0);
    expect(loads.map((l) => l.url)).toEqual(["/a-t.webp", "/a.jpg"]);
    expect(loads[0].size).toBe(1024);
    expect(loads[1].size).toBe(2048);
    store.setBand("b", spec("b"), 1);
    expect(loads.map((l) => l.url)).toContain("/b-t.webp");
    expect(loads.map((l) => l.url)).not.toContain("/b.jpg");
  });

  it("postpones prefetching and upgrades while the camera moves, and starts them at rest", async () => {
    const resting = { value: false };
    const { store } = setup(resting);
    store.setBand("near", spec("near"), 1);
    store.setBand("far", spec("far"), 2);
    expect(loads.map((l) => l.url)).toEqual(["/near-t.webp"]);
    expect(store.waiting).toBe(1);
    resting.value = true;
    store.startDeferred();
    expect(loads.map((l) => l.url)).toEqual(["/near-t.webp", "/far-t.webp"]);
    expect(store.waiting).toBe(0);
  });

  it("uploads one texture at a time and, while moving, only for the artwork the camera is heading to", async () => {
    const { store, uploaded } = setup();
    store.setBand("front", spec("front"), 0);
    store.setBand("side", spec("side"), 1);
    loads.forEach((l) => l.resolve());
    await settle();
    expect(store.pending).toBe(3); // front thumbnail, front full image, side thumbnail
    expect(store.uploadOne(true)).toBe(true); // the thumbnail of the artwork in front
    expect(store.uploadOne(true)).toBe(false); // everything else waits for the camera to rest
    expect(uploaded).toHaveLength(1);
    expect(store.snapshot("front").small).not.toBeNull();
    expect(store.uploadOne(false)).toBe(true); // at rest: thumbnails first, then the full image
    expect(store.snapshot("side").small).not.toBeNull();
    expect(store.snapshot("front").full).toBeNull();
    expect(store.uploadOne(false)).toBe(true);
    expect(store.snapshot("front").full).not.toBeNull();
    expect(store.pending).toBe(0);
  });

  it("frees a photo when its artwork leaves the window", async () => {
    const { store } = setup();
    store.setBand("a", spec("a"), 1);
    loads[0].resolve();
    await settle();
    store.uploadOne(false);
    expect(store.snapshot("a").small).not.toBeNull();
    store.setBand("a", spec("a"), 4);
    expect(store.snapshot("a").small).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(loads[0].dispose).toHaveBeenCalled();
  });
});
