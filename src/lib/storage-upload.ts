"use client";

import { createClient } from "@/lib/supabase/client";
import { ARTWORKS_BUCKET } from "@/lib/supabase/storage";

/**
 * Uploads a blob to the `artworks` bucket straight from the browser with the
 * signed-in user's token (Storage RLS limits writes to `{museum_id}/...`).
 * Uses XHR for real upload progress and falls back to the SDK when no session
 * token is available. Rejects with a user facing Error.
 */
export async function uploadToArtworks(
  path: string,
  blob: Blob,
  contentType: string,
  onProgress: (fraction: number) => void,
): Promise<void> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Please sign in again.");

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}/storage/v1/object/${ARTWORKS_BUCKET}/${encodedPath}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("Cache-Control", "max-age=31536000");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onerror = () => reject(new Error("Network error while uploading."));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else if (xhr.status === 401 || xhr.status === 403) reject(new Error("You are not allowed to upload this file."));
      else if (xhr.status === 413) reject(new Error("This image is too large."));
      else reject(new Error("The upload failed. Please try again."));
    };
    xhr.send(blob);
  });
  onProgress(1);
}

/** Best-effort removal of uploaded files (used to undo a failed database insert). */
export async function removeFromArtworks(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await createClient().storage.from(ARTWORKS_BUCKET).remove(paths);
  if (error) console.error("Could not clean up uploaded files", error.message);
}
