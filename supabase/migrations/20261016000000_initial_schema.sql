-- MyMuseum initial schema (PostgreSQL / Supabase).
-- Credentials are owned by Supabase Auth (auth.users); no password column exists here.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text,
  role         text not null default 'owner' check (role in ('super_admin', 'owner')),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Creates a profile for every new auth user. The role is NEVER read from user
-- metadata: everyone starts as 'owner'; promotion to super_admin is manual.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Security-definer helpers bypass RLS, which avoids policy recursion.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin' and is_active
  );
$$;

-- Blocks non-super-admins from changing role / is_active / id on any profile.
-- Direct SQL (SQL editor, service role) has auth.uid() = null and is allowed.
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not public.is_super_admin()
     and (new.role is distinct from old.role
          or new.is_active is distinct from old.is_active
          or new.id is distinct from old.id) then
    raise exception 'Only a super admin can change role or active status';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- ---------------------------------------------------------------------------
-- museums
-- ---------------------------------------------------------------------------

create table public.museums (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  slug             text not null unique
                     check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40)
                     check (slug <> all (array[
                       'admin', 'super', 'api', 'm', 'login', 'logout', 'signup',
                       'auth', 'dashboard', 'settings', 'static', 'public', '_next', 'assets'
                     ])),
  title            text not null check (char_length(title) between 1 and 120),
  tagline          text check (char_length(tagline) <= 200),
  description      text check (char_length(description) <= 2000),
  is_published     boolean not null default false,
  accent_color     text not null default '#c9a227' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  font_pairing     text not null default 'classic'
                     check (font_pairing in ('classic', 'modern', 'editorial', 'handwritten')),
  default_hall_id  uuid,
  cover_image_path text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index museums_owner_id_idx on public.museums (owner_id);
create index museums_published_idx on public.museums (is_published) where is_published;

create trigger museums_set_updated_at
  before update on public.museums
  for each row execute function public.set_updated_at();

create or replace function public.owns_museum(p_museum_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.museums m
    join public.profiles p on p.id = m.owner_id
    where m.id = p_museum_id and m.owner_id = auth.uid() and p.is_active
  );
$$;

-- ---------------------------------------------------------------------------
-- halls
-- ---------------------------------------------------------------------------

create table public.halls (
  id                  uuid primary key default gen_random_uuid(),
  museum_id           uuid not null references public.museums (id) on delete cascade,
  name                text not null check (char_length(name) between 1 and 80),
  slug                text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  description         text check (char_length(description) <= 1000),
  sort_order          integer not null default 0,
  wall_style          text not null default 'plaster'
                        check (wall_style in ('plaster', 'brick', 'concrete', 'wood_panel',
                                              'marble', 'velvet', 'linen', 'custom_color')),
  wall_color          text check (wall_color ~ '^#[0-9a-fA-F]{6}$'),
  floor_style         text not null default 'parquet'
                        check (floor_style in ('parquet', 'marble', 'concrete', 'carpet', 'dark_wood')),
  lighting_preset     text not null default 'warm'
                        check (lighting_preset in ('warm', 'cold', 'dramatic', 'soft')),
  default_frame_style text not null default 'wood'
                        check (default_frame_style in ('minimal', 'wood', 'gold', 'metallic',
                                                       'canvas_wrap', 'black_gallery',
                                                       'vintage_ornate', 'floating_glass')),
  accent_color        text check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  cover_artwork_id    uuid,
  is_visible          boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (museum_id, slug),
  unique (id, museum_id), -- target for composite FKs that keep children inside the same museum
  check (wall_style <> 'custom_color' or wall_color is not null)
);

create index halls_museum_sort_idx on public.halls (museum_id, sort_order);

create trigger halls_set_updated_at
  before update on public.halls
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- artworks
-- ---------------------------------------------------------------------------

