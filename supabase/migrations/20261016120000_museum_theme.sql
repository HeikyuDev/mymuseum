-- Phase 2: per-museum theme, theme overrides, hall floor decorations and a
-- bright "white gallery" default look. Run this once in the Supabase SQL editor
-- (after 20261016000000_initial_schema.sql). The app falls back to the same
-- defaults while these columns do not exist yet.

-- ---------------------------------------------------------------------------
-- museums: theme preset + fine-grained overrides
-- ---------------------------------------------------------------------------

alter table public.museums
  add column if not exists theme_preset text not null default 'light_modern';

alter table public.museums
  drop constraint if exists museums_theme_preset_check;

alter table public.museums
  add constraint museums_theme_preset_check
  check (theme_preset in ('dark_elegant', 'light_modern', 'warm_classic', 'midnight_blue', 'minimal_mono'));

-- Extensible bag, e.g. {"radius": "soft", "density": "comfortable", "motion": "normal"}
alter table public.museums
  add column if not exists theme_overrides jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- halls: floor decoration + extensible decor bag + white-gallery defaults
-- ---------------------------------------------------------------------------

alter table public.halls
  add column if not exists floor_decoration text not null default 'none';

alter table public.halls
  drop constraint if exists halls_floor_decoration_check;

alter table public.halls
  add constraint halls_floor_decoration_check
  check (floor_decoration in ('none', 'red_carpet', 'runner_gold_trim', 'rug_persian',
                              'rug_geometric', 'spotlight_pool'));

-- Optional hex colour that overrides the decoration's default colour.
alter table public.halls
  add column if not exists floor_decoration_color text;

alter table public.halls
  drop constraint if exists halls_floor_decoration_color_check;

alter table public.halls
  add constraint halls_floor_decoration_color_check
  check (floor_decoration_color is null or floor_decoration_color ~ '^#[0-9a-fA-F]{6}$');

-- Extensible bag, e.g. {"rope_barriers": true, "benches": true, "plants": false}
alter table public.halls
  add column if not exists decor jsonb not null default '{}'::jsonb;

-- Bright gallery defaults for halls created from now on.
alter table public.halls alter column wall_style set default 'plaster';
alter table public.halls alter column floor_style set default 'parquet';
alter table public.halls alter column lighting_preset set default 'soft';
alter table public.halls alter column default_frame_style set default 'minimal';
