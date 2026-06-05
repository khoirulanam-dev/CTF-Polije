-- Solo users should be represented as solo participants, not as default-looking
-- shared teams.

UPDATE public.teams t
SET name = u.username,
    updated_at = now()
FROM public.team_members tm
JOIN public.users u ON u.id = tm.user_id
WHERE t.id = tm.team_id
  AND t.is_solo = true
  AND tm.role = 'owner'
  AND NOT EXISTS (
    SELECT 1
    FROM public.team_members other
    WHERE other.team_id = t.id
      AND other.user_id <> tm.user_id
  );

CREATE OR REPLACE FUNCTION public.create_team(
  p_name text,
  p_is_solo boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team_id uuid;
  v_invite_code text;
  v_username text;
  v_clean_name text := NULLIF(trim(p_name), '');
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  IF EXISTS (SELECT 1 FROM public.team_members WHERE user_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'message', 'You are already in a team');
  END IF;

  SELECT username INTO v_username FROM public.users WHERE id = v_user_id;

  IF v_clean_name IS NULL THEN
    IF COALESCE(p_is_solo, false) THEN
      v_clean_name := COALESCE(NULLIF(v_username, ''), 'Solo');
    ELSE
      v_clean_name := COALESCE(NULLIF(v_username, ''), 'User') || '''s Team';
    END IF;
  END IF;

  LOOP
    v_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.teams WHERE invite_code = v_invite_code);
  END LOOP;

  INSERT INTO public.teams(name, invite_code, created_by, is_solo)
  VALUES (v_clean_name, v_invite_code, v_user_id, COALESCE(p_is_solo, false))
  RETURNING id INTO v_team_id;

  INSERT INTO public.team_members(team_id, user_id, role)
  VALUES (v_team_id, v_user_id, 'owner');

  RETURN json_build_object(
    'success', true,
    'team_id', v_team_id,
    'invite_code', v_invite_code
  );
END;
$$;

DROP FUNCTION IF EXISTS public.get_team_leaderboard(text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_team_leaderboard(
  p_period text DEFAULT 'all',
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  team_id uuid,
  team_name text,
  is_solo boolean,
  member_count bigint,
  score bigint,
  last_solve timestamptz,
  rank bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_period text := lower(COALESCE(p_period, 'all'));
  v_start timestamptz := public.period_start(p_period);
  v_cutoff timestamptz := public.scoreboard_cutoff();
  v_scoped boolean := v_start IS NOT NULL OR v_cutoff IS NOT NULL;
  v_event_enabled boolean := false;
BEGIN
  IF v_period = 'event' THEN
    SELECT COALESCE(is_enabled, false)
    INTO v_event_enabled
    FROM public.ctf_event_settings
    WHERE id = true;

    IF NOT COALESCE(v_event_enabled, false) OR v_start IS NULL THEN
      RETURN;
    END IF;

    v_scoped := true;
  END IF;

  RETURN QUERY
  SELECT
    ranked.team_id,
    ranked.team_name,
    ranked.is_solo,
    ranked.member_count,
    ranked.score,
    ranked.last_solve,
    ranked.rank
  FROM (
    SELECT
      filtered.team_id,
      filtered.team_name,
      filtered.is_solo,
      filtered.member_count,
      filtered.score,
      filtered.last_solve,
      ROW_NUMBER() OVER (
        ORDER BY filtered.score DESC, filtered.last_solve ASC NULLS LAST, filtered.team_name ASC
      ) AS rank
    FROM (
      SELECT
        t.id AS team_id,
        t.name AS team_name,
        t.is_solo,
        COUNT(DISTINCT tm.user_id)::bigint AS member_count,
        COALESCE(SUM(c.points), 0)::bigint AS score,
        MAX(s.created_at) AS last_solve
      FROM public.teams t
      JOIN public.team_members tm ON tm.team_id = t.id
      LEFT JOIN public.solves s
        ON s.user_id = tm.user_id
        AND (v_start IS NULL OR s.created_at >= v_start)
        AND (v_cutoff IS NULL OR s.created_at <= v_cutoff)
      LEFT JOIN public.challenges c ON c.id = s.challenge_id
      GROUP BY t.id, t.name, t.is_solo
    ) filtered
    WHERE NOT v_scoped OR filtered.score > 0
  ) ranked
  ORDER BY ranked.rank
  LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_team_leaderboard(text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_team_leaderboard(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_team(text, boolean) TO authenticated;
