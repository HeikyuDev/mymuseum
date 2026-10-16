// Temporary password helpers for the super-admin area. Pure and isomorphic: the
// generator runs in the browser ("Generate" button) and on the server (reset).
// Passwords are never logged or persisted by the app.

const LOWER = "abcdefghijkmnopqrstuvwxyz"; // no "l"
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no "I", "O"
const DIGITS = "23456789"; // no "0", "1"
const SYMBOLS = "!@#$%&*-_+=?";
const ALPHABET = LOWER + UPPER + DIGITS + SYMBOLS;

export const PASSWORD_MIN_LENGTH = 12;
// bcrypt (used by Supabase Auth) only considers the first 72 bytes.
export const PASSWORD_MAX_LENGTH = 72;
export const GENERATED_PASSWORD_LENGTH = 16;

type RandomFill = (array: Uint32Array) => Uint32Array;

const defaultFill: RandomFill = (array) => globalThis.crypto.getRandomValues(array);

/** Uniform integer in [0, max) using rejection sampling (no modulo bias). */
function randomInt(max: number, fill: RandomFill): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);
  for (;;) {
    const [value] = fill(buffer);
    if (value < limit) return value % max;
  }
}

/** Generates a strong temporary password with at least one char of every class. */
export function generateTempPassword(length = GENERATED_PASSWORD_LENGTH, fill: RandomFill = defaultFill): string {
  const size = Math.min(Math.max(length, PASSWORD_MIN_LENGTH), PASSWORD_MAX_LENGTH);
  const pick = (set: string) => set[randomInt(set.length, fill)];

  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < size) chars.push(pick(ALPHABET));

  // Fisher-Yates shuffle so the guaranteed characters are not always first.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1, fill);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: "Too weak" | "Weak" | "Fair" | "Good" | "Strong" };

const LABELS: PasswordStrength["label"][] = ["Too weak", "Weak", "Fair", "Good", "Strong"];

/** Rough strength estimate used for the form hint (length + character variety). */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN_LENGTH) return { score: password.length >= 8 ? 1 : 0, label: password.length >= 8 ? "Weak" : "Too weak" };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  let score = classes - 1 + (password.length >= 16 ? 1 : 0);
  score = Math.max(1, Math.min(4, score));
  return { score: score as PasswordStrength["score"], label: LABELS[score] };
}

/** Returns a human readable problem, or null when the password is acceptable. */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return "Include lowercase and uppercase letters and a number.";
  }
  return null;
}
