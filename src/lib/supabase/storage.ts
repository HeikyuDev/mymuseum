export const ARTWORKS_BUCKET = "artworks";

/** Builds the public URL of an object in the `artworks` bucket. */
export function getArtworkPublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${ARTWORKS_BUCKET}/${encoded}`;
}
