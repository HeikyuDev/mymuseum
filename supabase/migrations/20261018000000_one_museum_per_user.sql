-- One museum per user.
--
-- Every account owns exactly one museum, created by the user on first sign-in.
-- This adds a UNIQUE index on museums.owner_id so the database enforces it.
--
-- The migration is idempotent and safe: if any user already owns more than one
-- museum it stops with an explanation instead of failing half way, and nothing
-- is changed. Resolve the duplicates, then run it again.

do $$
declare
  duplicated_owners integer;
begin
  select count(*) into duplicated_owners
  from (
    select owner_id
    from public.museums
    group by owner_id
    having count(*) > 1
  ) as duplicates;

  if duplicated_owners > 0 then
    raise exception
      using
        message = format(
          'Cannot enforce one museum per user: %s owner(s) have more than one museum.',
          duplicated_owners
        ),
        hint = 'List them with: select owner_id, count(*) as museums, array_agg(slug) as slugs from public.museums group by owner_id having count(*) > 1;  Then delete the extra museums (or move them to another owner) and run this migration again.';
  end if;
end
$$;

create unique index if not exists museums_owner_id_key on public.museums (owner_id);

-- The unique index above also serves lookups by owner, so the plain index is redundant.
drop index if exists public.museums_owner_id_idx;
