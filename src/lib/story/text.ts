// Pure text helpers. `Measure` returns the rendered width of a string at a
// given font; the canvas supplies the real one, tests supply a mock.

export type Measure = (text: string) => number;

export type Wrapped = { lines: string[]; truncated: boolean };

const ELLIPSIS = "…";

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Shortens `text` with an ellipsis until it fits `maxWidth`. */
export function ellipsize(text: string, maxWidth: number, measure: Measure): string {
  if (measure(text) <= maxWidth) return text;
  let end = text.length;
  while (end > 0 && measure(`${text.slice(0, end).trimEnd()}${ELLIPSIS}`) > maxWidth) end -= 1;
  return end > 0 ? `${text.slice(0, end).trimEnd()}${ELLIPSIS}` : ELLIPSIS;
}

/** Splits a word that is wider than the line into pieces that fit. */
function breakWord(word: string, maxWidth: number, measure: Measure): string[] {
  const pieces: string[] = [];
  let current = "";
  for (const char of Array.from(word)) {
    if (current && measure(current + char) > maxWidth) {
      pieces.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

/** Greedy word wrap with a hard line limit; the last line is ellipsized on overflow. */
export function wrapLines(text: string, maxWidth: number, measure: Measure, maxLines: number): Wrapped {
  const clean = normalizeText(text);
  if (!clean || maxLines < 1) return { lines: [], truncated: clean.length > 0 };

  const words = clean.split(" ").flatMap((word) => (measure(word) > maxWidth ? breakWord(word, maxWidth, measure) : [word]));
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || measure(candidate) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  if (lines.length <= maxLines) return { lines, truncated: false };
  const kept = lines.slice(0, maxLines);
  const overflow = lines.slice(maxLines - 1).join(" ");
  kept[maxLines - 1] = ellipsize(overflow, maxWidth, measure);
  return { lines: kept, truncated: true };
}

export type FitResult = Wrapped & { size: number };

/**
 * Largest font size in [minSize, maxSize] at which the whole text fits in
 * `maxLines`. At `minSize` the text is truncated instead of overflowing.
 */
export function fitText(input: {
  text: string;
  maxWidth: number;
  maxLines: number;
  minSize: number;
  maxSize: number;
  step?: number;
  measureAt: (size: number) => Measure;
}): FitResult {
  const { text, maxWidth, maxLines, minSize, maxSize, step = 2, measureAt } = input;
  for (let size = maxSize; size > minSize; size -= step) {
    const wrapped = wrapLines(text, maxWidth, measureAt(size), maxLines);
    if (!wrapped.truncated) return { ...wrapped, size };
  }
  return { ...wrapLines(text, maxWidth, measureAt(minSize), maxLines), size: minSize };
}

/** Width of text drawn with extra tracking between characters. */
export function trackedWidth(text: string, tracking: number, measure: Measure): number {
  const chars = Array.from(text);
  if (chars.length === 0) return 0;
  return chars.reduce((sum, char) => sum + measure(char), 0) + tracking * (chars.length - 1);
}
