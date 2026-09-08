-- ============================================================================
-- Notifications: add asset_id for reference
--
-- The `notifications` table already existed in the database (created outside
-- tracked migrations - see the FK audit) with: id, user_id -> profiles(id),
-- type, message, link, read (boolean, default false), created_at. This adds
-- the one column it was missing for the 4 notification triggers - a nullable
-- back-reference to the asset a notification is about, so a click can be
-- resolved even if `link` needs to change shape later.
-- ============================================================================

alter table notifications
  add column if not exists asset_id uuid references assets(id) on delete set null;

create index if not exists notifications_user_id_read_idx on notifications (user_id, read);
