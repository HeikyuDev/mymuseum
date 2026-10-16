import type { PhotoFormat } from "./formats";

// Pure photographic composition: where the "photographer" stands and how the
// lens is shifted so the artwork sits in the middle of the safe area while the
// camera stays level (no converging verticals), like an architectural photo.

export const PHOTO_FOV = 38; // vertical field of view (degrees)
export const PHOTO_CAMERA_Y = 1.5; // eye height of the photographer (m)
const MIN_DISTANCE = 2.4;
const MAX_DISTANCE = 12;

export type PhotoSubject = {
  /** Width of the subject block on the wall (frame, m). */
  width: number;
  /** Height of the subject block, including the placard below the frame (m). */
  height: number;
  /** Wall height of the point that must sit in the middle of the safe area (m). */
  focusY: number;
};

export type PhotoComposition = {
  fov: number;
  /** Distance from the wall (m). */
  distance: number;
  cameraY: number;
  /** Pixels of the 1x image per meter of wall at the subject. */
  pixelsPerMeter: number;
  /** Lens shift in NDC units (positive moves the picture up). */
  ndcShiftY: number;
  /** Centre of the safe area in 1x pixels. */
  focusRow: number;
};

export function composePhoto(format: PhotoFormat, subject: PhotoSubject): PhotoComposition {
  const { width, height, safe } = format;
  const rectW = width - 2 * safe.side;
  const rectH = height - safe.top - safe.bottom;
  const pixelsPerMeter = Math.min((rectW * 0.9) / subject.width, (rectH * 0.76) / subject.height);
  const tanHalf = Math.tan((PHOTO_FOV * Math.PI) / 360);
  const rawDistance = height / (2 * pixelsPerMeter * tanHalf);
  const distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, rawDistance));
  // If the distance was clamped, the real scale differs from the plan.
  const scale = height / (2 * distance * tanHalf);
  let focusRow = safe.top + rectH / 2;
  // Keep a strip of the real floor in frame: nudge the subject up when the
  // wall base would fall out of the picture, but never above the safe area.
  const floorRowAt = (row: number) => row + subject.focusY * scale;
  const wantedFloorRow = height - Math.max(safe.bottom * 0.35, height * 0.07);
  const topSlack = focusRow - subject.height * scale * 0.5 - safe.top;
  const lift = Math.min(Math.max(0, floorRowAt(focusRow) - wantedFloorRow), Math.max(0, topSlack));
  focusRow -= lift;
  const ndcShiftY = -(focusRow - height / 2 + (subject.focusY - PHOTO_CAMERA_Y) * scale) / (height / 2);
  return { fov: PHOTO_FOV, distance, cameraY: PHOTO_CAMERA_Y, pixelsPerMeter: scale, ndcShiftY, focusRow };
}

/** Image row (0 = top) where a wall point at height `y` lands for a composition. */
export function rowOfWallHeight(format: PhotoFormat, composition: PhotoComposition, y: number): number {
  return format.height / 2 - (y - composition.cameraY) * composition.pixelsPerMeter - (composition.ndcShiftY * format.height) / 2;
}
