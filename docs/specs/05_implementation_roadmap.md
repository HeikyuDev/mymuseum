# 05 - Implementation Roadmap

Current status of the platform. Earlier specs (01 to 04) describe a superseded design and are kept for reference only; the root `README.md` is the source of truth for architecture.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Data layer: Supabase schema, RLS policies, auth trigger, `artworks` storage bucket, migrations | Done |
| 2 | Public viewer at `/m/[slug]`: button-only 2.5D experience, hall transitions, theming pipeline | Done |
| 3 | Museum admin at `/admin`: onboarding, halls, hall style editor, artwork upload and management, appearance, settings, publishing, live preview | Done |
| 4 | Super admin at `/super`: overview, client list, client creation with temporary password, enable/disable, password reset, email change, deletion with Storage cleanup, museum list with force unpublish | Done |
| 5 | Story export: museum-styled vertical image of an artwork or hall (extension point: `src/components/viewer/ExportStoryButton.tsx`) | Pending |

## Phase 4 notes

- Accounts are created with the service-role client (`auth.admin.createUser`, email confirmed); the database trigger creates the profile with role `owner`.
- Guard rails: a super admin cannot disable or delete themselves or the last active super admin.
- Disabling an account sets `profiles.is_active = false` and bans the auth user so sessions cannot be renewed.

## Known gaps

- Storage usage per museum is not tracked.
- Clients cannot change their own password yet; a super admin resets it.
- Impersonation ("open in admin") is intentionally out of scope.
