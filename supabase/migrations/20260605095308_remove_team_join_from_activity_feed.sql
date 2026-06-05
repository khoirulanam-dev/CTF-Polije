-- Keep Activity Feed useful for participants: solves, first bloods, and new
-- challenges only. Team join events are noisy, especially after solo backfill.

CREATE OR REPLACE FUNCTION public.get_activity_feed(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  activity_type text,
  user_id uuid,
  username text,
  challenge_id uuid,
  challenge_title text,
  category text,
  points integer,
  team_id uuid,
  team_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM (
    SELECT
      'first_blood'::text AS activity_type,
      u.id AS user_id,
      u.username,
      c.id AS challenge_id,
      c.title AS challenge_title,
      c.category,
      c.points,
      NULL::uuid AS team_id,
      NULL::text AS team_name,
      s.created_at
    FROM (
      SELECT
        s.*,
        ROW_NUMBER() OVER (PARTITION BY s.challenge_id ORDER BY s.created_at ASC, s.id ASC) AS rn
      FROM public.solves s
    ) s
    JOIN public.users u ON u.id = s.user_id
    JOIN public.challenges c ON c.id = s.challenge_id
    WHERE s.rn = 1

    UNION ALL

    SELECT
      'solve'::text AS activity_type,
      u.id,
      u.username,
      c.id,
      c.title,
      c.category,
      c.points,
      NULL::uuid,
      NULL::text,
      s.created_at
    FROM public.solves s
    JOIN public.users u ON u.id = s.user_id
    JOIN public.challenges c ON c.id = s.challenge_id

    UNION ALL

    SELECT
      'new_challenge'::text,
      NULL::uuid,
      NULL::text,
      c.id,
      c.title,
      c.category,
      c.points,
      NULL::uuid,
      NULL::text,
      c.created_at
    FROM public.challenges c
    WHERE COALESCE(c.is_active, true) = true
  ) feed
  ORDER BY created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_activity_feed(integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_activity_feed(integer, integer) TO authenticated;