-- Deleting a hall does NOT delete its artworks: hall_id is set to NULL so the
-- owner never loses uploaded photos by accident. Unassigned artworks stay in
-- the museum until the owner reassigns them (or deletes them explicitly).
create table public.artworks (
  id                 uuid primary key default gen_random_uuid(),
  museum_id          uuid not null references public.museums (id) on delete cascade,
  hall_id            uuid,
  title              text not null check (char_length(title) between 1 and 160),
  description        text check (char_length(description) <= 2000),
  author_name        text check (char_length(author_name) <= 120),
  year               integer check (year between 0 and 3000),
  image_path         text,   -- Storage path inside bucket "artworks": {museum_id}/{file}
  external_image_url text,   -- optional, only for demo data / remote images
  width_px           integer check (width_px > 0),
  height_px          integer check (height_px > 0),
  aspect_ratio       numeric(8, 4) check (aspect_ratio > 0),
  frame_style        text not null default 'wood'
                       check (frame_style in ('minimal', 'wood', 'gold', 'metallic',
                                              'canvas_wrap', 'black_gallery',
                                              'vintage_ornate', 'floating_glass')),
  frame_color        text check (frame_color ~ '^#[0-9a-fA-F]{6}$'),
  mat                boolean not null default false,  -- passe-partout
  mat_color          text check (mat_color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order         integer not null default 0,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, museum_id),
  check (image_path is not null or external_image_url is not null),
  -- the hall must belong to the same museum; on hall delete only hall_id is nulled
  foreign key (hall_id, museum_id) references public.halls (id, museum_id)
    on delete set null (hall_id)
);

create index artworks_museum_idx on public.artworks (museum_id);
create index artworks_hall_sort_idx on public.artworks (hall_id, sort_order);

create trigger artworks_set_updated_at
  before update on public.artworks
  for each row execute function public.set_updated_at();

-- Circular references added after both tables exist. Composite keys guarantee
-- the referenced row belongs to the same museum.
alter table public.museums
  add foreign key (default_hall_id, id) references public.halls (id, museum_id)
    on delete set null (default_hall_id);

alter table public.halls
  add foreign key (cover_artwork_id, museum_id) references public.artworks (id, museum_id)
    on delete set null (cover_artwork_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.museums  enable row level security;
alter table public.halls    enable row level security;
alter table public.artworks enable row level security;

-- profiles: users read/update themselves (role/is_active guarded by trigger);
-- inserts happen only through the auth trigger; super admin manages everyone.
create policy profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_super_admin_all on public.profiles
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- museums
create policy museums_public_read on public.museums
  for select to anon, authenticated using (is_published);
create policy museums_owner_select on public.museums
  for select to authenticated using (owner_id = auth.uid());
create policy museums_owner_insert on public.museums
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and is_active)
  );
create policy museums_owner_update on public.museums
  for update to authenticated
  using (public.owns_museum(id))
  with check (owner_id = auth.uid());
create policy museums_owner_delete on public.museums
  for delete to authenticated using (public.owns_museum(id));
create policy museums_super_admin_all on public.museums
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- halls
create policy halls_public_read on public.halls
  for select to anon, authenticated
  using (
    is_visible
    and exists (select 1 from public.museums m where m.id = museum_id and m.is_published)
  );
create policy halls_owner_all on public.halls
  for all to authenticated
  using (public.owns_museum(museum_id))
  with check (public.owns_museum(museum_id));
create policy halls_super_admin_all on public.halls
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- artworks (unassigned artworks, hall_id null, are public if active and published)
create policy artworks_public_read on public.artworks
  for select to anon, authenticated
  using (
    is_active
    and exists (select 1 from public.museums m where m.id = museum_id and m.is_published)
    and (
      hall_id is null
      or exists (select 1 from public.halls h where h.id = hall_id and h.is_visible)
    )
  );
create policy artworks_owner_all on public.artworks
  for all to authenticated
  using (public.owns_museum(museum_id))
  with check (public.owns_museum(museum_id));
create policy artworks_super_admin_all on public.artworks
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Storage: bucket "artworks" (public read, 10 MB, images only)
-- Object path convention: {museum_id}/{filename}
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'artworks', 'artworks', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Compares the first path segment as text, so malformed paths never raise cast errors.
create or replace function public.owns_museum_folder(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.museums m
    join public.profiles p on p.id = m.owner_id
    where m.id::text = (storage.foldername(p_object_name))[1]
      and m.owner_id = auth.uid()
      and p.is_active
  );
$$;

-- Public reads of object bytes are served by the public bucket; these policies
-- cover listing and writes performed through the authenticated API.
create policy artworks_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'artworks' and (public.owns_museum_folder(name) or public.is_super_admin()));
create policy artworks_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'artworks' and (public.owns_museum_folder(name) or public.is_super_admin()));
create policy artworks_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'artworks' and (public.owns_museum_folder(name) or public.is_super_admin()))
  with check (bucket_id = 'artworks' and (public.owns_museum_folder(name) or public.is_super_admin()));
create policy artworks_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'artworks' and (public.owns_museum_folder(name) or public.is_super_admin()));
