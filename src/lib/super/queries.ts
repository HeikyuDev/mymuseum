import "server-only";
import { getSuperContext } from "@/lib/super/server";
import {
  PAGE_SIZE,
  type ClientListParams,
  type MuseumListParams,
} from "@/lib/super/params";
import type { MuseumRow, ProfileRow } from "@/types/database";

export type MuseumSummary = Pick<MuseumRow, "id" | "slug" | "title" | "is_published" | "created_at"> & {
  artworkCount: number;
};

export type ClientListItem = { profile: ProfileRow; museums: MuseumSummary[] };

type Supabase = Awaited<ReturnType<typeof getSuperContext>>["supabase"];

async function artworkCounts(supabase: Supabase, museumIds: string[]): Promise<Map<string, number>> {
  const entries = await Promise.all(
    museumIds.map(async (id) => {
      const { count } = await supabase.from("artworks").select("id", { count: "exact", head: true }).eq("museum_id", id);
      return [id, count ?? 0] as const;
    }),
  );
  return new Map(entries);
}

async function museumsByOwner(supabase: Supabase, ownerIds: string[]): Promise<Map<string, MuseumSummary[]>> {
  const result = new Map<string, MuseumSummary[]>();
  if (ownerIds.length === 0) return result;
  const { data } = await supabase
    .from("museums")
    .select("id, owner_id, slug, title, is_published, created_at")
    .in("owner_id", ownerIds)
    .order("created_at", { ascending: true });
  const rows = data ?? [];
  const counts = await artworkCounts(supabase, rows.map((row) => row.id));
  for (const row of rows) {
    const list = result.get(row.owner_id) ?? [];
    list.push({
      id: row.id,
      slug: row.slug,
      title: row.title,
      is_published: row.is_published,
      created_at: row.created_at,
      artworkCount: counts.get(row.id) ?? 0,
    });
    result.set(row.owner_id, list);
  }
  return result;
}

export async function getOverview() {
  const { supabase } = await getSuperContext();
  const head = { count: "exact", head: true } as const;
  const [clients, activeClients, museums, published, artworks, recent] = await Promise.all([
    supabase.from("profiles").select("id", head).eq("role", "owner"),
    supabase.from("profiles").select("id", head).eq("role", "owner").eq("is_active", true),
    supabase.from("museums").select("id", head),
    supabase.from("museums").select("id", head).eq("is_published", true),
    supabase.from("artworks").select("id", head),
    supabase.from("profiles").select("*").eq("role", "owner").order("created_at", { ascending: false }).limit(5),
  ]);

  const recentProfiles = recent.data ?? [];
  const byOwner = await museumsByOwner(supabase, recentProfiles.map((profile) => profile.id));
  const recentClients: ClientListItem[] = recentProfiles.map((profile) => ({ profile, museums: byOwner.get(profile.id) ?? [] }));

  return {
    clients: clients.count ?? 0,
    activeClients: activeClients.count ?? 0,
    museums: museums.count ?? 0,
    published: published.count ?? 0,
    artworks: artworks.count ?? 0,
    recentClients,
  };
}

export async function listClients(params: ClientListParams) {
  const { supabase } = await getSuperContext();

  // Search also matches museum slug/title: resolve matching owners first.
  let museumOwnerIds: string[] = [];
  if (params.q) {
    const { data } = await supabase
      .from("museums")
      .select("owner_id")
      .or(`slug.ilike.%${params.q}%,title.ilike.%${params.q}%`)
      .limit(200);
    museumOwnerIds = [...new Set((data ?? []).map((row) => row.owner_id))];
  }

  let query = supabase.from("profiles").select("*", { count: "exact" });
  if (params.q) {
    const filters = [`email.ilike.%${params.q}%`, `display_name.ilike.%${params.q}%`];
    if (museumOwnerIds.length > 0) filters.push(`id.in.(${museumOwnerIds.join(",")})`);
    query = query.or(filters.join(","));
  }
  if (params.status !== "all") query = query.eq("is_active", params.status === "active");
  if (params.role !== "all") query = query.eq("role", params.role);

  const from = (params.page - 1) * PAGE_SIZE;
  const { data, count } = await query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  const profiles = data ?? [];
  const byOwner = await museumsByOwner(supabase, profiles.map((profile) => profile.id));

  const items: ClientListItem[] = profiles.map((profile) => ({ profile, museums: byOwner.get(profile.id) ?? [] }));
  return { items, total: count ?? 0 };
}

export async function getClientDetail(id: string) {
  const { supabase } = await getSuperContext();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!profile) return null;

  const byOwner = await museumsByOwner(supabase, [id]);
  const museums = byOwner.get(id) ?? [];
  const hallCounts = await Promise.all(
    museums.map(async (museum) => {
      const { count } = await supabase.from("halls").select("id", { count: "exact", head: true }).eq("museum_id", museum.id);
      return count ?? 0;
    }),
  );
  const { count: activeSuperAdmins } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "super_admin")
    .eq("is_active", true);

  return {
    profile,
    museums: museums.map((museum, index) => ({ ...museum, hallCount: hallCounts[index] })),
    activeSuperAdmins: activeSuperAdmins ?? 0,
  };
}

export type MuseumListItem = MuseumSummary & { owner: Pick<ProfileRow, "id" | "email" | "display_name" | "is_active"> | null };

export async function listMuseums(params: MuseumListParams) {
  const { supabase } = await getSuperContext();

  let ownerIds: string[] = [];
  if (params.q) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .or(`email.ilike.%${params.q}%,display_name.ilike.%${params.q}%`)
      .limit(200);
    ownerIds = (data ?? []).map((row) => row.id);
  }

  let query = supabase
    .from("museums")
    .select("id, owner_id, slug, title, is_published, created_at", { count: "exact" });
  if (params.q) {
    const filters = [`slug.ilike.%${params.q}%`, `title.ilike.%${params.q}%`];
    if (ownerIds.length > 0) filters.push(`owner_id.in.(${ownerIds.join(",")})`);
    query = query.or(filters.join(","));
  }
  if (params.status !== "all") query = query.eq("is_published", params.status === "published");

  const from = (params.page - 1) * PAGE_SIZE;
  const { data, count } = await query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  const rows = data ?? [];

  const [counts, owners] = await Promise.all([
    artworkCounts(supabase, rows.map((row) => row.id)),
    supabase
      .from("profiles")
      .select("id, email, display_name, is_active")
      .in("id", [...new Set(rows.map((row) => row.owner_id))]),
  ]);
  const ownerById = new Map((owners.data ?? []).map((owner) => [owner.id, owner]));

  const items: MuseumListItem[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    is_published: row.is_published,
    created_at: row.created_at,
    artworkCount: counts.get(row.id) ?? 0,
    owner: ownerById.get(row.owner_id) ?? null,
  }));
  return { items, total: count ?? 0 };
}
