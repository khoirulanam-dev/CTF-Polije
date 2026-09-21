-- =========================================================================
-- Migration: 20260921_security_and_hint_cost.sql
-- Description:
-- 1. Anti-Brute Force Flag & Audit Logging (table flag_submissions & rate-limited submit_flag)
-- 2. Hint Cost System (table unlocked_hints, RPC unlock_hint, RPC get_unlocked_hints)
-- 3. Leaderboard & Profile Net Score Recalculation (Deducting hint costs)
-- =========================================================================

-- 1) Flag Submissions Audit Log Table
CREATE TABLE IF NOT EXISTS public.flag_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    flag_submitted TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flag_submissions_user_chall
ON public.flag_submissions(user_id, challenge_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_flag_submissions_user_recent
ON public.flag_submissions(user_id, created_at DESC);

ALTER TABLE public.flag_submissions ENABLE ROW LEVEL SECURITY;

-- Allow users to view only their own submissions (or admin view all)
DROP POLICY IF EXISTS "Users can view own flag submissions" ON public.flag_submissions;
CREATE POLICY "Users can view own flag submissions"
ON public.flag_submissions FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR EXISTS (
  SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
));

-- 2) Hint Cost & Unlocked Hints Table
CREATE TABLE IF NOT EXISTS public.unlocked_hints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    hint_idx INT NOT NULL,
    cost INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_challenge_hint UNIQUE(user_id, challenge_id, hint_idx)
);

CREATE INDEX IF NOT EXISTS idx_unlocked_hints_user_chall
ON public.unlocked_hints(user_id, challenge_id);

ALTER TABLE public.unlocked_hints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own unlocked hints" ON public.unlocked_hints;
CREATE POLICY "Users can view own unlocked hints"
ON public.unlocked_hints FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR EXISTS (
  SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
));

