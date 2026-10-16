// Allocation-free helpers for the spotlight pool and for hiding far-away parts of the scene.

/**
 * Writes into `out` the indices (into `xs`, which must be sorted ascending) of the up to
 * `out.length` values nearest to `cx`, and returns how many were written. No allocations.
 */
export function nearestIndices(xs: ArrayLike<number>, cx: number, out: Int32Array): number {
  const n = xs.length;
  const k = Math.min(out.length, n);
  if (k === 0) return 0;
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < cx) lo = mid + 1;
    else hi = mid;
  }
  let left = lo - 1;
  let right = lo;
  for (let count = 0; count < k; count += 1) {
    const takeLeft = left >= 0 && (right >= n || cx - xs[left] <= xs[right] - cx);
    out[count] = takeLeft ? left-- : right++;
  }
  return k;
}

/** True when the range [start, end] lies farther than `distance` from `cx`. */
export function isFarFrom(cx: number, start: number, end: number, distance: number): boolean {
  return cx < start - distance || cx > end + distance;
}
