CREATE TABLE auth_credentials (
  id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Email verification + single active session; see
  -- migration-email-verification-session.sql.
  email_verified_at timestamptz,
  email_verification_token_hash text,
  email_verification_expires timestamptz,
  current_session_token text
);

CREATE INDEX idx_auth_credentials_email ON auth_credentials (email);
