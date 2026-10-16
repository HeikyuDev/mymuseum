"use client";

import { Suspense, lazy } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { ViewerMuseum } from "@/lib/viewer-model";
import { LoadingScreen } from "./LoadingScreen";

// three.js, react-three-fiber and the whole 3D scene are a separate chunk: the page shell and the
// loading curtain paint first, and no other route ever downloads them.
const MuseumGallery = lazy(() => import("./MuseumGallery").then((module) => ({ default: module.MuseumGallery })));

function Curtain({ museum }: { museum: ViewerMuseum }) {
  const { t } = useI18n();
  return (
    <div className="relative h-dvh w-full bg-canvas">
      <LoadingScreen title={museum.title} tagline={museum.tagline} visible progress={4} loading={t("viewer.loading")} accent={museum.theme.accent} />
    </div>
  );
}

export function GalleryLoader({ museum }: { museum: ViewerMuseum }) {
  return (
    <Suspense fallback={<Curtain museum={museum} />}>
      <MuseumGallery museum={museum} />
    </Suspense>
  );
}
