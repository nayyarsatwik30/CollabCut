-- Email verification + single active session per account. Idempotent - safe
-- to run more than once. Take a fresh backup (node scripts/db-backup/backup.js)
-- before running.
--
-- All four columns live on auth_credentials (login concerns), not profiles,
-- so they stay out of every profile query in the app.
--   email_verified_at              null = unverified; login is rejected
--   email_verification_token_hash  SHA-256 of the emailed token (the raw
--                                  token is never stored)
--   email_verification_expires     24h after the token was issued
--   current_session_token          the one session token that is valid for
--                                  this account; replaced on every login

-- Existing accounts predate verification: treat them as verified so nobody is
-- locked out. The backfill runs only on the run that creates email_verified_at,
-- so re-running this file later never marks a genuinely unverified signup as
-- verified.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'auth_credentials' AND column_name = 'email_verified_at'
  ) THEN
    ALTER TABLE auth_credentials ADD COLUMN email_verified_at timestamptz;
    UPDATE auth_credentials SET email_verified_at = created_at;
  END IF;
END $$;

ALTER TABLE auth_credentials ADD COLUMN IF NOT EXISTS email_verification_token_hash text;
ALTER TABLE auth_credentials ADD COLUMN IF NOT EXISTS email_verification_expires timestamptz;
ALTER TABLE auth_credentials ADD COLUMN IF NOT EXISTS current_session_token text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_credentials_verification_token
  ON auth_credentials (email_verification_token_hash)
  WHERE email_verification_token_hash IS NOT NULL;
