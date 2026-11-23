-- Migration 004: map local photo UUIDs and metadata onto private remote originals.
-- Safe to execute repeatedly on an existing Memrly PostgreSQL volume.
ALTER TABLE media ADD COLUMN IF NOT EXISTS client_photo_id uuid;
ALTER TABLE media ADD COLUMN IF NOT EXISTS client_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS media_album_client_photo_id_uq
  ON media(album_id,client_photo_id) WHERE client_photo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS media_album_client_sync_idx
  ON media(album_id,created_at) WHERE client_photo_id IS NOT NULL AND deleted_at IS NULL;

-- Safely expose originals uploaded through the older REST endpoint in the new
-- server-first gallery. Their original media UUID becomes the stable photo ID.
-- Idempotent: never alters rows already associated with a client photo UUID.
UPDATE media AS m
SET client_photo_id = m.id,
    client_metadata = jsonb_strip_nulls(jsonb_build_object(
      'id',m.id::text,
      'filename',f.filename,
      'mimeType',f.mime_type,
      'size',f.size_bytes,
      'hash',COALESCE(f.sha256::text,''),
      'takenOn',m.captured_local_date::text,
      'dateSource',m.date_source,
      'place',COALESCE((SELECT p.name FROM places p
                         WHERE p.id=m.place_id AND p.album_id=m.album_id),''),
      'latitude',m.latitude,
      'longitude',m.longitude,
      'description',m.description,
      'favorite',m.favorite,
      'createdAt',m.created_at::text,
      'memoryIds',COALESCE((SELECT jsonb_agg(mm.memory_id::text) FROM memory_media mm
                            WHERE mm.media_id=m.id AND mm.album_id=m.album_id),'[]'::jsonb),
      'subjectIds',COALESCE((SELECT jsonb_agg(ms.subject_id::text) FROM media_subjects ms
                             WHERE ms.media_id=m.id AND ms.album_id=m.album_id),'[]'::jsonb)
    ))
FROM original_files AS f
WHERE m.original_file_id=f.id AND m.album_id=f.album_id
  AND m.client_photo_id IS NULL AND m.deleted_at IS NULL AND m.kind='photo';
