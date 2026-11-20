-- Preferencias de álbum, portadas y cumpleaños: sin duplicar una fila por año.
-- Migración independiente e idempotente para instalaciones que ya tienen datos.
BEGIN;

CREATE TABLE IF NOT EXISTS album_preferences (
  album_id uuid PRIMARY KEY REFERENCES albums(id) ON DELETE CASCADE,
  relationship_started_on date,
  self_name text NOT NULL DEFAULT 'Yo',
  self_birthday date,
  partner_name text NOT NULL DEFAULT 'Mi pareja',
  partner_birthday date,
  home_cover_media_id uuid,
  version bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (album_id, home_cover_media_id) REFERENCES media(album_id, id)
);

CREATE TABLE IF NOT EXISTS album_year_covers (
  album_id uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year BETWEEN 1 AND 9999),
  media_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (album_id, year),
  FOREIGN KEY (album_id, media_id) REFERENCES media(album_id, id)
);

CREATE TABLE IF NOT EXISTS important_birthdays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  birth_date date NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (album_id, id)
);
CREATE INDEX IF NOT EXISTS important_birthdays_album_idx
  ON important_birthdays(album_id) WHERE deleted_at IS NULL;

ALTER TABLE memories ADD COLUMN IF NOT EXISTS cover_media_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'memories'::regclass AND conname = 'memories_cover_media_album_fkey'
  ) THEN
    ALTER TABLE memories
      ADD CONSTRAINT memories_cover_media_album_fkey
      FOREIGN KEY (album_id, cover_media_id) REFERENCES media(album_id,id);
  END IF;
END $$;

COMMIT;
