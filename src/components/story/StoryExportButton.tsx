"use client";

import { ImageDown } from "lucide-react";
import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import type { StoryDialogProps } from "./StoryExportDialog";

// The dialog (canvas renderer included) is only downloaded when somebody opens it.
const StoryExportDialog = dynamic(() => import("./StoryExportDialog"), { ssr: false });

type Props = Omit<StoryDialogProps, "onClose"> & {
  className?: string;
  children?: ReactNode;
  /** Accessible name when the button shows only an icon. */
  ariaLabel?: string;
};

export function StoryExportButton({ className, children, ariaLabel, ...dialog }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" aria-label={ariaLabel} onClick={() => setOpen(true)}>
        <ImageDown aria-hidden className="size-5" />
        {children}
      </button>
      {open ? <StoryExportDialog {...dialog} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
