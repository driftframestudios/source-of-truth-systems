CREATE TABLE showcase_workspace_schema (
  singleton TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  schema_version SMALLINT UNSIGNED NOT NULL,
  schema_signature CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  CHECK (singleton = 1)
) ENGINE=InnoDB;

CREATE TABLE showcase_visitor_workspaces (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  origin VARCHAR(300) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_ms BIGINT UNSIGNED NOT NULL,
  expires_ms BIGINT UNSIGNED NOT NULL,
  changed_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  receipt_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY workspace_token (token_hash),
  KEY workspace_expiry (expires_ms, id),
  CHECK (expires_ms = created_ms + 86400000),
  CHECK (changed_count <= 64),
  CHECK (receipt_count <= 128)
) ENGINE=InnoDB;

CREATE TABLE showcase_workspace_sources (
  workspace_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source_id VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  revision SMALLINT UNSIGNED NOT NULL,
  metadata JSON NOT NULL,
  PRIMARY KEY (workspace_id, source_id),
  CONSTRAINT workspace_source_owner FOREIGN KEY (workspace_id) REFERENCES showcase_visitor_workspaces (id) ON DELETE CASCADE,
  CHECK (revision BETWEEN 1 AND 64),
  CHECK (JSON_TYPE(metadata) = 'OBJECT' AND JSON_STORAGE_SIZE(metadata) <= 16384)
) ENGINE=InnoDB;

CREATE TABLE showcase_workspace_receipts (
  workspace_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  idempotency_key VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  intent_fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source_id VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  action VARCHAR(7) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  payload_version TINYINT UNSIGNED NOT NULL,
  command_payload JSON NOT NULL,
  actor JSON NOT NULL,
  accepted_ms BIGINT UNSIGNED NOT NULL,
  expected_revision SMALLINT UNSIGNED NOT NULL,
  result_revision SMALLINT UNSIGNED NOT NULL,
  changed TINYINT UNSIGNED NOT NULL,
  result_metadata JSON NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key),
  UNIQUE KEY workspace_event (workspace_id, event_id),
  KEY source_history (workspace_id, source_id, changed, result_revision),
  CONSTRAINT workspace_receipt_owner FOREIGN KEY (workspace_id) REFERENCES showcase_visitor_workspaces (id) ON DELETE CASCADE,
  CHECK (action IN ('save', 'restore')),
  CHECK (payload_version = 1),
  CHECK (changed IN (0, 1)),
  CHECK (expected_revision <= 64 AND result_revision = expected_revision + changed AND result_revision <= 64),
  CHECK (JSON_TYPE(command_payload) = 'OBJECT' AND JSON_STORAGE_SIZE(command_payload) <= 16384),
  CHECK (JSON_TYPE(actor) = 'OBJECT' AND JSON_STORAGE_SIZE(actor) <= 1024),
  CHECK (JSON_TYPE(result_metadata) = 'OBJECT' AND JSON_STORAGE_SIZE(result_metadata) <= 16384)
) ENGINE=InnoDB;
