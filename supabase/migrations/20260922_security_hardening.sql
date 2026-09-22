-- Security hardening for the public API and profile/attachment inputs.

-- 1) Persistent, atomic registration rate limiting for serverless deployments.
CREATE TABLE IF NOT EXISTS public.registration_rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);

ALTER TABLE public.registration_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_registration_rate_limit(
  p_key TEXT,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_seconds INTEGER DEFAULT 900
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT := left(COALESCE(NULLIF(trim(p_key), ''), 'unknown-client'), 200);
  v_attempts INTEGER;
BEGIN
  IF p_max_attempts < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'Invalid rate-limit configuration';
  END IF;

  INSERT INTO public.registration_rate_limits (rate_key, window_started_at, attempts)
  VALUES (v_key, now(), 1)
  ON CONFLICT (rate_key) DO UPDATE
  SET
    attempts = CASE
      WHEN public.registration_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        THEN 1
      ELSE public.registration_rate_limits.attempts + 1
    END,
    window_started_at = CASE
      WHEN public.registration_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        THEN now()
      ELSE public.registration_rate_limits.window_started_at
    END
  RETURNING attempts INTO v_attempts;

  RETURN v_attempts > p_max_attempts;
END;
$$;

REVOKE ALL ON FUNCTION public.check_registration_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_registration_rate_limit(TEXT, INTEGER, INTEGER) TO anon, authenticated;

-- 2) Profile links may only be HTTPS URLs. Social fields are restricted to
-- their advertised domains, which prevents javascript:/data:/file: payloads
-- from being stored and later rendered as links.
CREATE OR REPLACE FUNCTION public.is_safe_profile_url(p_url TEXT, p_kind TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_url TEXT := trim(COALESCE(p_url, ''));
  v_host TEXT;
BEGIN
  IF v_url = '' THEN
    RETURN TRUE;
  END IF;

  IF char_length(v_url) > 200 OR position(chr(92) IN v_url) > 0 OR v_url ~ '[[:cntrl:]]' THEN
    RETURN FALSE;
  END IF;

  IF v_url ~ '^[A-Za-z][A-Za-z0-9+.-]*:' THEN
    IF v_url !~* '^https://' THEN
      RETURN FALSE;
    END IF;
  ELSE
    v_url := 'https://' || v_url;
  END IF;

  IF char_length(v_url) > 200 OR v_url !~* '^https://[^/[:space:]?#]+([/?#].*)?$' THEN
    RETURN FALSE;
  END IF;

  v_host := lower(substring(v_url FROM '^https://([^/:?#]+)'));
  IF v_host IS NULL OR v_host !~ '^[a-z0-9.-]+$' THEN
    RETURN FALSE;
  END IF;

  IF coalesce(p_kind, '') NOT IN ('github_url', 'linkedin_url', 'instagram_url', 'website_url') THEN
    RETURN FALSE;
  END IF;

  IF p_kind = 'github_url' AND v_host NOT IN ('github.com', 'www.github.com') THEN
    RETURN FALSE;
  ELSIF p_kind = 'linkedin_url' AND v_host NOT IN ('linkedin.com', 'www.linkedin.com') THEN
    RETURN FALSE;
  ELSIF p_kind = 'instagram_url' AND v_host NOT IN ('instagram.com', 'www.instagram.com') THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.is_safe_profile_url(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_safe_profile_url(TEXT, TEXT) TO authenticated, service_role;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_safe_profile_urls_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_safe_profile_urls_check CHECK (
    public.is_safe_profile_url(github_url, 'github_url') AND
    public.is_safe_profile_url(linkedin_url, 'linkedin_url') AND
    public.is_safe_profile_url(instagram_url, 'instagram_url') AND
    public.is_safe_profile_url(website_url, 'website_url')
  ) NOT VALID;

-- 3) Attachment records must use HTTPS and have a known shape. The client
-- additionally restricts file attachments to this project's Supabase Storage.
CREATE OR REPLACE FUNCTION public.are_safe_challenge_attachments(p_attachments JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_item JSONB;
  v_url TEXT;
BEGIN
  IF p_attachments IS NULL THEN
    RETURN TRUE;
  END IF;
  IF jsonb_typeof(p_attachments) <> 'array' THEN
    RETURN FALSE;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_attachments) AS items(value) LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_item->'name') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_item->'url') IS DISTINCT FROM 'string'
       OR (v_item->>'type') IS NULL
       OR (v_item->>'type') NOT IN ('file', 'link') THEN
      RETURN FALSE;
    END IF;

    v_url := trim(v_item->>'url');
    IF char_length(v_item->>'name') > 200
       OR char_length(v_url) > 2048
       OR v_url = ''
       OR position(chr(92) IN v_url) > 0
       OR v_url ~ '[[:cntrl:]]'
       OR v_url !~* '^https://[^/[:space:]?#]+([/?#].*)?$' THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.are_safe_challenge_attachments(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.are_safe_challenge_attachments(JSONB) TO authenticated, service_role;

ALTER TABLE public.challenges
  DROP CONSTRAINT IF EXISTS challenges_safe_attachments_check;

ALTER TABLE public.challenges
  ADD CONSTRAINT challenges_safe_attachments_check
  CHECK (public.are_safe_challenge_attachments(attachments)) NOT VALID;
