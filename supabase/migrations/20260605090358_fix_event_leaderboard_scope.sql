-- Event leaderboard must not fall back to all-time when event mode is disabled.

CREATE OR REPLACE FUNCTION public.get_leaderboard_scoped(
  p_period text DEFAULT 'all',
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  username text,
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
    ranked.id,
    ranked.username,
    ranked.score,
    ranked.last_solve,
    ranked.rank
  FROM (
    SELECT
      filtered.id,
      filtered.username,
      filtered.score,
      filtered.last_solve,
      ROW_NUMBER() OVER (
        ORDER BY filtered.score DESC, filtered.last_solve ASC NULLS LAST, filtered.username ASC
      ) AS rank
    FROM (
      SELECT
        u.id,
        u.username,
        COALESCE(SUM(c.points), 0)::bigint AS score,
        MAX(s.created_at) AS last_solve
      FROM public.users u
      LEFT JOIN public.solves s
        ON s.user_id = u.id
        AND (v_start IS NULL OR s.created_at >= v_start)
        AND (v_cutoff IS NULL OR s.created_at <= v_cutoff)
      LEFT JOIN public.challenges c ON c.id = s.challenge_id
      GROUP BY u.id, u.username
    ) filtered
    WHERE NOT v_scoped OR filtered.score > 0
  ) ranked
  ORDER BY ranked.rank
  LIMIT p_limit OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_team_leaderboard(
  p_period text DEFAULT 'all',
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  team_id uuid,
  team_name text,
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
    ranked.member_count,
    ranked.score,
    ranked.last_solve,
    ranked.rank
  FROM (
    SELECT
      filtered.team_id,
      filtered.team_name,
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
      GROUP BY t.id, t.name
    ) filtered
    WHERE NOT v_scoped OR filtered.score > 0
  ) ranked
  ORDER BY ranked.rank
  LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard_scoped(text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_team_leaderboard(text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_scoped(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_leaderboard(text, integer, integer) TO authenticated;
