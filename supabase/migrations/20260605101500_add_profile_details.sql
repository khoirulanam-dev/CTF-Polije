ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS github_url text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS website_url text;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_bio_length_check,
  ADD CONSTRAINT users_bio_length_check CHECK (bio IS NULL OR char_length(bio) <= 300);

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_profile_link_length_check,
  ADD CONSTRAINT users_profile_link_length_check CHECK (
    (github_url IS NULL OR char_length(github_url) <= 200) AND
    (linkedin_url IS NULL OR char_length(linkedin_url) <= 200) AND
    (instagram_url IS NULL OR char_length(instagram_url) <= 200) AND
    (website_url IS NULL OR char_length(website_url) <= 200)
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-avatars',
  'profile-avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Profile avatars are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their profile avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their profile avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their profile avatars" ON storage.objects;

CREATE POLICY "Profile avatars are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'profile-avatars');

CREATE POLICY "Users can upload their profile avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-avatars'
  AND name LIKE auth.uid()::text || '/%'
);

CREATE POLICY "Users can update their profile avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-avatars'
  AND name LIKE auth.uid()::text || '/%'
)
WITH CHECK (
  bucket_id = 'profile-avatars'
  AND name LIKE auth.uid()::text || '/%'
);

CREATE POLICY "Users can delete their profile avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-avatars'
  AND name LIKE auth.uid()::text || '/%'
);

DROP FUNCTION IF EXISTS public.get_user_profile(uuid);
CREATE OR REPLACE FUNCTION public.get_user_profile(p_id uuid)
RETURNS TABLE(
  id uuid,
  username text,
  picture text,
  avatar_url text,
  bio text,
  github_url text,
  linkedin_url text,
  instagram_url text,
  website_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.username,
    COALESCE(u.avatar_url, au.raw_user_meta_data->>'picture') AS picture,
    u.avatar_url,
    u.bio,
    u.github_url,
    u.linkedin_url,
    u.instagram_url,
    u.website_url
  FROM public.users u
  LEFT JOIN auth.users au ON au.id = u.id
  WHERE u.id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.detail_user(p_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_user RECORD;
  v_rank bigint;
  v_score int;
  v_solves json;
  v_auth_picture text;
BEGIN
  SELECT
    id,
    username,
    highest_rank,
    highest_rank_at,
    avatar_url,
    bio,
    github_url,
    linkedin_url,
    instagram_url,
    website_url
  INTO v_user
  FROM public.users
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'User not found');
  END IF;

  SELECT au.raw_user_meta_data->>'picture'
  INTO v_auth_picture
  FROM auth.users au
  WHERE au.id = v_user.id;

  SELECT rank INTO v_rank
  FROM (
    SELECT
      u.id,
      RANK() OVER (ORDER BY COALESCE(SUM(c.points), 0) DESC, MAX(s.created_at) ASC) AS rank
    FROM public.users u
    LEFT JOIN public.solves s ON u.id = s.user_id
    LEFT JOIN public.challenges c ON s.challenge_id = c.id
    GROUP BY u.id
  ) ranked
  WHERE ranked.id = p_id;

  SELECT COALESCE(SUM(c.points), 0)
  INTO v_score
  FROM public.solves s
  JOIN public.challenges c ON s.challenge_id = c.id
  WHERE s.user_id = p_id;

  SELECT json_agg(json_build_object(
    'challenge_id', c.id,
    'title', c.title,
    'category', c.category,
    'points', c.points,
    'difficulty', c.difficulty,
    'solved_at', s.created_at
  ) ORDER BY s.created_at DESC)
  INTO v_solves
  FROM public.solves s
  JOIN public.challenges c ON s.challenge_id = c.id
  WHERE s.user_id = p_id;

  RETURN json_build_object(
    'success', true,
    'user', json_build_object(
      'id', v_user.id,
      'username', v_user.username,
      'rank', COALESCE(v_rank, 0),
      'score', COALESCE(v_score, 0),
      'picture', COALESCE(v_user.avatar_url, v_auth_picture),
      'avatar_url', v_user.avatar_url,
      'bio', v_user.bio,
      'github_url', v_user.github_url,
      'linkedin_url', v_user.linkedin_url,
      'instagram_url', v_user.instagram_url,
      'website_url', v_user.website_url,
      'highest_rank', v_user.highest_rank,
      'highest_rank_at', v_user.highest_rank_at
    ),
    'solved_challenges', COALESCE(v_solves, '[]'::json)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_profile(
  p_id uuid,
  p_username text,
  p_avatar_url text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_github_url text DEFAULT NULL,
  p_linkedin_url text DEFAULT NULL,
  p_instagram_url text DEFAULT NULL,
  p_website_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_username text := trim(p_username);
  v_bio text := NULLIF(trim(COALESCE(p_bio, '')), '');
  v_avatar_url text := NULLIF(trim(COALESCE(p_avatar_url, '')), '');
  v_github_url text := NULLIF(trim(COALESCE(p_github_url, '')), '');
  v_linkedin_url text := NULLIF(trim(COALESCE(p_linkedin_url, '')), '');
  v_instagram_url text := NULLIF(trim(COALESCE(p_instagram_url, '')), '');
  v_website_url text := NULLIF(trim(COALESCE(p_website_url, '')), '');
  v_exists int;
  v_user_id uuid := auth.uid()::uuid;
BEGIN
  IF p_id IS DISTINCT FROM v_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Cannot change other user''s profile');
  END IF;

  IF v_username IS NULL OR v_username = '' THEN
    RETURN json_build_object('success', false, 'message', 'Username is required');
  END IF;

  IF char_length(v_bio) > 300 THEN
    RETURN json_build_object('success', false, 'message', 'Bio must be 300 characters or less');
  END IF;

  SELECT count(*)
  INTO v_exists
  FROM public.users
  WHERE lower(username) = lower(v_username)
    AND id <> p_id;

  IF v_exists > 0 THEN
    RETURN json_build_object('success', false, 'message', 'Username already taken');
  END IF;

  UPDATE public.users
  SET
    username = v_username,
    avatar_url = v_avatar_url,
    bio = v_bio,
    github_url = v_github_url,
    linkedin_url = v_linkedin_url,
    instagram_url = v_instagram_url,
    website_url = v_website_url,
    updated_at = now()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'User not found');
  END IF;

  RETURN json_build_object(
    'success', true,
    'profile', json_build_object(
      'username', v_username,
      'picture', v_avatar_url,
      'avatar_url', v_avatar_url,
      'bio', v_bio,
      'github_url', v_github_url,
      'linkedin_url', v_linkedin_url,
      'instagram_url', v_instagram_url,
      'website_url', v_website_url
    )
  );
END;
$$;

GRANT ALL ON FUNCTION public.get_user_profile(uuid) TO authenticated, service_role;
GRANT ALL ON FUNCTION public.detail_user(uuid) TO authenticated, service_role;
GRANT ALL ON FUNCTION public.update_profile(uuid, text, text, text, text, text, text, text) TO authenticated, service_role;
