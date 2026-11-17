-- PostgreSQL catalog v1. Explicit initialization owns all DDL, seed and markers
-- in one transaction. Opaque identities use deterministic case-sensitive C equality.
-- Metadata checks bound canonical JSON text (not jsonb physical storage). The shared
-- decoder applies the stricter logical compact UTF-8 budgets of 16/64 KiB, including
-- reconstructed relationships. The SQL cap allows JSON serializer whitespace.
CREATE TABLE public.showcase_catalog (
  singleton smallint PRIMARY KEY CHECK (singleton = 1),
  schema_version integer NOT NULL CHECK (schema_version > 0),
  schema_signature varchar(64) COLLATE "C" NOT NULL CHECK (schema_signature ~ '^[0-9a-f]{64}$'),
  shape_signature varchar(64) COLLATE "C" NOT NULL CHECK (shape_signature ~ '^[0-9a-f]{64}$'),
  seed_version integer NOT NULL CHECK (seed_version > 0),
  seed_signature varchar(64) COLLATE "C" NOT NULL CHECK (seed_signature ~ '^[0-9a-f]{64}$')
);

CREATE TABLE public.showcase_plates (
  id varchar(160) COLLATE "C" PRIMARY KEY CHECK (length(id) > 0),
  singleton smallint NOT NULL DEFAULT 1 UNIQUE CHECK (singleton = 1),
  as_of varchar(32) NOT NULL,
  rows_count smallint NOT NULL DEFAULT 8 CHECK (rows_count = 8),
  columns_count smallint NOT NULL DEFAULT 12 CHECK (columns_count = 12)
);

CREATE TABLE public.showcase_wells (
  plate_id varchar(160) COLLATE "C" NOT NULL,
  id varchar(3) COLLATE "C" NOT NULL,
  row_index smallint NOT NULL CHECK (row_index BETWEEN 0 AND 7),
  column_index smallint NOT NULL CHECK (column_index BETWEEN 0 AND 11),
  metadata jsonb NOT NULL,
  PRIMARY KEY (plate_id, id),
  CONSTRAINT showcase_well_position UNIQUE (plate_id, row_index, column_index),
  CONSTRAINT showcase_well_plate FOREIGN KEY (plate_id) REFERENCES public.showcase_plates (id),
  CONSTRAINT showcase_well_coordinate CHECK (id = chr(65 + row_index) || (column_index + 1)::text),
  CONSTRAINT showcase_well_metadata CHECK (jsonb_typeof(metadata) = 'object' AND octet_length(metadata::text) <= 32768)
);

CREATE TABLE public.showcase_results (
  id varchar(160) COLLATE "C" PRIMARY KEY CHECK (length(id) > 0),
  anchor_plate_id varchar(160) COLLATE "C" NOT NULL,
  well_id varchar(3) COLLATE "C" NOT NULL,
  sequence_index smallint NOT NULL CHECK (sequence_index BETWEEN 0 AND 49),
  supersedes_id varchar(160) COLLATE "C",
  supersedes_sequence smallint,
  metadata jsonb NOT NULL,
  CONSTRAINT showcase_result_position UNIQUE (anchor_plate_id, well_id, sequence_index),
  CONSTRAINT showcase_result_scope UNIQUE (anchor_plate_id, well_id, id, sequence_index),
  CONSTRAINT showcase_result_well FOREIGN KEY (anchor_plate_id, well_id) REFERENCES public.showcase_wells (plate_id, id),
  CONSTRAINT showcase_result_supersedes FOREIGN KEY (anchor_plate_id, well_id, supersedes_id, supersedes_sequence)
    REFERENCES public.showcase_results (anchor_plate_id, well_id, id, sequence_index),
  CONSTRAINT showcase_result_predecessor CHECK ((supersedes_id IS NULL AND supersedes_sequence IS NULL) OR
    (supersedes_id IS NOT NULL AND supersedes_sequence IS NOT NULL AND supersedes_sequence < sequence_index)),
  CONSTRAINT showcase_result_metadata CHECK (jsonb_typeof(metadata) = 'object' AND octet_length(metadata::text) <= 131072)
);

CREATE TABLE public.showcase_files (
  object_key varchar(512) COLLATE "C" PRIMARY KEY CHECK (length(object_key) > 0),
  metadata jsonb NOT NULL,
  CONSTRAINT showcase_file_metadata CHECK (jsonb_typeof(metadata) = 'object' AND octet_length(metadata::text) <= 32768)
);

CREATE TABLE public.showcase_artifacts (
  result_id varchar(160) COLLATE "C" NOT NULL,
  ordinal smallint NOT NULL CHECK (ordinal BETWEEN 0 AND 7),
  object_key varchar(512) COLLATE "C" NOT NULL,
  anchor_plate_id varchar(160) COLLATE "C" NOT NULL,
  well_id varchar(3) COLLATE "C" NOT NULL,
  result_sequence smallint NOT NULL,
  reused_from_id varchar(160) COLLATE "C",
  reused_sequence smallint,
  metadata jsonb NOT NULL,
  PRIMARY KEY (result_id, ordinal),
  CONSTRAINT showcase_artifact_file UNIQUE (result_id, object_key),
  CONSTRAINT showcase_artifact_result FOREIGN KEY (anchor_plate_id, well_id, result_id, result_sequence)
    REFERENCES public.showcase_results (anchor_plate_id, well_id, id, sequence_index),
  CONSTRAINT showcase_artifact_object FOREIGN KEY (object_key) REFERENCES public.showcase_files (object_key),
  CONSTRAINT showcase_artifact_origin_scope FOREIGN KEY (anchor_plate_id, well_id, reused_from_id, reused_sequence)
    REFERENCES public.showcase_results (anchor_plate_id, well_id, id, sequence_index),
  CONSTRAINT showcase_artifact_origin_file FOREIGN KEY (reused_from_id, object_key)
    REFERENCES public.showcase_artifacts (result_id, object_key),
  CONSTRAINT showcase_artifact_predecessor CHECK ((reused_from_id IS NULL AND reused_sequence IS NULL) OR
    (reused_from_id IS NOT NULL AND reused_sequence IS NOT NULL AND reused_sequence < result_sequence)),
  CONSTRAINT showcase_artifact_metadata CHECK (jsonb_typeof(metadata) = 'object' AND octet_length(metadata::text) <= 32768)
);
