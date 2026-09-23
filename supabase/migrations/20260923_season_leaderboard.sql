-- =========================================================================
-- CTF POLIJE - SEASON-AWARE LEADERBOARD ENHANCEMENT
-- File ini menyediakan referensi fungsi SQL untuk mengambil klasemen per season
-- Catatan: Endpoint API Next.js /api/scoreboard sudah menghitung secara langsung
-- dari tabel challenges, solves, dan unlocked_hints.
-- =========================================================================

-- Optional: Tambahkan parameter p_season_id pada get_leaderboard_scoped
CREATE OR REPLACE FUNCTION public.get_leaderboard_by_season(
  p_season_id uuid DEFAULT NULL,
  p_period text DEFAULT 'all',
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  username text,
  score bigint,
  last_solve timestamptz,
  rank bigint,
  picture text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_start timestamptz := public.period_start(p_period);
BEGIN
  RETURN QUERY
  SELECT
    ranked.id,
    ranked.username,
    ranked.score,
    ranked.last_solve,
    ranked.rank,
    ranked.picture
  FROM (
    SELECT
      filtered.id,
      filtered.username,
      filtered.score,
      filtered.last_solve,
      ROW_NUMBER() OVER (
        ORDER BY filtered.score DESC, filtered.last_solve ASC NULLS LAST, filtered.username ASC
      ) AS rank,
      filtered.picture
    FROM (
      SELECT
        u.id,
        u.username,
        GREATEST(0, COALESCE(SUM(c.points), 0) - COALESCE((
          SELECT SUM(uh.cost) 
          FROM public.unlocked_hints uh 
          JOIN public.challenges hc ON hc.id = uh.challenge_id
          WHERE uh.user_id = u.id
            AND (p_season_id IS NULL OR hc.season_id = p_season_id)
        ), 0))::bigint AS score,
        MAX(s.created_at) AS last_solve,
        COALESCE(u.avatar_url, au.raw_user_meta_data->>'picture') AS picture
      FROM public.users u
      LEFT JOIN auth.users au ON au.id = u.id
      JOIN public.solves s ON s.user_id = u.id
        AND (v_start IS NULL OR s.created_at >= v_start)
      JOIN public.challenges c ON c.id = s.challenge_id
        AND (p_season_id IS NULL OR c.season_id = p_season_id)
      GROUP BY u.id, u.username, u.avatar_url, au.raw_user_meta_data
    ) filtered
    WHERE filtered.score > 0
  ) ranked
  ORDER BY ranked.rank
  LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard_by_season(uuid, text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_by_season(uuid, text, integer, integer) TO authenticated;
