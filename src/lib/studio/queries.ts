import "server-only";
import { cache } from "react";
import { requireMuseum } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ArtworkRow, HallRow } from "@/types/database";

// Data access for the admin area. Each function re-verifies auth and ownership
// (layouts do not re-run on client navigation) and filters by the caller's museum
// on top of RLS.

export const getOwnHalls = cache(async (): Promise<HallRow[]> => {
  const { museum } = await requireMuseum();
  const supabase = await createClient();
  const { data } = await supabase
    .from("halls")
    .select("*")
    .eq("museum_id", museum.id)
    .order("sort_order")
    .order("created_at");
  return data ?? [];
});

export const getOwnArtworks = cache(async (): Promise<ArtworkRow[]> => {
  const { museum } = await requireMuseum();
  const supabase = await createClient();
  const { data } = await supabase
    .from("artworks")
    .select("*")
    .eq("museum_id", museum.id)
    .order("sort_order")
    .order("created_at");
  return data ?? [];
});
