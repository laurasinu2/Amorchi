-- Server-authoritative entities for all non-photo Memrly data.
-- Re-runnable; no local or server content is deleted.
CREATE TABLE IF NOT EXISTS client_entities (
  album_id uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('memory','subject','collection','settings')),
  client_id text NOT NULL CHECK (length(client_id) BETWEEN 1 AND 96),
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (album_id,kind,client_id)
);
CREATE INDEX IF NOT EXISTS client_entities_active_idx
  ON client_entities(album_id,kind) WHERE deleted_at IS NULL;
