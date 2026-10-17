import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebGLRenderer } from "three";

type Load = { url: string; size: number; resolve: () => void; reject: (error: unknown) => void; dispose: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn>; signal: AbortSignal };
const loads: Load[] = [];

vi.mock("./photo-loader", async () => {
  const actual = await vi.importActual<typeof import("./photo-loader")>("./photo-loader");
  return {
    ...actual,
    loadPhotoTexture: (url: string, size: number, _a: number, _m: number, signal: AbortSignal) =>
      new Promise((resolve, reject) => {
        const dispose = vi.fn();
        const close = vi.fn();
        loads.push({ url, size, signal, dispose, close, resolve: () => resolve({ texture: { dispose, image: { close } }, width: size, height: size }), reject });
      }),
  };
});

const { PhotoStore, bandOf, sizeForAttempt, MAX_ATTEMPTS } = await import("./photo-store");
const { PhotoLoadError } = await import("./photo-loader");

const baseSpec = (name: string) => ({ url: `/${name}.jpg`, thumbUrl: `/${name}-t.webp` as string | null, smallSize: 1024, fullSize: 2048, upgrade: true, anisotropy: 4, maxLoads: 2 });
const spec = (name: string, extra: Partial<ReturnType<typeof baseSpec>> = {}) => ({ ...baseSpec(name), ...extra });
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
afterEach(() => {
  vi.useRealTimers();
});

describe("bandOf", () => {
  it("groups artworks by distance to the focus", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => bandOf(d, 3))).toEqual([0, 1, 2, 2, 3, 3, 4]);
  });
});

describe("sizeForAttempt", () => {
  it("halves the size after a failure, never below a floor", () => {
    expect(sizeForAttempt(2048, 0)).toBe(2048);
    expect(sizeForAttempt(2048, 1)).toBe(1024);
    expect(sizeForAttempt(2048, 5)).toBe(512);
    expect(sizeForAttempt(300, 2)).toBe(256);
  });
});

