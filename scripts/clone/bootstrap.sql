-- The image entry runs this once for an empty, project-owned volume. Later
-- migrations use the ordinary owner and the explicit Node initializer.
\getenv owner_password SOT_OWNER_PASSWORD
\getenv runtime_password SOT_RUNTIME_PASSWORD
CREATE ROLE sot_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'owner_password';
CREATE ROLE sot_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'runtime_password';
ALTER DATABASE sot_example OWNER TO sot_owner;
REVOKE ALL ON DATABASE sot_example FROM PUBLIC;
GRANT CONNECT ON DATABASE sot_example TO sot_owner, sot_runtime;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO sot_owner;
GRANT USAGE ON SCHEMA public TO sot_runtime;