-- 3) Function: unlock_hint (Dengan validasi kecukupan poin user)
CREATE OR REPLACE FUNCTION public.unlock_hint(
    p_challenge_id UUID,
    p_hint_idx INT,
    p_cost INT DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_cost INT := GREATEST(COALESCE(p_cost, 0), 0);
    v_already BOOLEAN;
    v_total_solves_score BIGINT := 0;
    v_total_hint_cost BIGINT := 0;
    v_current_score BIGINT := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- 1. Cek apakah hint sudah pernah dibuka
    SELECT EXISTS (
        SELECT 1 FROM public.unlocked_hints
        WHERE user_id = v_user_id
          AND challenge_id = p_challenge_id
          AND hint_idx = p_hint_idx
    ) INTO v_already;

    IF v_already THEN
        RETURN json_build_object(
            'success', true,
            'already_unlocked', true,
            'message', 'Hint already unlocked'
        );
    END IF;

    -- 2. Hitung total poin dari tantangan yang berhasil diselesaikan user
    SELECT COALESCE(SUM(c.points), 0)
    INTO v_total_solves_score
    FROM public.solves s
    JOIN public.challenges c ON s.challenge_id = c.id
    WHERE s.user_id = v_user_id;

    -- 3. Hitung total biaya hint yang sudah pernah dibuka user
    SELECT COALESCE(SUM(cost), 0)
    INTO v_total_hint_cost
    FROM public.unlocked_hints
    WHERE user_id = v_user_id;

    -- 4. Skor bersih user saat ini
    v_current_score := v_total_solves_score - v_total_hint_cost;

    -- 5. Validasi: Tolak jika poin tidak cukup (misal: poin 0 mau buka hint 50, atau poin 50 mau buka hint 70)
    IF v_cost > 0 AND v_current_score < v_cost THEN
        RETURN json_build_object(
            'success', false,
            'message', format('Poin Anda tidak mencukupi! Skor saat ini: %s pts, biaya hint: %s pts.', GREATEST(0, v_current_score), v_cost)
        );
    END IF;

    -- 6. Catat pembukaan hint
    INSERT INTO public.unlocked_hints(user_id, challenge_id, hint_idx, cost)
    VALUES (v_user_id, p_challenge_id, p_hint_idx, v_cost);

    -- Recalculate user rank/score if exists
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'recalc_user_peak_rank') THEN
        PERFORM public.recalc_user_peak_rank(v_user_id);
    END IF;

    RETURN json_build_object(
        'success', true,
        'already_unlocked', false,
        'cost', v_cost,
        'remaining_score', (v_current_score - v_cost),
        'message', format('Hint berhasil dibuka! -%s poin.', v_cost)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.unlock_hint(UUID, INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.unlock_hint(UUID, INT, INT) TO authenticated;

-- 4) Function: get_unlocked_hints for current user
CREATE OR REPLACE FUNCTION public.get_unlocked_hints(p_challenge_id UUID)
RETURNS TABLE (
    hint_idx INT,
    cost INT,
    unlocked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN QUERY
    SELECT uh.hint_idx, uh.cost, uh.created_at
    FROM public.unlocked_hints uh
    WHERE uh.user_id = auth.uid()
      AND uh.challenge_id = p_challenge_id
    ORDER BY uh.hint_idx ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_unlocked_hints(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_unlocked_hints(UUID) TO authenticated;

-- 5) Upgraded submit_flag with Rate Limiting & Cooldown
CREATE OR REPLACE FUNCTION public.submit_flag(challenge_id uuid, flag text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_challenge_id uuid := challenge_id;
  v_flag_input text := flag;
  v_user_id uuid := auth.uid();
  v_db_flag text;
  v_points int;
  v_already boolean;
  v_is_dynamic boolean;
  v_min_points int;
  v_decay int;
  v_max_points int;
  v_total_solves int;
  v_new_points int;
  v_last_submit_time timestamptz;
  v_failed_count int;
  v_is_correct boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  -- 🛡️ RATE LIMITING 1: 3-Second Cooldown between submissions across challenges
  SELECT created_at INTO v_last_submit_time
  FROM public.flag_submissions
  WHERE user_id = v_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_submit_time IS NOT NULL AND (now() - v_last_submit_time) < interval '3 seconds' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Slow down! Please wait 3 seconds before submitting another flag.'
    );
  END IF;

  -- 🛡️ RATE LIMITING 2: Anti-Brute-Force (Max 5 failed attempts per challenge in 1 minute)
  SELECT count(*) INTO v_failed_count
  FROM public.flag_submissions
  WHERE user_id = v_user_id
    AND challenge_id = v_challenge_id
    AND is_correct = false
    AND created_at > (now() - interval '1 minute');

  IF v_failed_count >= 5 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Rate limit exceeded: 5 failed attempts in 1 minute. Please wait 1 minute before trying again.'
    );
  END IF;

  -- Get challenge details and flag
  SELECT
    cf.flag,
    c.points,
    c.is_dynamic,
    c.min_points,
    c.decay_per_solve,
    c.max_points
  INTO
    v_db_flag,
    v_points,
    v_is_dynamic,
    v_min_points,
    v_decay,
    v_max_points
  FROM public.challenges AS c
  LEFT JOIN public.challenge_flags AS cf ON cf.challenge_id = c.id
  WHERE c.id = v_challenge_id
    AND COALESCE(c.is_active, true) = true;

  IF v_db_flag IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Flag not configured for this challenge');
  END IF;

  -- Check if flag is correct
  v_is_correct := (v_flag_input IS NOT NULL AND lower(v_db_flag) = lower(v_flag_input));

  -- 📝 AUDIT LOG: Record submission
  INSERT INTO public.flag_submissions(user_id, challenge_id, flag_submitted, is_correct)
  VALUES (v_user_id, v_challenge_id, COALESCE(v_flag_input, ''), v_is_correct);

  IF NOT v_is_correct THEN
    RETURN json_build_object('success', false, 'message', 'Incorrect flag');
  END IF;

  -- Check if already solved
  SELECT EXISTS (
    SELECT 1
    FROM public.solves s
    WHERE s.user_id = v_user_id
      AND s.challenge_id = v_challenge_id
  ) INTO v_already;

  IF v_already THEN
    RETURN json_build_object('success', true, 'message', 'Already solved');
  END IF;

  -- Record solve
  INSERT INTO public.solves(user_id, challenge_id)
  VALUES (v_user_id, v_challenge_id);

  SELECT COALESCE(c.total_solves, 0)
  INTO v_total_solves
  FROM public.challenges c
  WHERE c.id = v_challenge_id;

  IF COALESCE(v_is_dynamic, false) THEN
    v_max_points := COALESCE(v_max_points, v_points);
    v_min_points := COALESCE(v_min_points, 0);
    v_decay := COALESCE(v_decay, 0);

    IF v_total_solves <= 3 THEN
      v_new_points := v_max_points;
    ELSE
      v_new_points := GREATEST(
        v_min_points,
        v_max_points - (v_decay * (v_total_solves - 3))
      );
    END IF;

    UPDATE public.challenges
    SET points = v_new_points
    WHERE id = v_challenge_id;

    v_points := v_new_points;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'recalc_user_peak_rank') THEN
    PERFORM public.recalc_user_peak_rank(v_user_id);
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', format('Correct! +%s points.', COALESCE(v_points, 0))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_flag(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_flag(uuid, text) TO authenticated;

