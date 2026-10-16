# Supabase Setup

## 1. Create the project
1. Go to https://supabase.com/dashboard and create a new project.
2. Save the database password somewhere safe (the app does not use it).

## 2. Run the migrations
Run the files in `supabase/migrations/` in this order:

1. `20261016000000_initial_schema.sql` - tables, RLS, helper functions, auth trigger, `artworks` bucket.
2. `20261016120000_museum_theme.sql` - museum theme preset/overrides, hall floor decorations and decor bag.
3. `20261017000000_artwork_frame_nullable.sql` - artworks may inherit the hall's default frame style.

Option A, SQL editor: open **SQL Editor**, paste each file in order and click **Run**.

Option B, CLI:
```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This creates `profiles`, `museums`, `halls`, `artworks`, RLS policies, helper
functions, the auth trigger and the `artworks` storage bucket.

## 3. Confirm the storage bucket
**Storage** should list a bucket named `artworks`: public, 10 MB limit, allowed
types jpeg, png, webp, avif. Files must be uploaded under `{museum_id}/...`.

## 4. Copy the environment keys
In **Project Settings > API**, copy the values into `.env` (see `.env.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # server-only, never expose to the browser
```

## 5. Create the first user and promote it
1. **Authentication > Users > Add user**: enter an email and password, check
   "Auto Confirm User". A profile row is created automatically with role `owner`.
2. Promote it in the SQL editor:

```sql
update public.profiles
set role = 'super_admin'
where email = 'you@example.com';
```

## 6. Optional demo data
After step 5, run `supabase/seed.sql` in the SQL editor. It creates a published
`demo-museum` with the halls "Family" and "Friends". It does nothing if no
super admin exists.

## 7. Verify RLS
- Anonymous (anon key) can read only published museums, visible halls and active artworks:
  ```sql
  set local role anon;
  select slug, is_published from public.museums;   -- only published rows
  select * from public.profiles;                    -- 0 rows
  ```
- An owner cannot escalate: while logged in as an owner,
  `update profiles set role = 'super_admin' where id = auth.uid()` must fail.
- An owner cannot read or write another owner's museum, halls, artworks or
  storage folder.

## Notes
- Deleting a hall keeps its artworks (`hall_id` becomes null).
- Client accounts are created from the super admin area (`/super/clients/new`); the service role key must be set for that.
