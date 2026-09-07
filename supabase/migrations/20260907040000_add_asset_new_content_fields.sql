-- ============================================================================
-- New Content flow (admin-only content requests)
--
-- Adds metadata fields for a placeholder asset created before any file
-- exists - the admin fills these in via the "+ New" form, and an assigned
-- editor later uploads a cut to fulfill it (attaches to the same row).
-- All nullable: every existing asset and upload path is unaffected.
-- ============================================================================

alter table assets
  add column if not exists raw_file_url text,
  add column if not exists notes text,
  add column if not exists reference text,
  add column if not exists deadline date;
