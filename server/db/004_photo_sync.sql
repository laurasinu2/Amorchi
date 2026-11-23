-- Migration 004: map local photo UUIDs and metadata onto private remote originals.
-- Safe to execute repeatedly on an existing Memrly PostgreSQL volume.
ALTER TABLE media ADD COLUMN IF NOT EXISTS client_photo_id uuid;
ALTER TABLE media ADD COLUMN IF NOT EXISTS client_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS media_album_client_photo_id_uq
  ON media(album_id,client_photo_id) WHERE client_photo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS media_album_client_sync_idx
  ON media(album_id,created_at) WHERE client_photo_id IS NOT NULL AND deleted_at IS NULL;
