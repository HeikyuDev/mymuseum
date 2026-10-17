// Which supersampling factors a device can actually render an export at.

const LADDER = [1.5, 1.25, 1];

/**
 * Supersampling factors to try, largest first, keeping only those whose render size fits the GPU limit
 * (`maxSide`, the smallest of its texture, renderbuffer and viewport limits). Empty when even 1x does not fit.
 */
export function supersampleLadder(requested: number, width: number, height: number, outputScale: number, maxSide: number): number[] {
  const longest = Math.max(width, height) * outputScale;
  return [requested, ...LADDER]
    .filter((value, index, all) => value <= requested && all.indexOf(value) === index)
    .filter((value) => Math.round(longest * value) <= maxSide);
}
