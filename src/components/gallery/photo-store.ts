import { DefaultLoadingManager, type Texture, type WebGLRenderer } from "three";
import { loadPhotoTexture, type LoadedPhoto } from "./photo-loader";

// Owns every photo texture of one scene. It decides what to load from how far an artwork is from
// the camera (its "band"), decodes off the main thread, and uploads to the GPU on its own schedule
// (one texture per frame, full-size ones only while the camera rests) so a glide never pays for it.

/** 0 = the artwork the camera rests on, 1 = its neighbours, 2 = inside the load radius, 3 = kept but not requested, 4 = far away. */
export type PhotoBand = 0 | 1 | 2 | 3 | 4;

export function bandOf(distance: number, loadRadius: number): PhotoBand {
  if (distance <= 0) return 0;
  if (distance <= 1) return 1;
  if (distance <= loadRadius) return 2;
  if (distance <= loadRadius + 2) return 3;
  return 4;
}

export type PhotoSpec = {
  url: string;
  /** Small copy of the photo; tried first and silently skipped when it does not exist. */
  thumbUrl: string | null;
  /** Longest side of the first (small) texture. */
  smallSize: number;
  /** Longest side of the full image. */
  fullSize: number;
  /** The camera can ask for the full image when it rests here. */
  upgrade: boolean;
  anisotropy: number;
  maxLoads: number;
};

export type PhotoView = { small: LoadedPhoto | null; full: LoadedPhoto | null; failed: boolean };

const EMPTY_VIEW: PhotoView = { small: null, full: null, failed: false };
const DISPOSE_DELAY_MS = 400;

type Stage = "idle" | "loading" | "queued" | "ready";

class Entry {
  constructor(readonly id: string) {}
  view: PhotoView = EMPTY_VIEW;
  small: Stage = "idle";
  full: Stage = "idle";
  smallAbort: AbortController | null = null;
  fullAbort: AbortController | null = null;
  blocking = false;
  blockedOnce = false;
  band: PhotoBand = 4;
  /** The latest spec, kept so work postponed while the camera glides can start later. */
  spec: PhotoSpec | null = null;
  deferred = false;
  readonly listeners = new Set<() => void>();
}

type Pending = { entry: Entry; kind: "small" | "full"; photo: LoadedPhoto };

function deferDispose(texture: Texture) {
  // The material may still reference the texture for a frame; free the GPU copy a little later.
  setTimeout(() => texture.dispose(), DISPOSE_DELAY_MS);
}

export class PhotoStore {
  private readonly entries = new Map<string, Entry>();
  private readonly queue: Pending[] = [];
  private gl: WebGLRenderer | null = null;
  private wake: () => void = () => {};
  private resting: () => boolean = () => true;
  private deferredCount = 0;

  /** `deferUpload` false (photo exports) marks textures ready as soon as they are decoded. */
  constructor(private readonly deferUpload: boolean) {}

  attach(gl: WebGLRenderer, wake: () => void, resting: () => boolean) {
    this.gl = gl;
    this.wake = wake;
    this.resting = resting;
    if (this.queue.length > 0) wake();
  }

  detach() {
    this.gl = null;
    this.wake = () => {};
    this.resting = () => true;
  }

  /** Entries whose loading waits for the camera to rest. */
  get waiting(): number {
    return this.deferredCount;
  }

  /**
   * Starts the loads that were postponed while the camera glided. Decoding a large photo to its target size
   * finishes with a short main-thread step; starting it only at rest keeps that step out of the glides.
   */
  startDeferred() {
    if (this.deferredCount === 0) return;
    for (const entry of this.entries.values()) {
      if (!entry.deferred || !entry.spec) continue;
      entry.deferred = false;
      this.deferredCount -= 1;
      this.setBand(entry.id, entry.spec, entry.band);
    }
  }

  private defer(entry: Entry) {
    if (entry.deferred) return;
    entry.deferred = true;
    this.deferredCount += 1;
  }

  get pending(): number {
    return this.queue.length;
  }

  private entry(id: string): Entry {
    let entry = this.entries.get(id);
    if (!entry) {
      entry = new Entry(id);
      this.entries.set(id, entry);
    }
    return entry;
  }

  subscribe = (id: string, listener: () => void): (() => void) => {
    const entry = this.entry(id);
    entry.listeners.add(listener);
    return () => entry.listeners.delete(listener);
  };

  snapshot = (id: string): PhotoView => this.entries.get(id)?.view ?? EMPTY_VIEW;

  private publish(entry: Entry, view: PhotoView) {
    entry.view = view;
    entry.listeners.forEach((listener) => listener());
    this.wake();
  }

  private endBlocking(id: string, entry: Entry) {
    if (!entry.blocking) return;
    entry.blocking = false;
    DefaultLoadingManager.itemEnd(`photo:${id}`);
  }

  /** The artwork moved to another band: start what is now needed, drop what no longer is. */
  setBand(id: string, spec: PhotoSpec, band: PhotoBand) {
    const entry = this.entry(id);
    entry.band = band;
    entry.spec = spec;
    const resting = this.resting();

    if (band === 4) {
      this.release(id, entry, true);
      return;
    }
    // The artwork in front of the camera and its neighbours load at once; prefetching and the full-size upgrade
    // wait until the camera rests.
    if (band <= 2 && entry.small === "idle" && !entry.view.failed) {
      if (band <= 1 || resting) this.loadSmall(id, entry, spec, band);
      else this.defer(entry);
    }

    const wantFull = band === 0 && spec.upgrade;
    if (wantFull && entry.full === "idle" && entry.small !== "idle") {
      if (resting) this.loadFull(entry, spec);
      else this.defer(entry);
    }
    // A full image is only worth its GPU memory for the artwork in front of the camera and its neighbours.
    if (band >= 2 && entry.full !== "idle") this.dropFull(entry);
  }

