<p align="center">
  <img src="img/mymuseum_logo.png" alt="MyMuseum - Your gallery, your story" width="560" />
</p>

# MyMuseum

MyMuseum is a multi-tenant platform for virtual museums. The platform owner creates client accounts; each client signs in and creates **their own museum** (exactly one per account) with categories (halls), framed artworks and a fully customizable look, published at a public link.

- **Halls and artworks**: a museum is a sequence of halls; each hall holds framed artworks with title, author, year and description.
- **3D viewer**: visitors open `/m/[slug]` straight inside one continuous museum, rendered in real time with react-three-fiber. The camera runs on rails (no free movement): arrow buttons, the keyboard or a click on an artwork glide it along the wall between works and past the divider walls that separate categories. A visit opens in front of a solid, lettered entrance wall.
- **Customization**: museum theme presets, accent color and font pairing; per-hall wall, floor, lighting, frame style and floor decorations (carpets, rugs, spotlight pool) plus decor such as rope barriers, benches and plants.
- **Live preview**: the studio editors render the same 3D scene (embedded, light quality) while you edit.
- **Languages**: everything is Spanish by default with an English alternative: the login page, the platform admin, the studio and the public viewer. An ES/EN switch (`lang` cookie) sits on the login page and in both panel headers; each museum also has a default language for its visitors (Studio > Settings).
- **Image export**: a real photograph of the 3D museum taken at the artwork's spot (Story 9:16, Post 4:5 or Square 1:1). See [Image export](#image-export).

## Areas and roles

| Area | Path | Who | Purpose |
| --- | --- | --- | --- |
| Platform admin | `/admin` | `super_admin` only | Create and manage client accounts, see every museum (read-only), force unpublish |
| Studio | `/studio` | any active signed-in user | The owner's panel for their one museum: overview, categories, artworks, style, settings, publishing |
| Public viewer | `/m/[slug]` | anyone | Visit a published museum |
| Login | `/login` | anyone | Email and password sign-in; redirects by role |
| Landing | `/` | anyone | A quiet welcome page with a sign-in button |

Sign-in lands a `super_admin` on `/admin` and everybody else on `/studio`. A `super_admin` can also open `/studio` for a museum of their own. A client who opens `/admin` is sent to `/studio`. `/super/*` is the former name of the platform admin and redirects permanently to `/admin/*`; old owner URLs under `/admin` are not redirected (that path now means the platform admin).

Roles live in `public.profiles.role` (`super_admin` or `owner`). They are never read from user metadata. Disabled accounts (`is_active = false`) cannot sign in and are signed out on their next request.

**One museum per user.** A unique index on `museums.owner_id` enforces it. Creating a client never creates a museum: on first sign-in the client sees a short onboarding (museum name, public address with a live availability check, and the name of a starter category) and creates it exactly once. There is no museum selector anywhere.

Platform admin features: overview, searchable client list, create client (generated temporary password shown once), edit name, enable/disable, reset password, change email, delete client with typed confirmation (also removes their Storage files), and a read-only museum list with force unpublish. Impersonation is intentionally not implemented.

In the Spanish interface halls are called **Categorías** and the accounts of the platform **Clientes**; in English they are "categories" and "clients" (the code and the database still say `halls`).

## Architecture

```mermaid
flowchart LR
  Browser -->|every request| Proxy["src/proxy.ts<br/>refresh session, redirect anonymous"]
  Proxy --> App["Next.js App Router<br/>server components + server actions"]
  App -->|"anon key + user cookies (RLS)"| Supabase[("Supabase<br/>Auth, Postgres + RLS, Storage")]
  App -->|"service role (server-only)"| Supabase
  Browser -->|"signed-in upload (Storage RLS)"| Supabase
```

