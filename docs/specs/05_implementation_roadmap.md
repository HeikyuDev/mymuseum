# 05 - Implementation Roadmap

Current status of the platform. Earlier specs (01 to 04) describe a superseded design and are kept for reference only; the root `README.md` is the source of truth for architecture.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Data layer: Supabase schema, RLS policies, auth trigger, `artworks` storage bucket, migrations | Done |
| 2 | Public viewer at `/m/[slug]`: button-only 2.5D experience, hall transitions, theming pipeline | Done |
| 3 | Museum admin at `/admin`: onboarding, halls, hall style editor, artwork upload and management, appearance, settings, publishing, live preview | Done |
| 4 | Super admin at `/super`: overview, client list, client creation with temporary password, enable/disable, password reset, email change, deletion with Storage cleanup, museum list with force unpublish | Done |
| 5 | Image export: museum-styled Story (9:16), Post (4:5) and Square (1:1) images of an artwork, canvas-rendered in the browser, with a visitor flow and an advanced owner dialog | Done |

## Phase 4 notes

- Accounts are created with the service-role client (`auth.admin.createUser`, email confirmed); the database trigger creates the profile with role `owner`.
- Guard rails: a super admin cannot disable or delete themselves or the last active super admin.
- Disabling an account sets `profiles.is_active = false` and bans the auth user so sessions cannot be renewed.

## Phase 5 notes

- Renderer: pure Canvas 2D in `src/lib/story` (plan resolution, layout, color heuristics, drawing), UI in `src/components/story`. Layout, text fitting, heuristics and filenames are unit tested.
- Caption: artwork title as the main text and the year as a small detail line. The author is never shown; the description appears only if the owner adds it in the admin dialog.
- Access control: `museums.theme_overrides.allowVisitorExport` (default true, no SQL migration), toggled in Admin > Appearance. Owners can always export from the admin.
- Visitors only choose a format; owners get scene, frame, mat, lighting and text controls. The image is never uploaded.

## Known gaps

- Storage usage per museum is not tracked.
- Clients cannot change their own password yet; a super admin resets it.
- Image export has not been tested on real iOS Safari or Android devices yet, and there is no video or multi-artwork export.
- Impersonation ("open in admin") is intentionally out of scope.
