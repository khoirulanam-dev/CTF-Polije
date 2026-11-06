-- =========================================================================
-- Migration: 20261106_security_hardening_patch.sql
-- Description:
-- 1. Server-side Hint Redaction (RPC get_public_challenges) to stop client-side hint leakage
-- 2. Anti-Admin Spoofing on chat_messages (RLS policy + trigger validation)
-- 3. Case-Sensitive exact match flag verification in submit_flag
-- =========================================================================

-- 1. SECURE FUNCTION: get_public_challenges
-- Menjamin bahwa field 'content' pada hint berbayar (cost > 0) tidak pernah
-- dikirim ke client yang bukan admin, sehingga tidak bisa di-snoop lewat DevTools.
CREATE OR REPLACE FUNCTION public.get_public_challenges()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  category text,
  points integer,
  max_points integer,
  difficulty text,
  attachments jsonb,
  is_active boolean,
  is_dynamic boolean,
  min_points integer,
  decay_per_solve integer,
  created_at timestamptz,
  updated_at timestamptz,
  total_solves integer,
  season_id uuid,
  author text,
  created_by uuid,
  hint jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_admin boolean := coalesce((SELECT is_admin FROM public.users WHERE id = auth.uid()), false);
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.title,
    c.description,
    c.category,
    c.points,
    c.max_points,
    c.difficulty,
    c.attachments,
    c.is_active,
    c.is_dynamic,
    c.min_points,
    c.decay_per_solve,
    c.created_at,
    c.updated_at,
    c.total_solves,
    c.season_id,
    c.author,
    c.created_by,
    CASE 
      WHEN v_is_admin THEN c.hint
      WHEN c.hint IS NULL THEN NULL
      WHEN jsonb_typeof(c.hint) = 'array' AND jsonb_array_length(c.hint) = 0 THEN '[]'::jsonb
      WHEN jsonb_typeof(c.hint) = 'array' THEN (
        SELECT COALESCE(jsonb_agg(
          CASE 
            WHEN jsonb_typeof(elem) = 'object' AND COALESCE((elem->>'cost')::int, 0) > 0 THEN 
              jsonb_build_object('cost', COALESCE((elem->>'cost')::int, 10), 'content', '')
            ELSE elem
          END
        ), '[]'::jsonb)
        FROM jsonb_array_elements(c.hint) AS elem
      )
      WHEN jsonb_typeof(c.hint) = 'object' THEN (
        CASE 
          WHEN COALESCE((c.hint->>'cost')::int, 0) > 0 THEN
            jsonb_build_array(jsonb_build_object('cost', COALESCE((c.hint->>'cost')::int, 10), 'content', ''))
          ELSE jsonb_build_array(c.hint)
        END
      )
      ELSE c.hint
    END AS hint
  FROM public.challenges c;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_challenges() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_challenges() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_challenges() TO service_role;


-- 2. HARDEN LIVE CHAT: Cegah impersonasi role admin & nama pengguna palsu
DROP POLICY IF EXISTS "insert global chat" ON public.chat_messages;

CREATE POLICY "insert global chat" ON public.chat_messages 
FOR INSERT WITH CHECK (
  ("auth"."uid"() = "sender_id") AND 
  ("room" = 'global'::text) AND
  (
    "sender_role" != 'admin' OR 
    (SELECT coalesce(is_admin, false) FROM public.users WHERE id = auth.uid()) = true
  )
);

-- Trigger validasi otomatis sebelum insert untuk menetralkan manipulasi payload langsung
CREATE OR REPLACE FUNCTION public.trg_validate_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_admin boolean;
  v_actual_username text;
BEGIN
  -- Pastikan pengirim adalah user yang terotentikasi
  NEW.sender_id := auth.uid();

  -- Ambil data otentik dari tabel users
  SELECT coalesce(is_admin, false), username 
  INTO v_is_admin, v_actual_username
  FROM public.users 
  WHERE id = auth.uid();

  -- Jika bukan admin sungguhan, paksa role menjadi 'user'
  IF coalesce(NEW.sender_role, 'user') = 'admin' AND NOT coalesce(v_is_admin, false) THEN
    NEW.sender_role := 'user';
  END IF;

  -- Sinkronkan sender_name dengan username asli pengguna
  IF v_actual_username IS NOT NULL THEN
    NEW.sender_name := v_actual_username;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_message_validation ON public.chat_messages;
