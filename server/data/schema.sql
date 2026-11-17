-- Owned showcase catalog. The explicit initializer writes its completion marker
-- in the same transaction as the complete seed. Runtime requests never run this file.
CREATE TABLE IF NOT EXISTS showcase_catalog (
  singleton TINYINT NOT NULL PRIMARY KEY,
  schema_version INT NOT NULL,
  schema_signature CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  CHECK (singleton = 1)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS showcase_plates (
  id VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
  singleton TINYINT NOT NULL DEFAULT 1 UNIQUE,
  as_of VARCHAR(32) NOT NULL,
  rows_count TINYINT NOT NULL DEFAULT 8,
  columns_count TINYINT NOT NULL DEFAULT 12,
  CHECK (singleton = 1 AND rows_count = 8 AND columns_count = 12)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS showcase_wells (
  plate_id VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  id VARCHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  row_index TINYINT NOT NULL,
  column_index TINYINT NOT NULL,
  metadata JSON NOT NULL,
  PRIMARY KEY (plate_id, id),
  UNIQUE KEY showcase_well_position (plate_id, row_index, column_index),
  CONSTRAINT showcase_well_plate FOREIGN KEY (plate_id) REFERENCES showcase_plates (id),
  CHECK (row_index BETWEEN 0 AND 7 AND column_index BETWEEN 0 AND 11),
  CHECK (id = CONCAT(CHAR(65 + row_index), column_index + 1)),
  CHECK (JSON_TYPE(metadata) = 'OBJECT' AND JSON_STORAGE_SIZE(metadata) <= 16384)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS showcase_results (
  id VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
  anchor_plate_id VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  well_id VARCHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  sequence_index TINYINT NOT NULL,
  supersedes_id VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  supersedes_sequence TINYINT,
  metadata JSON NOT NULL,
  UNIQUE KEY showcase_result_position (anchor_plate_id, well_id, sequence_index),
  UNIQUE KEY showcase_result_scope (anchor_plate_id, well_id, id, sequence_index),
  CONSTRAINT showcase_result_well FOREIGN KEY (anchor_plate_id, well_id) REFERENCES showcase_wells (plate_id, id),
  CONSTRAINT showcase_result_supersedes FOREIGN KEY (anchor_plate_id, well_id, supersedes_id, supersedes_sequence)
    REFERENCES showcase_results (anchor_plate_id, well_id, id, sequence_index),
  CHECK (sequence_index BETWEEN 0 AND 49),
  CHECK ((supersedes_id IS NULL AND supersedes_sequence IS NULL) OR
    (supersedes_id IS NOT NULL AND supersedes_sequence IS NOT NULL AND supersedes_sequence < sequence_index)),
  CHECK (JSON_TYPE(metadata) = 'OBJECT' AND JSON_STORAGE_SIZE(metadata) <= 65536)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS showcase_files (
  object_key VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
  metadata JSON NOT NULL,
  CHECK (JSON_TYPE(metadata) = 'OBJECT' AND JSON_STORAGE_SIZE(metadata) <= 16384)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS showcase_artifacts (
  result_id VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  ordinal TINYINT NOT NULL,
  object_key VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  anchor_plate_id VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  well_id VARCHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  result_sequence TINYINT NOT NULL,
  reused_from_id VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  reused_sequence TINYINT,
  metadata JSON NOT NULL,
  PRIMARY KEY (result_id, ordinal),
  UNIQUE KEY showcase_artifact_file (result_id, object_key),
  CONSTRAINT showcase_artifact_result FOREIGN KEY (anchor_plate_id, well_id, result_id, result_sequence)
    REFERENCES showcase_results (anchor_plate_id, well_id, id, sequence_index),
  CONSTRAINT showcase_artifact_object FOREIGN KEY (object_key) REFERENCES showcase_files (object_key),
  CONSTRAINT showcase_artifact_origin_scope FOREIGN KEY (anchor_plate_id, well_id, reused_from_id, reused_sequence)
    REFERENCES showcase_results (anchor_plate_id, well_id, id, sequence_index),
  CONSTRAINT showcase_artifact_origin_file FOREIGN KEY (reused_from_id, object_key)
    REFERENCES showcase_artifacts (result_id, object_key),
  CHECK (ordinal BETWEEN 0 AND 7),
  CHECK (JSON_TYPE(metadata) = 'OBJECT' AND JSON_STORAGE_SIZE(metadata) <= 16384),
  CHECK ((reused_from_id IS NULL AND reused_sequence IS NULL) OR
    (reused_from_id IS NOT NULL AND reused_sequence IS NOT NULL AND reused_sequence < result_sequence))
) ENGINE=InnoDB;
