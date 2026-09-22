-- ============================================================================
-- Instrumentation: nothing recorded when video.asset.ready actually fired,
-- only assets.created_at (upload start). Without this there's no way to
-- measure real Mux transcode time vs. anything else in the upload pipeline.
-- ============================================================================

alter table assets add column if not exists mux_ready_at timestamptz;
