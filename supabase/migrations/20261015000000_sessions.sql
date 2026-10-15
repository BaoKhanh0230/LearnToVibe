-- Server-only credentials; never expose Google sessions through the Data API.
CREATE TABLE IF NOT EXISTS public.vibelog_sessions (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  revision TEXT NOT NULL,
  expires_at BIGINT NOT NULL
);
ALTER TABLE public.vibelog_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.vibelog_sessions FROM anon, authenticated;
-- VibeLog connects server-side using a database role with table access.