- **Next.js 16 App Router**, React 19, Tailwind CSS 4, `motion` for animation, `sonner` for toasts, Zod 4 for validation.
- **Supabase** provides Auth (credentials live in `auth.users` only), Postgres with Row Level Security and the public `artworks` Storage bucket.
- **`src/proxy.ts`** refreshes the session cookie and sends anonymous visitors of `/admin` and `/studio` to `/login?next=...` (`src/lib/auth/redirects.ts`, unit tested). It is only a first line of defence: every page, query and server action verifies the user with `supabase.auth.getUser()` and the role from `profiles` again (`src/lib/auth/session.ts`: `requireUser`, `requireRole`, `getOwnMuseum`, `requireMuseum`).
- **Server actions** (`src/app/studio/actions`, `src/app/admin/actions.ts`) validate input with Zod, check ownership or role, then mutate. Failures are localized on the server with the request language (`src/lib/action-result.ts`); pure validation helpers return message codes (`val.*`) that the UI translates.
- **Theme pipeline**: database rows are resolved into render-ready values and then CSS variables.

```text
museums.theme_preset / accent_color / font_pairing / theme_overrides
        -> resolveMuseumTheme()  (src/lib/theme.ts)   -> CSS variables on the page root
halls.wall_style / floor_style / floor_decoration / lighting / frame / decor
        -> resolveHallStyle()    (src/lib/hall-style.ts) -> 3D scene (src/components/gallery)
```

Both panels use the same tokens with a fixed neutral light palette (`src/lib/panel-theme.ts`), so they stay readable whatever a museum looks like.

## Project structure

```text
src/
  app/
    page.tsx             landing page
    login/               sign-in form, server actions, disabled-account route
    studio/              owner panel: overview, categories, artworks, style, settings
      actions/           server actions (museum, halls, artworks)
    admin/               platform admin: overview, clients, museums, server actions
    m/[slug]/            public viewer
  components/
    ui/                  shared panel UI (buttons, fields, nav, language switcher, status badge)
    studio/              studio UI (pickers, previews, onboarding, save bar, share card)
    admin/               platform admin UI (password field, credentials panel, pagination, badges)
    gallery/             3D museum: scene, camera rail, frames, dividers, lighting, export
    viewer/              CSS frame and wall previews used by the admin pickers
  lib/
    auth/                getAuthState/requireUser/requireRole/getOwnMuseum, route areas and redirect safety
    action-result.ts     localized server-action results
    panel-theme.ts       fixed theme of the panels
    supabase/            server, browser and service-role clients, storage URLs
    studio/              owner data access (own halls and artworks), action helpers, override merging
    admin/               platform admin queries, guards, validation, password generator
    validation/          Zod schemas and slug rules (reserved slugs)
    theme.ts             museum theme presets and CSS variable resolution
    hall-style.ts        hall style options and resolution
    viewer-model.ts      pure viewer data model
    gallery/             pure 3D logic: layout engine, camera rail math, quality tiers, scene look
    photo/               export formats, safe zones, photographic composition
    i18n/                es/en dictionaries (viewer + panels), typed t(), message codes, formatting, locale cookie
  proxy.ts               session refresh and first-line route protection
  types/database.ts      hand-written row types matching the migrations
supabase/
  migrations/            ordered SQL migrations
  seed.sql               optional demo museum
docs/
  SUPABASE_SETUP.md      step-by-step Supabase setup
  specs/                 original design specs (see status note in each file)
```

## Data model and security

| Table | Key columns |
| --- | --- |
| `profiles` | `id` (= `auth.users.id`), `email`, `display_name`, `role`, `is_active` |
| `museums` | `owner_id` (unique: one museum per user), `slug` (unique, validated, reserved words blocked), `title`, `is_published`, theme columns, `default_hall_id`, `cover_image_path` |
| `halls` | `museum_id`, `name`, `slug`, `sort_order`, wall/floor/lighting/frame styles, `floor_decoration`, `decor`, `is_visible` |
| `artworks` | `museum_id`, `hall_id` (nullable), `title`, `image_path`, aspect ratio, frame options, `sort_order`, `is_active` |

