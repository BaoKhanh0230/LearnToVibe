-- Server-only table: no Supabase Data API access, and no service_role key in the browser.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vibelog_user') THEN
    CREATE ROLE vibelog_user NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
GRANT vibelog_user TO CURRENT_USER;
CREATE TABLE IF NOT EXISTS public.vibelog_user_data (
  user_id text PRIMARY KEY CHECK (user_id ~ '^[a-f0-9]{64}$'),
  version integer NOT NULL CHECK (version > 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 65536)
);
ALTER TABLE public.vibelog_user_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vibelog_user_data FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.vibelog_user_data FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO vibelog_user;
GRANT SELECT, INSERT, UPDATE ON public.vibelog_user_data TO vibelog_user;
DROP POLICY IF EXISTS owner_data ON public.vibelog_user_data;
CREATE POLICY owner_data ON public.vibelog_user_data FOR ALL TO vibelog_user
  USING (user_id = current_setting('vibelog.user_id', true))
  WITH CHECK (user_id = current_setting('vibelog.user_id', true));
COMMIT;
