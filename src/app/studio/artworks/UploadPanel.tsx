"use client";

import { AlertCircle, CheckCircle2, ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { createArtworks } from "@/app/studio/actions/artworks";
import { cardClass, Spinner } from "@/components/ui/panel";
import { ACCEPTED_IMAGE_TYPES, titleFromFileName } from "@/lib/images";
import { prepareImage } from "@/lib/images-client";
import { removeFromArtworks, uploadToArtworks } from "@/lib/storage-upload";

type Status = "queued" | "processing" | "uploading" | "saving" | "done" | "error";
type Item = { key: string; name: string; status: Status; progress: number; error?: string };

const CONCURRENCY = 3;

type Props = {
  museumId: string;
  halls: { id: string; name: string }[];
  hallId: string | null;
  onHallChange: (hallId: string | null) => void;
  onFinished: () => void;
};

export function UploadPanel({ museumId, halls, hallId, onHallChange, onFinished }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const update = (key: string, patch: Partial<Item>) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  async function processFile(key: string, file: File, targetHall: string | null): Promise<boolean> {
    let uploadedPath: string | null = null;
    try {
      update(key, { status: "processing" });
      const prepared = await prepareImage(file);
      const id = crypto.randomUUID();
      const path = `${museumId}/${id}.${prepared.extension}`;

      update(key, { status: "uploading", progress: 0 });
      await uploadToArtworks(path, prepared.blob, prepared.contentType, (progress) => update(key, { progress }));
      uploadedPath = path;

      update(key, { status: "saving" });
      const result = await createArtworks([
        {
          id,
          image_path: path,
          title: titleFromFileName(file.name),
          hall_id: targetHall,
          width_px: prepared.width,
          height_px: prepared.height,
          aspect_ratio: prepared.aspectRatio,
        },
      ]);
      if (!result.ok) throw new Error(result.error);
      update(key, { status: "done", progress: 1 });
      return true;
    } catch (error) {
      // The row was not created: do not leave an orphan file in Storage.
      if (uploadedPath) await removeFromArtworks([uploadedPath]);
      update(key, { status: "error", error: error instanceof Error ? error.message : "Upload failed." });
      return false;
    }
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0 || busy) return;
    const batch = files.map((file) => ({ key: crypto.randomUUID(), file }));
    setItems(batch.map(({ key, file }) => ({ key, name: file.name, status: "queued", progress: 0 })));
    setBusy(true);

    let cursor = 0;
    let succeeded = 0;
    const worker = async () => {
      while (cursor < batch.length) {
        const current = batch[cursor++];
        if (await processFile(current.key, current.file, hallId)) succeeded += 1;
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batch.length) }, worker));

    setBusy(false);
    if (succeeded > 0) toast.success(`${succeeded} ${succeeded === 1 ? "artwork" : "artworks"} uploaded`);
    if (succeeded < batch.length) toast.error(`${batch.length - succeeded} could not be uploaded`);
    if (inputRef.current) inputRef.current.value = "";
    onFinished();
  }

  return (
    <section className={`${cardClass} p-4 sm:p-5`} aria-labelledby="upload-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 id="upload-heading" className="font-display text-lg font-semibold">
          Upload artworks
        </h2>
        <div className="flex items-center gap-2">
          <label htmlFor="upload-hall" className="text-sm text-muted">
            Place in
          </label>
          <select
            id="upload-hall"
            value={hallId ?? ""}
            onChange={(event) => onHallChange(event.target.value || null)}
            disabled={busy}
            className="min-h-10 rounded-theme border border-line bg-raised px-2 text-sm"
          >
            <option value="">Unassigned</option>
            {halls.map((hall) => (
              <option key={hall.id} value={hall.id}>
                {hall.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
        className={`flex flex-col items-center gap-2 rounded-theme border-2 border-dashed px-4 py-8 text-center transition ${
          dragging ? "border-accent bg-surface" : "border-line"
        }`}
      >
        <ImagePlus aria-hidden className="size-8 text-muted" />
        <p className="text-sm text-muted">Drag images here, or</p>
        <input
          ref={inputRef}
          id="upload-input"
          type="file"
          multiple
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          disabled={busy}
          onChange={(event) => event.target.files && void handleFiles(event.target.files)}
          className="sr-only peer"
        />
        <label
          htmlFor="upload-input"
          className="inline-flex min-h-11 cursor-pointer items-center rounded-theme bg-accent px-4 text-sm font-semibold text-on-accent peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:opacity-50"
        >
          Choose files
        </label>
        <p className="text-xs text-muted">JPEG, PNG, WebP or AVIF, up to 10 MB each. Large images are resized to 2400 px.</p>
      </div>

      {items.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2" aria-live="polite">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              {item.status === "error" ? (
                <span className="flex items-center gap-1.5 text-red-700">
                  <AlertCircle aria-hidden className="size-4" />
                  {item.error}
                </span>
              ) : item.status === "done" ? (
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 aria-hidden className="size-4" />
                  Done
                </span>
              ) : (
                <span className="flex w-40 items-center gap-2">
                  <progress
                    value={item.status === "uploading" ? item.progress : item.status === "saving" ? 1 : 0}
                    max={1}
                    aria-label={`Upload progress for ${item.name}`}
                    className="h-2 flex-1 overflow-hidden rounded-full [&::-moz-progress-bar]:bg-accent [&::-webkit-progress-bar]:bg-surface [&::-webkit-progress-value]:bg-accent"
                  />
                  {item.status === "queued" ? null : <Spinner className="size-3.5" />}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
