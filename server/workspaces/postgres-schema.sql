CREATE TABLE public.showcase_workspace_schema (
  singleton smallint NOT NULL PRIMARY KEY CHECK (singleton = 1),
  schema_version smallint NOT NULL CHECK (schema_version > 0),
  schema_signature varchar(64) COLLATE "C" NOT NULL CHECK (schema_signature ~ '^[a-f0-9]{64}$'),
  shape_signature varchar(64) COLLATE "C" NOT NULL CHECK (shape_signature ~ '^[a-f0-9]{64}$')
);

CREATE TABLE public.showcase_visitor_workspaces (
  id varchar(36) COLLATE "C" NOT NULL PRIMARY KEY CHECK (id ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'),
  token_hash varchar(64) COLLATE "C" NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  origin varchar(300) COLLATE "C" NOT NULL,
  created_ms bigint NOT NULL CHECK (created_ms >= 0),
  expires_ms bigint NOT NULL CHECK (expires_ms <= 8640000000000000),
  changed_count smallint NOT NULL DEFAULT 0 CHECK (changed_count BETWEEN 0 AND 64),
  receipt_count smallint NOT NULL DEFAULT 0 CHECK (receipt_count BETWEEN 0 AND 128),
  CHECK (expires_ms = created_ms + 86400000),
  CHECK (changed_count <= receipt_count)
);
CREATE INDEX workspace_expiry ON public.showcase_visitor_workspaces (expires_ms, id);

CREATE TABLE public.showcase_workspace_sources (
  workspace_id varchar(36) COLLATE "C" NOT NULL,
  source_id varchar(160) COLLATE "C" NOT NULL CHECK (length(source_id) > 0),
  revision smallint NOT NULL CHECK (revision BETWEEN 1 AND 64),
  metadata jsonb NOT NULL CHECK (jsonb_typeof(metadata) = 'object' AND octet_length(metadata::text) <= 16384),
  PRIMARY KEY (workspace_id, source_id),
  CONSTRAINT workspace_source_owner FOREIGN KEY (workspace_id) REFERENCES public.showcase_visitor_workspaces (id) ON DELETE CASCADE
);

CREATE TABLE public.showcase_workspace_receipts (
  workspace_id varchar(36) COLLATE "C" NOT NULL,
  idempotency_key varchar(80) COLLATE "C" NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]{1,80}$'),
  intent_fingerprint varchar(64) COLLATE "C" NOT NULL CHECK (intent_fingerprint ~ '^[a-f0-9]{64}$'),
  event_id varchar(36) COLLATE "C" NOT NULL CHECK (event_id ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'),
  source_id varchar(160) COLLATE "C" NOT NULL CHECK (length(source_id) > 0),
  action varchar(7) COLLATE "C" NOT NULL CHECK (action::text = ANY (ARRAY['save'::text, 'restore'::text])),
  payload_version smallint NOT NULL CHECK (payload_version = 1),
  command_payload jsonb NOT NULL CHECK (jsonb_typeof(command_payload) = 'object' AND octet_length(command_payload::text) <= 16384),
  actor jsonb NOT NULL CHECK (jsonb_typeof(actor) = 'object' AND octet_length(actor::text) <= 1024),
  accepted_ms bigint NOT NULL CHECK (accepted_ms BETWEEN 0 AND 8640000000000000),
  expected_revision smallint NOT NULL CHECK (expected_revision BETWEEN 0 AND 64),
  result_revision smallint NOT NULL CHECK (result_revision BETWEEN 0 AND 64),
  changed smallint NOT NULL CHECK (changed IN (0, 1)),
  result_metadata jsonb NOT NULL CHECK (jsonb_typeof(result_metadata) = 'object' AND octet_length(result_metadata::text) <= 16384),
  PRIMARY KEY (workspace_id, idempotency_key),
  UNIQUE (workspace_id, event_id),
  CONSTRAINT workspace_receipt_owner FOREIGN KEY (workspace_id) REFERENCES public.showcase_visitor_workspaces (id) ON DELETE CASCADE,
  CHECK (result_revision = expected_revision + changed)
);
CREATE INDEX source_history ON public.showcase_workspace_receipts (workspace_id, source_id, changed, result_revision DESC);
