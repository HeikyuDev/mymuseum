-- OPTIONAL demo data. Run manually in the SQL editor AFTER the first user exists
-- and has been promoted to super_admin. It is a no-op otherwise.
-- Artworks use public Unsplash URLs through artworks.external_image_url.

do $$
declare
  v_owner   uuid;
  v_museum  uuid;
  v_family  uuid;
  v_friends uuid;
begin
  select id into v_owner from public.profiles
  where role = 'super_admin' order by created_at limit 1;

  if v_owner is null then
    raise notice 'No super_admin profile found; skipping demo seed.';
    return;
  end if;

  -- Each user owns exactly one museum (see 20261018000000_one_museum_per_user.sql).
  if exists (select 1 from public.museums where owner_id = v_owner) then
    raise notice 'The super admin already owns a museum; skipping demo seed.';
    return;
  end if;

  if exists (select 1 from public.museums where slug = 'demo-museum') then
    raise notice 'Demo museum already exists; skipping.';
    return;
  end if;

  insert into public.museums (owner_id, slug, title, tagline, is_published)
  values (v_owner, 'demo-museum', 'Demo Museum', 'A small collection of memories', true)
  returning id into v_museum;

  insert into public.halls (museum_id, name, slug, sort_order, wall_style, floor_style, lighting_preset, default_frame_style)
  values (v_museum, 'Family', 'family', 0, 'plaster', 'parquet', 'warm', 'wood')
  returning id into v_family;

  insert into public.halls (museum_id, name, slug, sort_order, wall_style, floor_style, lighting_preset, default_frame_style)
  values (v_museum, 'Friends', 'friends', 1, 'brick', 'concrete', 'dramatic', 'black_gallery')
  returning id into v_friends;

  insert into public.artworks (museum_id, hall_id, title, author_name, year, external_image_url, aspect_ratio, frame_style, sort_order)
  values
    (v_museum, v_family,  'Sunday lunch',   'Demo', 2021, 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=1200', 1.5, 'wood', 0),
    (v_museum, v_family,  'Grandparents',   'Demo', 2019, 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=1200', 1.5, 'gold', 1),
    (v_museum, v_friends, 'Road trip',      'Demo', 2022, 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200', 1.5, 'black_gallery', 0),
    (v_museum, v_friends, 'Summer evening', 'Demo', 2023, 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1200', 1.5, 'minimal', 1);

  update public.museums set default_hall_id = v_family where id = v_museum;
end $$;
