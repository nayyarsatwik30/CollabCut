-- share_links now represents a whole version lineage (asset_group_id) rather
-- than one pinned asset row, so a link automatically picks up new versions
-- uploaded after it was created instead of going stale. asset_id is left in
-- place (still NOT NULL, still whichever version was current when the link
-- was made) as a harmless audit trail - all lookup/reuse/auth logic below
-- keys off asset_group_id instead.

alter table share_links
  add column if not exists asset_group_id uuid;

update share_links sl
set asset_group_id = coalesce(a.asset_group_id, a.id)
from assets a
where a.id = sl.asset_id
  and sl.asset_group_id is null;

alter table share_links
  alter column asset_group_id set not null;

create index if not exists share_links_asset_group_id_idx on share_links (asset_group_id);
