-- Fix live DB drift discovered by comparing the app code with sql/live_schema.sql.

-- 1) Repair existing solve counters before replacing submit_flag.
UPDATE public.challenges c
SET total_solves = COALESCE(s.solve_count, 0)
FROM (
  SELECT challenge_id, COUNT(*)::int AS solve_count
  FROM public.solves
  GROUP BY challenge_id
) s
WHERE c.id = s.challenge_id;

UPDATE public.challenges c
SET total_solves = 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.solves s WHERE s.challenge_id = c.id
);

UPDATE public.challenges
SET points = CASE
  WHEN COALESCE(total_solves, 0) <= 3 THEN COALESCE(max_points, points)
  ELSE GREATEST(
    COALESCE(min_points, 0),
    COALESCE(max_points, points) - (COALESCE(decay_per_solve, 0) * (COALESCE(total_solves, 0) - 3))
  )
END
WHERE COALESCE(is_dynamic, false) = true;

-- 2) Replace submit_flag without double-incrementing total_solves.
-- The trg_solve_update_count trigger already recalculates total_solves after insert/delete.
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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Not authenticated');
  END IF;

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

  IF v_flag_input IS NULL OR lower(v_db_flag) <> lower(v_flag_input) THEN
    RETURN json_build_object('success', false, 'message', 'Incorrect flag');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.solves s
    WHERE s.user_id = v_user_id
      AND s.challenge_id = v_challenge_id
  ) INTO v_already;

  IF v_already THEN
    RETURN json_build_object('success', true, 'message', 'Already solved');
  END IF;

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

  PERFORM public.recalc_user_peak_rank(v_user_id);

  RETURN json_build_object(
    'success', true,
    'message', format('Correct! +%s points.', COALESCE(v_points, 0))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_flag(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_flag(uuid, text) TO authenticated;

-- 3) Restrict auth audit logs to admins. The previous live function was callable by anon/authenticated.
CREATE OR REPLACE FUNCTION public.get_auth_audit_logs(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  instance_id uuid,
  ip_address text,
  payload jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can view audit logs';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.created_at,
    a.instance_id,
    a.ip_address::text,
    a.payload
  FROM auth.audit_log_entries a
  ORDER BY a.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_auth_audit_logs(integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_auth_audit_logs(integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_audit_logs(integer, integer) TO authenticated;

-- 4) Drop unused/broken bonus RPC. It referenced public.bonus_points and users.score,
-- neither of which exists in the live schema.
DROP FUNCTION IF EXISTS public.add_bonus_points(uuid, integer, text);
