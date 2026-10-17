import { DefaultLoadingManager, type Texture, type WebGLRenderer } from "three";
import { isAbort, isPermanentPhotoError, loadPhotoTexture, type LoadedPhoto } from "./photo-loader";

// Owns every photo texture of one scene. It decides what to load from how far an artwork is from
// the camera (its "band"), decodes off the main thread, and uploads to the GPU on its own schedule
// (one texture per frame, full-size ones only while the camera rests) so a glide never pays for it.
// Failed loads are retried a few times with backoff, again when the browser comes back online and when
// the camera rests on the artwork; a file that does not exist is never retried.

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
/** Attempts per photo before giving up until the browser is back online or the camera rests on it again. */
export const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1500, 4000];
const FULL_TIMEOUT_MS = 45000;
const MIN_RETRY_SIZE = 256;

/** Longest side to request on attempt `attempt` (0-based): halved after a failure, in case memory was the problem. */
export function sizeForAttempt(size: number, attempt: number): number {
  return attempt <= 0 ? size : Math.max(MIN_RETRY_SIZE, Math.round(size / 2 ** Math.min(attempt, 2)));
}

export const specKey = (spec: PhotoSpec) => `${spec.url}|${spec.thumbUrl ?? ""}|${spec.smallSize}|${spec.fullSize}|${spec.upgrade}|${spec.anisotropy}`;

type Stage = "idle" | "loading" | "waiting" | "queued" | "ready";

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
  specKey = "";
  deferred = false;
  smallAttempts = 0;
  fullAttempts = 0;
  /** The file does not exist: retrying cannot help. */
  smallDead = false;
  fullGaveUp = false;
  smallTimer: ReturnType<typeof setTimeout> | null = null;
  fullTimer: ReturnType<typeof setTimeout> | null = null;
  readonly listeners = new Set<() => void>();
}

type Pending = { entry: Entry; kind: "small" | "full"; photo: LoadedPhoto };