  private loadSmall(id: string, entry: Entry, spec: PhotoSpec, band: PhotoBand) {
    entry.small = "loading";
    const controller = new AbortController();
    entry.smallAbort = controller;
    if (band <= 1 && !entry.blockedOnce) {
      entry.blockedOnce = true;
      entry.blocking = true;
      DefaultLoadingManager.itemStart(`photo:${id}`);
    }
    const priority = band;
    const first = spec.thumbUrl ? loadPhotoTexture(spec.thumbUrl, spec.smallSize, spec.anisotropy, spec.maxLoads, controller.signal, priority) : Promise.reject(new Error("no thumbnail"));
    first
      .catch((error) => {
        if (controller.signal.aborted) throw error;
        return loadPhotoTexture(spec.url, spec.smallSize, spec.anisotropy, spec.maxLoads, controller.signal, priority);
      })
      .then((photo) => this.decoded(entry, "small", photo, controller))
      .catch(() => {
        if (controller.signal.aborted) return;
        entry.small = "idle";
        this.endBlocking(id, entry);
        this.publish(entry, { ...entry.view, failed: true });
      });
  }

  private loadFull(entry: Entry, spec: PhotoSpec) {
    entry.full = "loading";
    const controller = new AbortController();
    entry.fullAbort = controller;
    loadPhotoTexture(spec.url, spec.fullSize, spec.anisotropy, spec.maxLoads, controller.signal, 0)
      .then((photo) => this.decoded(entry, "full", photo, controller))
      .catch(() => {
        if (!controller.signal.aborted) entry.full = "idle";
      });
  }

  private decoded(entry: Entry, kind: "small" | "full", photo: LoadedPhoto, controller: AbortController) {
    if (controller.signal.aborted) {
      photo.texture.dispose();
      return;
    }
    if (kind === "small") entry.small = "queued";
    else entry.full = "queued";
    if (this.deferUpload && this.gl) {
      this.queue.push({ entry, kind, photo });
      this.wake();
    } else {
      this.uploaded(entry, kind, photo);
    }
  }

  private uploaded(entry: Entry, kind: "small" | "full", photo: LoadedPhoto) {
    if (kind === "small") {
      entry.small = "ready";
      this.endBlocking(entry.id, entry);
      this.publish(entry, { ...entry.view, small: photo, failed: false });
    } else {
      entry.full = "ready";
      const previous = entry.view.full;
      this.publish(entry, { ...entry.view, full: photo });
      if (previous) deferDispose(previous.texture);
    }
  }

  private dropFull(entry: Entry) {
    entry.fullAbort?.abort();
    entry.fullAbort = null;
    const previous = entry.view.full;
    entry.full = "idle";
    this.removeQueued(entry, "full");
    if (previous) {
      this.publish(entry, { ...entry.view, full: null });
      deferDispose(previous.texture);
    }
  }

  private removeQueued(entry: Entry, kind: "small" | "full") {
    for (let i = this.queue.length - 1; i >= 0; i -= 1) {
      if (this.queue[i].entry === entry && this.queue[i].kind === kind) {
        this.queue[i].photo.texture.dispose();
        this.queue.splice(i, 1);
      }
    }
  }

  private release(id: string, entry: Entry, keepEntry: boolean) {
    if (entry.deferred) {
      entry.deferred = false;
      this.deferredCount -= 1;
    }
    entry.smallAbort?.abort();
    entry.fullAbort?.abort();
    entry.smallAbort = null;
    entry.fullAbort = null;
    this.endBlocking(id, entry);
    this.removeQueued(entry, "small");
    this.removeQueued(entry, "full");
    const { small, full } = entry.view;
    entry.small = "idle";
    entry.full = "idle";
    if (small || full) {
      this.publish(entry, EMPTY_VIEW);
      if (small) deferDispose(small.texture);
      if (full) deferDispose(full.texture);
    } else if (entry.view.failed) {
      entry.view = EMPTY_VIEW;
    }
    if (!keepEntry) this.entries.delete(id);
  }

  /**
   * Uploads at most one decoded texture to the GPU (`initTexture` also builds the mipmaps). A glide never pays
   * for it: while the camera moves only the artwork it is heading for may upload (a grey placeholder would be
   * worse than a short stall); everything else waits for the camera to rest.
   */
  uploadOne(moving: boolean): boolean {
    const gl = this.gl;
    if (!gl || this.queue.length === 0) return false;
    let index: number;
    if (moving) {
      index = this.queue.findIndex((item) => item.kind === "small" && item.entry.band === 0);
    } else {
      index = this.queue.findIndex((item) => item.kind === "small");
      if (index < 0) index = 0;
    }
    if (index < 0) return false;
    const [item] = this.queue.splice(index, 1);
    try {
      gl.initTexture(item.photo.texture);
    } catch {
      // The texture is still usable: three uploads it on first use.
    }
    this.uploaded(item.entry, item.kind, item.photo);
    return true;
  }

  /** Frees everything. The store stays usable afterwards (development double-mounts effects). */
  dispose() {
    for (const [id, entry] of this.entries) {
      this.release(id, entry, true);
      entry.listeners.clear();
    }
    this.entries.clear();
    this.queue.length = 0;
    this.detach();
  }
}
