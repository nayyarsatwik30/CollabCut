-- ============================================================================
-- assets.mux_upload_id has no covering index (confirmed via pg_indexes),
-- so the Mux webhook's UPDATE ... WHERE mux_upload_id = $1 falls back to a
-- sequential scan on every asset.ready/asset.errored event. Harmless at
-- today's row counts, but an unindexed exact-match lookup on an
-- externally-triggered write path won't stay cheap as the table grows.
-- ============================================================================

create index if not exists assets_mux_upload_id_idx on assets (mux_upload_id);
