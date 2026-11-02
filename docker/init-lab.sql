-- Compatibility roles referenced by the existing application schema.
-- This database is a local teaching environment, not Supabase.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE vibelog_user NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE vibelog_lab_app LOGIN PASSWORD 'local-learning-only' NOSUPERUSER NOBYPASSRLS;
GRANT vibelog_user TO vibelog_lab_app;
CREATE TABLE public.vibelog_sessions (
  id TEXT PRIMARY KEY, payload TEXT NOT NULL, revision TEXT NOT NULL, expires_at BIGINT NOT NULL
);
GRANT USAGE ON SCHEMA public TO vibelog_lab_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vibelog_sessions TO vibelog_lab_app;