-- =========================================================================
-- 6) UPDATE LEADERBOARDS & PROFILES TO DEDUCT HINT COSTS
-- =========================================================================

-- 6a) get_leaderboard_scoped (Halaman Utama Scoreboard Peserta)
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
        -- Skor bersih: Total poin solves dikurangi total biaya hint yang dibuka
        GREATEST(0, COALESCE(SUM(c.points), 0) - COALESCE((
          SELECT SUM(uh.cost) FROM public.unlocked_hints uh WHERE uh.user_id = u.id
        ), 0))::bigint AS score,
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

REVOKE ALL ON FUNCTION public.get_leaderboard_scoped(text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_scoped(text, integer, integer) TO authenticated;

-- 6b) get_team_leaderboard (Halaman Scoreboard Tim)
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
        -- Skor tim bersih: Total poin solves tim dikurangi total biaya hint yang dibuka oleh anggota tim
        GREATEST(0, COALESCE(SUM(c.points), 0) - COALESCE((
          SELECT SUM(uh.cost) FROM public.unlocked_hints uh
          JOIN public.team_members tm2 ON tm2.user_id = uh.user_id
          WHERE tm2.team_id = t.id
        ), 0))::bigint AS score,
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

REVOKE ALL ON FUNCTION public.get_team_leaderboard(text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_team_leaderboard(text, integer, integer) TO authenticated;

-- 6c) detail_user (Profil Detail Peserta)
CREATE OR REPLACE FUNCTION public.detail_user(p_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user RECORD;
  v_rank BIGINT;
  v_score INT;
  v_solves JSON;
  v_picture TEXT;
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

  SELECT au.raw_user_meta_data->>'picture' INTO v_picture
  FROM auth.users au
  WHERE au.id = v_user.id;

  SELECT rank INTO v_rank
  FROM (
    SELECT
      u.id,
      RANK() OVER (
        ORDER BY GREATEST(0, COALESCE(SUM(c.points), 0) - COALESCE((
          SELECT SUM(cost) FROM public.unlocked_hints uh WHERE uh.user_id = u.id
        ), 0)) DESC, MAX(s.created_at) ASC NULLS LAST
      ) AS rank
    FROM public.users u
    LEFT JOIN public.solves s ON u.id = s.user_id
    LEFT JOIN public.challenges c ON s.challenge_id = c.id
    GROUP BY u.id
  ) ranked
  WHERE ranked.id = p_id;

  SELECT GREATEST(0, COALESCE(SUM(c.points), 0) - COALESCE((
    SELECT SUM(cost) FROM public.unlocked_hints uh WHERE uh.user_id = p_id
  ), 0))
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
  FROM public.solves s
  JOIN public.challenges c ON s.challenge_id = c.id
  WHERE s.user_id = p_id
  INTO v_solves;

  RETURN json_build_object(
    'success', true,
    'id', v_user.id,
    'username', v_user.username,
    'picture', COALESCE(v_user.avatar_url, v_picture),
    'rank', COALESCE(v_rank, 0),
    'score', COALESCE(v_score, 0),
    'user', json_build_object(
      'id', v_user.id,
      'username', v_user.username,
      'rank', COALESCE(v_rank, 0),
      'score', COALESCE(v_score, 0),
      'picture', COALESCE(v_user.avatar_url, v_picture),
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
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.detail_user(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.detail_user(UUID) TO authenticated;
