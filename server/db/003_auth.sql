-- Apply once to EXISTING PostgreSQL installations before deploying the new API.
-- New databases get these objects as a separate migration, too.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
CREATE TABLE IF NOT EXISTS account_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify','reset')),
  code_hash char(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS account_codes_lookup ON account_codes(user_id, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS device_sessions_user_idx ON device_sessions(user_id, expires_at);
