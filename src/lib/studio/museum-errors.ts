// Tells apart the two unique constraints that can fail when a museum is created
// or renamed, so the user gets the right message.
//
//   museums_slug_key       -> the public address is taken
//   museums_owner_id_key   -> this account already has its one museum
//                             (for example two browser tabs finishing onboarding)

export type UniqueViolationTarget = "owner" | "slug" | "other";

type ErrorLike = { code?: string | null; message?: string | null; details?: string | null };

export function uniqueViolationTarget(error: ErrorLike | null | undefined): UniqueViolationTarget | null {
  if (!error || error.code !== "23505") return null;
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  if (text.includes("owner_id")) return "owner";
  if (text.includes("slug")) return "slug";
  return "other";
}