Deleting a user cascades to their profile, museum, halls and artworks. Deleting a hall only unassigns its artworks.

Security model:

- **No passwords in app tables.** Credentials are owned by Supabase Auth. A database trigger creates the `profiles` row for each new auth user with role `owner`; promotion to `super_admin` is manual SQL.
- **RLS on every table.** Anonymous visitors read only published museums, visible halls and active artworks. Owners read and write only their own rows (`owns_museum()`); super admins have explicit policies. A trigger stops non-super-admins from changing `role` or `is_active`.
- **Storage.** Bucket `artworks` is public-read, 10 MB limit, images only. Objects live at `{museum_id}/{file}`; write policies check folder ownership.
- **Service role is server-only.** `SUPABASE_SERVICE_ROLE_KEY` is used by `src/lib/supabase/admin.ts` (marked `server-only`) for creating, updating and deleting auth users and for Storage cleanup. It is never sent to the browser.
- **Super admin guard rails.** Server actions re-check the role on every call; a super admin cannot disable or delete themselves or the last active super admin. Passwords are never logged or stored; a generated password is shown once.

## 3D viewer

```text
ViewerMuseum -> galleryZones() -> buildLayout()   (src/lib/gallery, pure and unit tested)
                      |                 |
                      |                 +-> artwork positions, dividers, camera stops
                      +-> zoneLook()    wall, floor, decoration, lighting per hall
GalleryScene (src/components/gallery): lights, camera rail, zones, dividers, artworks
```

