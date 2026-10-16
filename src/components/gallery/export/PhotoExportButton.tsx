"use client";

import { ImageDown } from "lucide-react";
import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { PANEL_THEME } from "@/lib/panel-theme";
import { useI18n } from "@/lib/i18n/provider";
import type { PhotoDialogProps } from "./PhotoExportDialog";

// The dialog (and the offscreen 3D renderer it drives) is only downloaded when somebody opens it.
const PhotoExportDialog = dynamic(() => import("./PhotoExportDialog"), { ssr: false });

type Props = Omit<PhotoDialogProps, "onClose" | "mode"> & {
  mode?: PhotoDialogProps["mode"];
  className?: string;
  children?: ReactNode;
  /** Accessible name; defaults to the translated "Download image". */
  ariaLabel?: string;
};

export function PhotoExportButton({ className, children, ariaLabel, mode = "visitor", museum, ...dialog }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" aria-label={ariaLabel ?? t("export.open")} onClick={() => setOpen(true)}>
        <ImageDown aria-hidden className="size-5" />
        {children}
      </button>
      {open ? <PhotoExportDialog mode={mode} museum={museum} themeVars={mode === "admin" ? PANEL_THEME.cssVars : museum.theme.cssVars} {...dialog} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
