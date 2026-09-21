-- ================================================================
-- FIX: Ambiguous column reference "challenge_id" in submit_flag
-- ================================================================
-- Jalankan query SQL ini di Supabase SQL Editor untuk memperbaiki
-- error: column reference "challenge_id" is ambiguous saat submit flag.

CREATE OR REPLACE FUNCTION public.submit_flag(challenge_id uuid, flag text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
#variable_conflict use_column
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
  SELECT fs.created_at INTO v_last_submit_time
  FROM public.flag_submissions AS fs
  WHERE fs.user_id = v_user_id
  ORDER BY fs.created_at DESC
  LIMIT 1;

  IF v_last_submit_time IS NOT NULL AND (now() - v_last_submit_time) < interval '3 seconds' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Slow down! Please wait 3 seconds before submitting another flag.'
    );
  END IF;

  -- 🛡️ RATE LIMITING 2: Anti-Brute-Force (Max 5 failed attempts per challenge in 1 minute)
  SELECT count(*) INTO v_failed_count
  FROM public.flag_submissions AS fs
  WHERE fs.user_id = v_user_id
    AND fs.challenge_id = v_challenge_id
    AND fs.is_correct = false
    AND fs.created_at > (now() - interval '1 minute');

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
    FROM public.solves AS s
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
  FROM public.challenges AS c
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

    UPDATE public.challenges AS c
    SET points = v_new_points
    WHERE c.id = v_challenge_id;

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