- **One continuous gallery.** Halls are consecutive zones of a long wall. Artwork positions come from their real aspect ratios (equal visual weight, spacing proportional to widths, centers at 1.62 m, small photos scaled up to a minimum visual size). The museum starts at a modern entrance wall (fine microcement in a neutral tone of the first hall, the museum name in large minimal lettering, a recessed LED strip along the ceiling line; there is no doorway at the start), and categories are separated by a solid divider wall on the same wall plane (the same microcement, LED strip and baseboard, with the category name in large minimal lettering and the museum name under a hairline; floor, ceiling and carpets run straight through it, there are no doorways anywhere); categories without active artworks are left out of the public museum and its menu; artworks without a hall form an "Other" zone at the end, closed by a matching end wall.
- **Camera on rails.** One stop per artwork plus one per hall entrance (the first one frames the entrance wall, where the opening glide starts). Every move is a glide of fixed duration (0.9 s for a hop between works up to 1.7 s across the museum) along a smootherstep curve evaluated from elapsed time (`glideAt` in `camera-math.ts`): deterministic, no overshoot, position and gaze on the same curve, and an interrupted glide hands its velocity to the next one. A frame never advances the glide by more than 80 ms, and the glide clock starts on the first frame after the request, so a hitch cannot make the camera jump. The rail keeps its state in plain objects (no React state while moving). `prefers-reduced-motion` cuts instead of gliding.
- **Materials.** Procedural wall (plaster, brick, concrete, wood, marble, velvet, linen) and floor (parquet, marble, concrete, carpet, dark wood) textures with bump and roughness; real mitred frame mouldings with mat, glass and canvas variants; carpets, rugs, light pools, benches, plants and rope barriers as geometry.
- **Light.** A pool of spotlights follows the artworks nearest the camera (only a few cast shadows), plus hemisphere and fill light blended across halls. The museum theme preset tints the room. Photos are drawn unlit and untonemapped, so they keep their true colors. Each category has a **Lighting** mode (Default, Soft, Dim, Off) and a **Brightness** slider (40-120%), stored in the existing `halls.decor` jsonb as `lightMode` and `brightness` (validated in `src/lib/hall-style.ts` and `schemas.ts`, no migration). Off means no spotlights and no glare: flat natural light.
- **Quality tiers** (`src/lib/gallery/quality.ts`): `low`, `medium` and `high` are chosen from the device (memory, cores, GPU name, texture limit, pointer, data saver, reduced motion). Phones get extra caps (no MSAA, pixel ratio at most 1.5, smaller shadow maps, no planar reflection, at most two lights). Low has no real lights or shadows: walls and floors carry their lighting in vertex colors (ambient occlusion at the ceiling and the floor line, a warm pool of light behind every artwork, a falloff toward the back; `baked-light.ts`), the tone curve is neutral instead of filmic so colors stay true, and one full-screen vignette quad closes the picture; high adds soft shadows and a planar floor reflection. See [Performance](#performance).
- **Fallback.** Without WebGL, visitors see a notice and a plain list of the artworks.
- **Languages.** Strings live in `src/lib/i18n` (Spanish default; `dictionaries.ts` for the viewer, `panel-es.ts`/`panel-en.ts` for the login page and both panels; a test keeps both languages on the same keys and placeholders). The `lang` cookie is set by a server action; `theme_overrides.defaultLocale` (`es` or `en`, edited in Studio > Settings and validated with Zod; rows without it fall back to `es`) is the museum default for visitors without a cookie.

## Performance

The viewer is built to stay fluid on a mid-range phone. What matters, in order:

- **Nothing over the canvas blends it.** The floating controls use flat semi-opaque fills (no `backdrop-filter`, no big shadows, nothing animated but `transform` and `opacity`), the canvas is opaque (`alpha: false`, no stencil) and the baked tier's vignette is a quad inside the canvas, not a CSS layer.
- **The scene does not re-render while the camera moves.** Zones, dividers and artworks live in a memoized subtree whose inputs never include the current stop. The focus, the motion flags and the scene callbacks are plain mutable objects (`context.tsx`); artworks subscribe to their distance band with `useSyncExternalStore` and re-render only when it changes. The camera rail keeps its state in typed arrays and allocates nothing per frame.
- **Photos never cost a glide.** `photo-store.ts` owns every photo texture: it loads the thumbnail (or the capped original) of the artwork in front of the camera and its neighbours at once, and postpones prefetching and the full-size upgrade until the camera has rested for 280 ms. Photos are decoded straight to their target size in a background thread (`createImageBitmap(blob, { resize })`; resizing an existing bitmap runs synchronously on the main thread, see `image-size.ts`), then uploaded one per frame with `renderer.initTexture`, full-size ones only at rest. Textures are kept for artworks within the load radius plus two and freed (after a short delay) beyond it.
- **Everything the first sight of a hall needs is prepared behind the loading screen.** All materials are compiled (and, with a planar reflection, compiled again for render targets), then every zone and artwork is drawn once so its geometry and procedural textures are on the GPU before the camera gets near.
- **Shadows are drawn on demand.** The casters never move and a spotlight only changes place when it is assigned to another artwork, so the shadow maps are refreshed on assignment instead of every frame. Spotlights are assigned to where the camera is heading, which puts that refresh in the first frame of a glide, where nothing has moved yet.
- **Dynamic resolution.** While the camera glides, the drawing buffer shrinks (`quality.moveScale`: 0.85 on medium and low, 0.75 on phones) and returns in two steps once it rests.
- **Graceful degradation.** In Auto the governor measures frame time while the camera glides (median of 30 frames, two slow windows in a row, then a cooldown) and walks down a ladder, one rung at a time and never back up, so quality cannot flap: resolution 0.85, resolution 0.7, no shadows and no reflection, and only then the baked low tier (`LADDERS` in `quality.ts`). A device that starts on low only lowers its resolution. Changing a rung inside a tier never remounts the canvas.
- **Phones** (`forMobile`): no MSAA, pixel ratio at most 1.5, shadow maps at most 1024, no reflection, at most two lights and one shadow caster, textures at most 1536 px.
- **Camera motion** is time-based (see above), so a slow frame skips instead of slowing the glide down, and the frame loop only runs while something moves (plus three settle frames).

Visitors can pick Auto, High or Low in the corner control (kept in localStorage). `?quality=low|medium|high` forces a tier. `?debug=perf` loads a separate lazy chunk with an overlay (tier, ladder level, pixel ratio, fps, draw calls, triangles, textures, programs, compile time); with it, `&dynres=off` turns the dynamic resolution off for A/B measurements. Without the parameter none of it is downloaded or run. Artwork uploads also store a 640px WebP thumbnail at `{museum_id}/thumbs/{id}.webp` (no database change), and the public page reads the museum in one cached query (tag `museum:{slug}`, invalidated by every studio and admin mutation). Offscreen admin previews are paused.

### Measured

Scripted run in Chrome 155 (headless, real GPU) at 390x844 with touch emulation and CDP CPU throttling: ten consecutive glides across two hall transitions plus two jumps across the museum, frame deltas from `requestAnimationFrame`.

| Run | p95 ms | p99 ms | worst ms | frames >33 ms | frames >50 ms | Tier at the end |
| --- | --- | --- | --- | --- | --- | --- |
| high, desktop, no throttle | 16.8 -> 16.8 | 85.1 -> 17 | 300 -> 17 | 3 -> 0 | 3 -> 0 | high -> high |
| high, desktop, CPU 4x | 41.7 -> 36.7 | 125 -> 41.7 | 367 -> 67 | 111 -> 70 | 21 -> 9 | high -> high |
| high, phone, CPU 4x | 65.1 -> 17 | 193.3 -> 17.1 | 367 -> 17 | 109 -> 0 | 24 -> 0 | high -> high |
| high, phone, CPU 6x | 75 -> 17 | 205 -> 17.1 | 483 -> 34 | 213 -> 1 | 73 -> 0 | high -> high |
| medium, phone, CPU 4x | 16.9 -> 16.9 | 31.9 -> 17.1 | 100 -> 17 | 2 -> 0 | 2 -> 0 | medium -> medium |
| medium, phone, CPU 6x | 18.5 -> 16.8 | 56.8 -> 16.8 | 184 -> 17 | 6 -> 0 | 2 -> 0 | medium -> medium |
| low, phone, CPU 6x | 16.8 -> 17 | 17 -> 17.1 | 50 -> 33 | 2 -> 0 | 0 -> 0 | low -> low |
| Auto, phone, CPU 10x | 51.7 -> 26.7 | 141.7 -> 50 | 350 -> 83 | 80 -> 23 | 31 -> 5 | low -> medium |


Each cell is before -> after, over the ten glides between works (about 100 frames each). Each jump across the museum still has one slow frame (100-180 ms at 6x throttling) at its very start, before the glide clock begins, so nothing is moving yet. These runs measure the main thread and the browser pipeline on a desktop GPU: they do not stand in for a weak phone GPU, which is what dynamic resolution and the degradation ladder are for.

## Image export

Every artwork can be exported as a photograph of the museum: the same 3D scene the visitor walks through, shot from a camera standing at the artwork's spot with the real walls, floor, carpet, lighting, frame and placard. Nothing is invented and nothing is uploaded; the picture is rendered in the browser.

- **Visitors**: one **Download image** button in the viewer. They only pick a format (Story 9:16 at 1080x1920 with the top 250 px and bottom 340 px kept clear, Post 4:5 at 1080x1350, Square 1:1 at 1080x1080). The title appears on the in-scene placard; a small museum watermark sits at the bottom of the safe area.
- **Owners** (studio, artworks list and editor): the same dialog with a few real scene choices: lighting preset, vignette, film grain, watermark and JPEG. The editor exports the unsaved frame and mat choices.
- **Access control**: `museums.theme_overrides.allowVisitorExport` (default `true`) turns visitor downloads off in **Studio > Style > Sharing**. Owners can always export.
- **Share or download**: the Web Share API with a file where supported, otherwise a download named `{museum}-{artwork}-{format}.png`.

How it works (`src/components/gallery/export`, `src/lib/photo`):

```text
ViewerMuseum + artwork -> composePhoto()     (pure: distance, lens shift, safe zones)
                       -> offscreen react-three-fiber root running GalleryScene (export tier, shadows, reflection)
                       -> finishPhoto()      (vignette, grain, watermark on a 2D canvas)
```

- The camera is level and uses a lens shift, so the artwork sits in the middle of the safe area without converging verticals, and a strip of the real floor stays in frame.
- Photos are loaded with CORS (`crossOrigin="anonymous"`) so the canvas stays untainted; the Supabase public bucket sends the headers.
- The scene is rendered with 1.5x supersampling and downscaled; if the device cannot allocate it, it falls back to 1.25x and 1x.

<!-- DEMO: add GIF here -->

## Getting started

Prerequisites: Node.js 20 or newer, npm, and a [Supabase](https://supabase.com) project.

1. Install dependencies.

   ```bash
   npm install
   ```

2. Create a Supabase project and run the migrations in order (SQL editor or `npx supabase db push`):

   1. `supabase/migrations/20261016000000_initial_schema.sql`
   2. `supabase/migrations/20261016120000_museum_theme.sql`
   3. `supabase/migrations/20261017000000_artwork_frame_nullable.sql`
   4. `supabase/migrations/20261018000000_one_museum_per_user.sql` - one museum per user. It stops with an explanation if any user already owns more than one museum (delete or move the extras, then run it again).

   Full walkthrough, including RLS checks: [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

3. Create `.env` (copy `.env.example`) with the values from **Project Settings > API**.

   | Variable | Scope | Used for |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase API URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Anonymous key; access is limited by RLS |
   | `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | Creating and managing accounts, Storage cleanup. Bypasses RLS: never expose it |

4. Create your first user in **Authentication > Users > Add user** (check "Auto Confirm User"), then promote it in the SQL editor:

   ```sql
   update public.profiles
   set role = 'super_admin'
   where email = 'you@example.com';
   ```

5. Start the dev server and sign in at <http://localhost:3000/login>. You land on `/admin`.

   ```bash
   npm run dev
   ```

6. Create a first client at `/admin/clients/new`: email, display name and a generated temporary password. Copy the credentials shown once and give them to the client. They sign in at `/login`, land on `/studio` and create their own museum there. The interface is in Spanish; use the ES/EN switch for English.

Optional: run `supabase/seed.sql` in the SQL editor for a published `demo-museum` (requires a super admin who does not own a museum yet).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run test` | Unit tests with Vitest |

## Deployment

The app deploys to [Vercel](https://vercel.com) as a standard Next.js project.

- Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in the project environment variables. Mark the service role key as a server-side secret.
- Never commit `.env` files. Only `.env.example` (names, no values) belongs in the repository.
- Run the SQL migrations against the production Supabase project before the first deploy.

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Data layer: schema, RLS, auth trigger, storage bucket | Done |
| 2 | Public 2.5D viewer and theming | Done |
| 3 | Museum admin: halls, artworks, appearance, settings, live preview | Done |
| 4 | Super admin: client onboarding and account management | Done |
| 5 | Image export of an artwork (replaced in 6A by real 3D photographs) | Done |
| 6A | Real-time 3D viewer on rails, Spanish/English viewer, 3D admin previews and photo export | Done |
| 6B | Platform admin at `/admin`, owner studio at `/studio`, one museum per user, Spanish-first panels | Done |
| 6C-6D | Quality tiers, category divider walls, mobile fluidity (time-based glides, photo pipeline, degradation ladder), modern entrance wall, richer baked tier | Done |

Known gaps: storage usage per museum is not tracked, and there is no self-service password change for clients yet.

## Contributing

Use [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`) with a short scope when helpful, for example `feat(super): add client list filters`. Keep commits small and focused, run `npm run lint`, `npm run test` and `npm run build` before opening a pull request, and never include secrets.