CREATE TRIGGER trg_chat_message_validation
BEFORE INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.trg_validate_chat_message();


-- 3. CASE-SENSITIVE FLAG VERIFICATION: Mencegah collision pada flag Base64 / sensitive casing
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
  v_failed_count int := 0;
  v_is_correct boolean;
  v_cooldown_seconds int := 3;
  v_wait_remaining int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  -- 🛡️ RATE LIMITING: Tiered Anti-Brute-Force Cooldown (dalam 15 menit terakhir)
  SELECT count(*) INTO v_failed_count
  FROM public.flag_submissions AS fs
  WHERE fs.user_id = v_user_id
    AND fs.challenge_id = v_challenge_id
    AND fs.is_correct = false
    AND fs.created_at > (now() - interval '15 minutes');

  v_cooldown_seconds := CASE
    WHEN v_failed_count >= 5 THEN 60
    WHEN v_failed_count = 4 THEN 30
    WHEN v_failed_count = 3 THEN 20
    WHEN v_failed_count = 2 THEN 10
    WHEN v_failed_count = 1 THEN 5
    ELSE 3
  END;

  -- Periksa waktu pengiriman terakhir user
  SELECT fs.created_at INTO v_last_submit_time
  FROM public.flag_submissions AS fs
  WHERE fs.user_id = v_user_id
  ORDER BY fs.created_at DESC
  LIMIT 1;

  IF v_last_submit_time IS NOT NULL AND (now() - v_last_submit_time) < (v_cooldown_seconds || ' seconds')::interval THEN
    v_wait_remaining := CEIL(EXTRACT(EPOCH FROM ((v_last_submit_time + (v_cooldown_seconds || ' seconds')::interval) - now())));
    RETURN json_build_object(
      'success', false,
      'message', format('Terlalu cepat! Harap tunggu %s detik sebelum mencoba flag lagi.', GREATEST(1, v_wait_remaining)),
      'cooldown_remaining', GREATEST(1, v_wait_remaining)
    );
  END IF;

  -- Ambil detail soal dan flag master
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

  -- 🛡️ EXACT MATCH: Pencocokan flag case-sensitive (mencegah collision pada Base64)
  v_is_correct := (v_flag_input IS NOT NULL AND v_db_flag = v_flag_input);

  -- 📝 AUDIT LOG: Catat submission
  INSERT INTO public.flag_submissions(user_id, challenge_id, flag_submitted, is_correct)
  VALUES (v_user_id, v_challenge_id, COALESCE(v_flag_input, ''), v_is_correct);

  IF NOT v_is_correct THEN
    v_failed_count := v_failed_count + 1;
    v_cooldown_seconds := CASE
      WHEN v_failed_count >= 5 THEN 60
      WHEN v_failed_count = 4 THEN 30
      WHEN v_failed_count = 3 THEN 20
      WHEN v_failed_count = 2 THEN 10
      WHEN v_failed_count = 1 THEN 5
      ELSE 3
    END;

    RETURN json_build_object(
      'success', false,
      'message', 'Incorrect flag',
      'cooldown_remaining', v_cooldown_seconds
    );
  END IF;

  -- Periksa apakah sudah pernah di-solve
  SELECT EXISTS (
    SELECT 1
    FROM public.solves AS s
    WHERE s.user_id = v_user_id
      AND s.challenge_id = v_challenge_id
  ) INTO v_already;

  IF v_already THEN
    RETURN json_build_object('success', true, 'message', 'Already solved');
  END IF;

  -- Rekam solve
  INSERT INTO public.solves(user_id, challenge_id)
  VALUES (v_user_id, v_challenge_id);

  SELECT COALESCE(c.total_solves, 0)
  INTO v_total_solves
  FROM public.challenges AS c
  WHERE c.id = v_challenge_id;

  -- Hitung dynamic decay poin jika aktif
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
GRANT EXECUTE ON FUNCTION public.submit_flag(uuid, text) TO service_role;