describe("PhotoStore loading", () => {
  it("loads the thumbnail first, and the full image only once the thumbnail is ready", async () => {
    const { store } = setup();
    store.setBand("a", spec("a"), 0);
    expect(loads.map((l) => l.url)).toEqual(["/a-t.webp"]);
    loads[0].resolve();
    await settle();
    store.uploadOne(false);
    expect(loads.map((l) => l.url)).toEqual(["/a-t.webp", "/a.jpg"]);
    expect(loads[1].size).toBe(2048);
    store.setBand("b", spec("b"), 1);
    expect(loads.map((l) => l.url)).toContain("/b-t.webp");
    expect(loads.map((l) => l.url)).not.toContain("/b.jpg");
  });

  it("skips the upgrade when there is no thumbnail and the first load was already full size", async () => {
    const { store } = setup();
    store.setBand("a", spec("a", { thumbUrl: null, smallSize: 2048 }), 0);
    await settle();
    expect(loads.map((l) => l.url)).toEqual(["/a.jpg"]);
  });

  it("falls back to the original when the thumbnail is missing", async () => {
    const { store } = setup();
    store.setBand("a", spec("a"), 1);
    loads[0].reject(new PhotoLoadError("photo 404", true, 404));
    await settle();
    expect(loads.map((l) => l.url)).toEqual(["/a-t.webp", "/a.jpg"]);
  });

  it("postpones prefetching while the camera moves, and starts it at rest", () => {
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

  it("starts over when the photo behind an artwork changes", async () => {
    const { store } = setup();
    store.setBand("a", spec("a"), 1);
    loads[0].resolve();
    await settle();
    store.uploadOne(false);
    expect(store.snapshot("a").small).not.toBeNull();
    store.setBand("a", spec("a", { url: "/other.jpg", thumbUrl: "/other-t.webp" }), 1);
    expect(store.snapshot("a").small).toBeNull();
    expect(loads.at(-1)?.url).toBe("/other-t.webp");
  });
});

describe("PhotoStore uploads", () => {
  it("uploads one texture at a time and, while moving, only the thumbnail of the artwork the camera is heading to", async () => {
    const { store, uploaded } = setup();
    store.setBand("front", spec("front"), 0);
    store.setBand("side", spec("side"), 1);
    loads.forEach((l) => l.resolve());
    await settle();
    expect(store.pending).toBe(2);
    expect(store.uploadOne(true)).toBe(true);
    expect(store.uploadOne(true)).toBe(false);
    expect(uploaded).toHaveLength(1);
    expect(store.snapshot("front").small).not.toBeNull();
    expect(store.uploadOne(false)).toBe(true);
    expect(store.snapshot("side").small).not.toBeNull();
  });
});

describe("PhotoStore lifecycle", () => {
  it("disposes a result that arrives after the artwork left the window", async () => {
    const { store } = setup();
    store.setBand("a", spec("a"), 1);
    store.setBand("a", spec("a"), 4);
    expect(loads[0].signal.aborted).toBe(true);
    loads[0].resolve();
    await settle();
    expect(loads[0].dispose).toHaveBeenCalled();
    expect(loads[0].close).toHaveBeenCalled();
    expect(store.snapshot("a").small).toBeNull();
  });

  it("closes the bitmap of a decoded texture that is released before it reaches the GPU", async () => {
    const { store } = setup();
    store.setBand("a", spec("a"), 1);
    loads[0].resolve();
    await settle();
    expect(store.pending).toBe(1);
    store.setBand("a", spec("a"), 4);
    expect(store.pending).toBe(0);
    expect(loads[0].close).toHaveBeenCalled();
    expect(loads[0].dispose).toHaveBeenCalled();
  });

  it("frees a photo (after a short delay) when its artwork leaves the window", async () => {
    vi.useFakeTimers();
    const { store } = setup();
    store.setBand("a", spec("a"), 1);
    loads[0].resolve();
    await vi.advanceTimersByTimeAsync(0);
    store.uploadOne(false);
    expect(store.snapshot("a").small).not.toBeNull();
    store.setBand("a", spec("a"), 4);
    expect(store.snapshot("a").small).toBeNull();
    await vi.advanceTimersByTimeAsync(450);
    expect(loads[0].dispose).toHaveBeenCalled();
  });

  it("can be disposed and used again (development double-mounts effects)", async () => {
    const { store } = setup();
    store.setBand("a", spec("a"), 1);
    store.dispose();
    store.attach({ initTexture() {} } as unknown as WebGLRenderer, () => {}, () => true);
    store.setBand("a", spec("a"), 1);
    expect(loads).toHaveLength(2);
    loads[1].resolve();
    await settle();
    expect(store.uploadOne(false)).toBe(true);
    expect(store.snapshot("a").small).not.toBeNull();
  });

  it("decodes everything again after the GPU lost its textures", async () => {
    const { store } = setup();
    store.setBand("a", spec("a"), 1);
    loads[0].resolve();
    await settle();
    store.uploadOne(false);
    store.reloadAll();
    expect(store.snapshot("a").small).toBeNull();
    expect(loads.map((l) => l.url)).toEqual(["/a-t.webp", "/a-t.webp"]);
  });
});

describe("PhotoStore failures", () => {
  it("retries a transient failure with backoff at a smaller size, then succeeds", async () => {
    vi.useFakeTimers();
    const { store } = setup();
    store.setBand("a", spec("a", { thumbUrl: null }), 1);
    await vi.advanceTimersByTimeAsync(0);
    loads[0].reject(new PhotoLoadError("network error", false));
    await vi.advanceTimersByTimeAsync(0);
    expect(store.snapshot("a").failed).toBe(false);
    await vi.advanceTimersByTimeAsync(1600);
    expect(loads).toHaveLength(2);
    expect(loads[1].size).toBe(512);
    loads[1].resolve();
    await vi.advanceTimersByTimeAsync(0);
    store.uploadOne(false);
    expect(store.snapshot("a").small).not.toBeNull();
  });

  it("gives up after the attempts are used, shows the failure, and tries again when asked", async () => {
    vi.useFakeTimers();
    const { store } = setup();
    store.setBand("a", spec("a", { thumbUrl: null }), 1);
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      loads[i].reject(new PhotoLoadError("network error", false));
      await vi.advanceTimersByTimeAsync(5000);
    }
    expect(loads).toHaveLength(MAX_ATTEMPTS);
    expect(store.snapshot("a").failed).toBe(true);
    expect(store.hasRetryable).toBe(true);
    store.retryFailed();
    expect(store.snapshot("a").failed).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(loads).toHaveLength(MAX_ATTEMPTS + 1);
  });

  it("does not retry a file that does not exist", async () => {
    vi.useFakeTimers();
    const { store } = setup();
    store.setBand("a", spec("a", { thumbUrl: null }), 1);
    await vi.advanceTimersByTimeAsync(0);
    loads[0].reject(new PhotoLoadError("photo 404", true, 404));
    await vi.advanceTimersByTimeAsync(10000);
    expect(loads).toHaveLength(1);
    expect(store.snapshot("a").failed).toBe(true);
    expect(store.hasRetryable).toBe(false);
    store.retryFailed();
    expect(loads).toHaveLength(1);
  });

  it("retries a failed full-size upgrade a limited number of times without showing an error", async () => {
    vi.useFakeTimers();
    const { store } = setup();
    store.setBand("a", spec("a"), 0);
    loads[0].resolve();
    await vi.advanceTimersByTimeAsync(0);
    store.uploadOne(false);
    for (let i = 1; i <= MAX_ATTEMPTS; i += 1) {
      loads[i].reject(new PhotoLoadError("network error", false));
      await vi.advanceTimersByTimeAsync(5000);
    }
    expect(loads).toHaveLength(1 + MAX_ATTEMPTS);
    expect(store.snapshot("a").failed).toBe(false);
    expect(store.snapshot("a").small).not.toBeNull();
  });
});
