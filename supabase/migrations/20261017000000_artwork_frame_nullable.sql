-- Phase 3 (optional): lets an artwork leave frame_style empty so it inherits the
-- hall's default_frame_style. Without this migration the admin falls back to
-- saving the hall's current default as an explicit frame style.
-- Run once in the Supabase SQL editor. Existing artworks keep their frame style.

alter table public.artworks alter column frame_style drop not null;
alter table public.artworks alter column frame_style drop default;
