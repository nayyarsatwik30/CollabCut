-- Self-service password reset. Idempotent - safe to run more than once.
-- All columns live on auth_credentials (login concerns), like the email
-- verification columns.
--   reset_token_hash        SHA-256 of the emailed token (raw token never stored)
--   reset_token_expires_at  1 hour after the token was issued
--   reset_requested_at      last time a reset was issued; drives the 60s cooldown

ALTER TABLE auth_credentials ADD COLUMN IF NOT EXISTS reset_token_hash text;
ALTER TABLE auth_credentials ADD COLUMN IF NOT EXISTS reset_token_expires_at timestamptz;
ALTER TABLE auth_credentials ADD COLUMN IF NOT EXISTS reset_requested_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_auth_credentials_reset_token_hash
  ON auth_credentials (reset_token_hash);
