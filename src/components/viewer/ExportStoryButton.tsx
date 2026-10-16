"use client";

import { useMemo } from "react";
import { StoryExportButton } from "@/components/story/StoryExportButton";
import type { StoryArtworkInfo, StoryHallInfo, StoryMuseumInfo } from "@/lib/story/plan";
import type { ViewerArtwork, ViewerHall, ViewerMuseum } from "@/lib/viewer-model";
import { btnGhost } from "./ui";

type Props = {
  museum: ViewerMuseum;
  hall: ViewerHall;
  artwork: ViewerArtwork;
};

/**
 * Visitor entry point: a single "Download image" action. The look is fully
 * automatic (the hall's own style plus the photo heuristics); visitors only pick
 * a format. Hidden when the owner turned visitor downloads off.
 */
export function ExportStoryButton({ museum, hall, artwork }: Props) {
  const halls = useMemo<StoryHallInfo[]>(() => museum.halls.map((item) => ({ id: item.id, name: item.name, style: item.style })), [museum.halls]);
  const info = useMemo<StoryMuseumInfo>(
    () => ({ title: museum.title, slug: museum.slug, accent: museum.theme.accent, fontPairing: museum.theme.fontPairing }),
    [museum],
  );
  const story = useMemo<StoryArtworkInfo>(
    () => ({
      title: artwork.title,
      year: artwork.year,
      imageUrl: artwork.imageUrl,
      aspect: artwork.aspect,
      frameStyle: artwork.frameStyle,
      frameColor: artwork.frameColor,
      mat: artwork.mat,
      matColor: artwork.matColor,
    }),
    [artwork],
  );

  if (!museum.theme.overrides.allowVisitorExport) return null;
  return (
    <StoryExportButton
      mode="visitor"
      museum={info}
      artwork={story}
      halls={halls}
      hallId={hall.id}
      themeVars={museum.theme.cssVars}
      className={`${btnGhost} w-full`}
    >
      Download image
    </StoryExportButton>
  );
}