/** Frees a texture that never reached the GPU: its bitmap is closed too (dispose alone leaves it allocated). */
function discard(photo: LoadedPhoto) {
  (photo.texture.image as { close?: () => void } | null)?.close?.();
  photo.texture.dispose();
}

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

  get pending(): number {
    return this.queue.length;
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

  private endBlocking(entry: Entry) {
    if (!entry.blocking) return;
    entry.blocking = false;
    DefaultLoadingManager.itemEnd(`photo:${entry.id}`);
  }

  /** The artwork moved to another band (or its photo changed): start what is now needed, drop what no longer is. */
  setBand(id: string, spec: PhotoSpec, band: PhotoBand) {
    const entry = this.entry(id);
    const key = specKey(spec);
    // The photo behind this artwork changed (a replaced image in the studio preview, another tier): start over.
    if (entry.specKey && entry.specKey !== key) this.release(entry, true);
    entry.specKey = key;
    entry.band = band;
    entry.spec = spec;
    const resting = this.resting();

    if (band === 4) {
      this.release(entry, true);
      return;
    }
    // The artwork in front of the camera and its neighbours load at once; prefetching and the full-size upgrade
    // wait until the camera rests.
    if (band <= 2 && entry.small === "idle" && !entry.smallDead && !entry.view.failed) {
      if (band <= 1 || resting) this.loadSmall(entry, spec, band);
      else this.defer(entry);
    }
    this.maybeLoadFull(entry, resting);
    // A full image is only worth its GPU memory for the artwork in front of the camera and its neighbours.
    if (band >= 2 && entry.full !== "idle") this.dropFull(entry);
  }

  /** The full image comes after the small one is on screen (never both at once), and only when it is any bigger. */
  private maybeLoadFull(entry: Entry, resting = this.resting()) {
    const spec = entry.spec;
    if (!spec || entry.band !== 0 || !spec.upgrade || entry.full !== "idle" || entry.fullGaveUp) return;
    if (!spec.thumbUrl && spec.smallSize >= spec.fullSize) return;
    if (entry.small !== "ready") return;
    if (resting) this.loadFull(entry, spec);
    else this.defer(entry);
  }

  private loadSmall(entry: Entry, spec: PhotoSpec, band: PhotoBand) {
    entry.small = "loading";
    const controller = new AbortController();
    entry.smallAbort = controller;
    if (band <= 1 && !entry.blockedOnce) {
      entry.blockedOnce = true;
      entry.blocking = true;
      DefaultLoadingManager.itemStart(`photo:${entry.id}`);
    }
    const size = sizeForAttempt(spec.smallSize, entry.smallAttempts);
    const priority = band;
    const first = spec.thumbUrl ? loadPhotoTexture(spec.thumbUrl, size, spec.anisotropy, spec.maxLoads, controller.signal, priority) : Promise.reject(new Error("no thumbnail"));
    first
      .catch((error) => {
        if (controller.signal.aborted) throw error;
        return loadPhotoTexture(spec.url, size, spec.anisotropy, spec.maxLoads, controller.signal, priority);
      })
      .then((photo) => this.decoded(entry, "small", photo, controller))
      .catch((error) => {
        if (controller.signal.aborted || isAbort(error)) return;
        this.failed(entry, "small", error);
      });
  }

  private loadFull(entry: Entry, spec: PhotoSpec) {
    entry.full = "loading";
    const controller = new AbortController();
    entry.fullAbort = controller;
    const size = sizeForAttempt(spec.fullSize, entry.fullAttempts);
    loadPhotoTexture(spec.url, size, spec.anisotropy, spec.maxLoads, controller.signal, 0, FULL_TIMEOUT_MS)
      .then((photo) => this.decoded(entry, "full", photo, controller))
      .catch((error) => {
        if (controller.signal.aborted || isAbort(error)) return;
        this.failed(entry, "full", error);
      });
  }

  /** A load failed: retry with backoff, or give up (visibly, for the small image) after MAX_ATTEMPTS or a missing file. */
  private failed(entry: Entry, kind: "small" | "full", error: unknown) {
    const permanent = isPermanentPhotoError(error);
    const attempts = kind === "small" ? ++entry.smallAttempts : ++entry.fullAttempts;
    if (permanent || attempts >= MAX_ATTEMPTS) {
      if (kind === "small") {
        entry.small = "idle";
        entry.smallDead = permanent;
        this.endBlocking(entry);
        this.publish(entry, { ...entry.view, failed: true });
      } else {
        entry.full = "idle";
        entry.fullGaveUp = true;
      }
      return;
    }
    const delay = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
    const timer = setTimeout(() => {
      if (kind === "small") entry.smallTimer = null;
      else entry.fullTimer = null;
      if (kind === "small") entry.small = "idle";
      else entry.full = "idle";
      if (entry.spec) this.setBand(entry.id, entry.spec, entry.band);
    }, delay);
    if (kind === "small") {
      entry.small = "waiting";
      entry.smallTimer = timer;
    } else {
      entry.full = "waiting";
      entry.fullTimer = timer;
    }
  }

  /**
   * Gives up-to-date failures another go: called when the browser comes back online and when the camera rests on
   * an artwork whose photo failed. Files that do not exist are left alone.
   */
  retryFailed() {
    for (const entry of this.entries.values()) {
      if (!entry.spec || entry.band > 2) continue;
      const smallFailed = entry.view.failed && !entry.smallDead;
      if (!smallFailed && !entry.fullGaveUp) continue;
      if (smallFailed) {
        entry.smallAttempts = 0;
        this.publish(entry, { ...entry.view, failed: false });
      }
      entry.fullAttempts = 0;
      entry.fullGaveUp = false;
      this.setBand(entry.id, entry.spec, entry.band);
    }
  }

  /** True when an artwork the camera is on or next to has a failed photo that can still be retried. */
  get hasRetryable(): boolean {
    for (const entry of this.entries.values()) {
      if (entry.band <= 1 && ((entry.view.failed && !entry.smallDead) || entry.fullGaveUp)) return true;
    }
    return false;
  }

  private decoded(entry: Entry, kind: "small" | "full", photo: LoadedPhoto, controller: AbortController) {
    if (controller.signal.aborted) {
      discard(photo);
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
      entry.smallAttempts = 0;
      this.endBlocking(entry);
      this.publish(entry, { ...entry.view, small: photo, failed: false });
      this.maybeLoadFull(entry);
    } else {
      entry.full = "ready";
      const previous = entry.view.full;
      this.publish(entry, { ...entry.view, full: photo });
      if (previous) deferDispose(previous.texture);
    }
  }

  private clearTimers(entry: Entry) {
    if (entry.smallTimer) clearTimeout(entry.smallTimer);
    if (entry.fullTimer) clearTimeout(entry.fullTimer);
    entry.smallTimer = null;
    entry.fullTimer = null;
  }

  private dropFull(entry: Entry) {
    entry.fullAbort?.abort();
    entry.fullAbort = null;
    if (entry.fullTimer) clearTimeout(entry.fullTimer);
    entry.fullTimer = null;
    const previous = entry.view.full;
    entry.full = "idle";
    entry.fullAttempts = 0;
    entry.fullGaveUp = false;
    this.removeQueued(entry, "full");
    if (previous) {
      this.publish(entry, { ...entry.view, full: null });
      deferDispose(previous.texture);
    }
  }

  private removeQueued(entry: Entry, kind: "small" | "full") {
    for (let i = this.queue.length - 1; i >= 0; i -= 1) {
      if (this.queue[i].entry === entry && this.queue[i].kind === kind) {
        discard(this.queue[i].photo);
        this.queue.splice(i, 1);
      }
    }
  }

  private release(entry: Entry, keepEntry: boolean) {
    if (entry.deferred) {
      entry.deferred = false;
      this.deferredCount -= 1;
    }
    entry.smallAbort?.abort();
    entry.fullAbort?.abort();
    entry.smallAbort = null;
    entry.fullAbort = null;
    this.clearTimers(entry);
    this.endBlocking(entry);
    this.removeQueued(entry, "small");
    this.removeQueued(entry, "full");
    const { small, full } = entry.view;
    entry.small = "idle";
    entry.full = "idle";
    entry.smallAttempts = 0;
    entry.fullAttempts = 0;
    entry.smallDead = false;
    entry.fullGaveUp = false;
    if (small || full || entry.view.failed) {
      this.publish(entry, EMPTY_VIEW);
      if (small) deferDispose(small.texture);
      if (full) deferDispose(full.texture);
    }
    if (!keepEntry) this.entries.delete(entry.id);
  }

  /**
   * The GPU lost its copy of every texture (a lost WebGL context). Photo textures cannot re-upload from their
   * bitmap, which is closed after the first upload, so everything is released and decoded again.
   */
  reloadAll() {
    const todo: { entry: Entry; spec: PhotoSpec; band: PhotoBand }[] = [];
    for (const entry of this.entries.values()) {
      if (entry.spec && entry.band < 4) todo.push({ entry, spec: entry.spec, band: entry.band });
      this.release(entry, true);
    }
    for (const { entry, spec, band } of todo) this.setBand(entry.id, spec, band);
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
    for (const entry of this.entries.values()) {
      this.release(entry, true);
      entry.listeners.clear();
    }
    this.entries.clear();
    for (const item of this.queue) discard(item.photo);
    this.queue.length = 0;
    this.detach();
  }
}
