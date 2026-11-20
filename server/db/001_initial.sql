-- Amorchi: esquema PostgreSQL v1.
-- Solo se aplica automáticamente cuando el volumen PostgreSQL está vacío.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE memory_kind AS ENUM ('trip', 'event', 'moment');
CREATE TYPE album_role AS ENUM ('owner', 'editor', 'viewer');
CREATE TYPE media_kind AS ENUM ('photo', 'video');
CREATE TYPE variant_kind AS ENUM ('preview', 'thumbnail');

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz
);
CREATE TABLE albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  started_on date,
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE album_members (
  album_id uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role album_role NOT NULL DEFAULT 'viewer',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (album_id, user_id)
);
CREATE TABLE subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('person','animal')),
  name text NOT NULL,
  linked_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  species text,
  birthday date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (album_id, id)
);
CREATE TABLE places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  name text NOT NULL,
  locality text,
  region text,
  country text,
  latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (album_id, id),
  CHECK ((latitude IS NULL) = (longitude IS NULL))
);
CREATE TABLE memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  kind memory_kind NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  parent_id uuid,
  main_place_id uuid,
  favorite boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (album_id, id),
  CHECK (ends_on >= starts_on),
  FOREIGN KEY (album_id, parent_id) REFERENCES memories(album_id, id),
  FOREIGN KEY (album_id, main_place_id) REFERENCES places(album_id, id)
);
CREATE TABLE memory_places (
  album_id uuid NOT NULL,
  memory_id uuid NOT NULL,
  place_id uuid NOT NULL,
  stop_order integer NOT NULL DEFAULT 0,
  arrived_on date,
  departed_on date,
  PRIMARY KEY (memory_id, place_id),
  FOREIGN KEY (album_id, memory_id) REFERENCES memories(album_id, id) ON DELETE CASCADE,
  FOREIGN KEY (album_id, place_id) REFERENCES places(album_id, id) ON DELETE CASCADE,
  CHECK (departed_on IS NULL OR arrived_on IS NULL OR departed_on >= arrived_on)
);
CREATE TABLE original_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  sha256 char(64),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (album_id, id)
);
CREATE UNIQUE INDEX original_files_dedupe ON original_files(album_id, sha256) WHERE sha256 IS NOT NULL;
CREATE TABLE file_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES original_files(id) ON DELETE CASCADE,
  kind variant_kind NOT NULL,
  object_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  width integer CHECK (width > 0),
  height integer CHECK (height > 0),
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  UNIQUE (file_id, kind)
);
CREATE TABLE media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  original_file_id uuid NOT NULL,
  kind media_kind NOT NULL DEFAULT 'photo',
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  captured_at timestamptz,
  captured_local_date date NOT NULL,
  date_source text NOT NULL CHECK (date_source IN ('exif', 'file', 'manual')),
  place_id uuid,
  latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  favorite boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (album_id, id),
  FOREIGN KEY (album_id, original_file_id) REFERENCES original_files(album_id, id),
  FOREIGN KEY (album_id, place_id) REFERENCES places(album_id, id),
  CHECK ((latitude IS NULL) = (longitude IS NULL))
);
CREATE TABLE memory_media (
  album_id uuid NOT NULL,
  memory_id uuid NOT NULL,
  media_id uuid NOT NULL,
  PRIMARY KEY (memory_id, media_id),
  FOREIGN KEY (album_id, memory_id) REFERENCES memories(album_id, id) ON DELETE CASCADE,
  FOREIGN KEY (album_id, media_id) REFERENCES media(album_id, id) ON DELETE CASCADE
);
CREATE TABLE media_subjects (
  album_id uuid NOT NULL,
  media_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  PRIMARY KEY (media_id, subject_id),
  FOREIGN KEY (album_id, media_id) REFERENCES media(album_id, id) ON DELETE CASCADE,
  FOREIGN KEY (album_id, subject_id) REFERENCES subjects(album_id, id) ON DELETE CASCADE
);
CREATE TABLE memory_subjects (
  album_id uuid NOT NULL,
  memory_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  PRIMARY KEY (memory_id, subject_id),
  FOREIGN KEY (album_id, memory_id) REFERENCES memories(album_id, id) ON DELETE CASCADE,
  FOREIGN KEY (album_id, subject_id) REFERENCES subjects(album_id, id) ON DELETE CASCADE
);
CREATE TABLE device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  device_name text NOT NULL,
  refresh_token_hash char(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE TABLE album_changes (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  album_id uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('upsert','delete')),
  entity_version bigint NOT NULL,
  operation_id uuid NOT NULL UNIQUE,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE device_cursors (
  album_id uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  device_session_id uuid NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,
  last_sequence bigint NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (album_id, device_session_id)
);
CREATE INDEX media_album_date_idx ON media(album_id, captured_local_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX memories_album_dates_idx ON memories(album_id, starts_on, ends_on) WHERE deleted_at IS NULL;
CREATE INDEX album_changes_since_idx ON album_changes(album_id, sequence);
CREATE INDEX memory_places_order_idx ON memory_places(memory_id, stop_order);
CREATE INDEX media_subjects_subject_idx ON media_subjects(subject_id, media_id);
CREATE INDEX original_files_album_idx ON original_files(album_id);
-- Futuros endpoints deben comprobar autorización por album_members y versiones,
-- y emitir album_changes EN LA MISMA TRANSACCIÓN que los cambios de entidades.
