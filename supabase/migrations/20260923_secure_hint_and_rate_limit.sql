-- =========================================================================
-- Migration: 20260923_secure_hint_and_rate_limit.sql
-- Description:
-- 1. Authoritative Server-Side Hint Cost in unlock_hint (prevents client cost tampering)
-- 2. Secure Hint Content Delivery in get_unlocked_hints & unlock_hint (prevents leakage)
-- 3. Tiered Database-Enforced Cooldown on submit_flag (anti-brute force)
-- =========================================================================

-- 1) DROP & RECREATE get_unlocked_hints to return content securely
DROP FUNCTION IF EXISTS public.get_unlocked_hints(UUID);

CREATE OR REPLACE FUNCTION public.get_unlocked_hints(p_challenge_id UUID)
RETURNS TABLE (
    hint_idx INT,
    cost INT,
    content TEXT,
    unlocked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_hint_raw TEXT;
    v_hint_json JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    -- Ambil data hint dari tabel challenges
    SELECT c.hint::text INTO v_hint_raw
    FROM public.challenges c
    WHERE c.id = p_challenge_id;

    IF v_hint_raw IS NOT NULL AND trim(v_hint_raw) <> '' THEN
        BEGIN
            v_hint_json := v_hint_raw::jsonb;
        EXCEPTION WHEN OTHERS THEN
            v_hint_json := jsonb_build_array(v_hint_raw);
        END;

        -- Un-nest secara rekursif jika string JSON ter-encode berlapis (double-stringified)
        WHILE jsonb_typeof(v_hint_json) = 'string' LOOP
            BEGIN
                v_hint_json := (v_hint_json #>> '{}')::jsonb;
            EXCEPTION WHEN OTHERS THEN
                EXIT;
            END;
        END LOOP;

        IF jsonb_typeof(v_hint_json) = 'object' THEN
            v_hint_json := jsonb_build_array(v_hint_json);
        ELSIF jsonb_typeof(v_hint_json) <> 'array' THEN
            v_hint_json := jsonb_build_array(v_hint_raw);
        END IF;
    END IF;

    -- Hanya kembalikan teks konten untuk hint yang sudah tercatat di unlocked_hints oleh user ini
    RETURN QUERY
    SELECT 
        uh.hint_idx, 
        uh.cost, 
        CASE 
            WHEN v_hint_json IS NOT NULL AND uh.hint_idx >= 0 AND uh.hint_idx < jsonb_array_length(v_hint_json) THEN
                CASE 
                    WHEN jsonb_typeof(v_hint_json -> uh.hint_idx) = 'object' THEN
                        COALESCE((v_hint_json -> uh.hint_idx)->>'content', (v_hint_json -> uh.hint_idx)->>'text', (v_hint_json -> uh.hint_idx)->>'hint', '')
                    WHEN jsonb_typeof(v_hint_json -> uh.hint_idx) = 'string' AND ((v_hint_json -> uh.hint_idx)#>>'{}') ~ '^\s*\{' THEN
                        COALESCE(
                            (((v_hint_json -> uh.hint_idx)#>>'{}')::jsonb)->>'content',
                            (((v_hint_json -> uh.hint_idx)#>>'{}')::jsonb)->>'text',
                            (v_hint_json -> uh.hint_idx)#>>'{}'
                        )
                    ELSE
                        trim(both '"' from (v_hint_json -> uh.hint_idx)::text)
                END
            ELSE ''
        END AS content,
        uh.created_at AS unlocked_at
    FROM public.unlocked_hints uh
    WHERE uh.user_id = v_user_id
      AND uh.challenge_id = p_challenge_id
    ORDER BY uh.hint_idx ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_unlocked_hints(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_unlocked_hints(UUID) TO authenticated;


-- 2) UPGRADE unlock_hint: Authoritative Cost Calculation from DB
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
    v_cost INT := 0;
    v_hint_raw TEXT;
    v_hint_json JSONB;
    v_item JSONB;
    v_content TEXT := '';
    v_chall_points INT := 100;
    v_base_cost INT := 10;
    v_already BOOLEAN;
    v_total_solves_score BIGINT := 0;
    v_total_hint_cost BIGINT := 0;
    v_current_score BIGINT := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- 1. Baca data soal dan hint langsung dari database
    SELECT c.hint::text, COALESCE(c.points, 100)
    INTO v_hint_raw, v_chall_points
    FROM public.challenges c
    WHERE c.id = p_challenge_id AND COALESCE(c.is_active, true) = true;

    IF v_hint_raw IS NULL OR trim(v_hint_raw) = '' THEN
        RETURN json_build_object('success', false, 'message', 'Tantangan ini tidak memiliki petunjuk (hint)');
    END IF;

    -- Parsing JSONB secara aman
    BEGIN
        v_hint_json := v_hint_raw::jsonb;
    EXCEPTION WHEN OTHERS THEN
        v_hint_json := jsonb_build_array(v_hint_raw);
    END;

    -- Un-nest secara rekursif jika string JSON ter-encode berlapis (double-stringified)
    WHILE jsonb_typeof(v_hint_json) = 'string' LOOP
        BEGIN
            v_hint_json := (v_hint_json #>> '{}')::jsonb;
        EXCEPTION WHEN OTHERS THEN
            EXIT;
        END;
    END LOOP;

    IF jsonb_typeof(v_hint_json) = 'object' THEN
        v_hint_json := jsonb_build_array(v_hint_json);
    ELSIF jsonb_typeof(v_hint_json) <> 'array' THEN
        v_hint_json := jsonb_build_array(v_hint_raw);
    END IF;

    -- Validasi batas indeks
    IF p_hint_idx < 0 OR p_hint_idx >= jsonb_array_length(v_hint_json) THEN
        RETURN json_build_object('success', false, 'message', 'Indeks hint tidak valid');
    END IF;

    v_item := v_hint_json -> p_hint_idx;

    -- Jika v_item sendiri berupa string JSON yang memuat object
    IF jsonb_typeof(v_item) = 'string' AND (v_item #>> '{}') ~ '^\s*\{' THEN
        BEGIN
            v_item := (v_item #>> '{}')::jsonb;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    -- 2. Tentukan biaya (cost) dan isi teks (content) secara otoritatif dari server
    IF jsonb_typeof(v_item) = 'object' THEN
        v_content := COALESCE(v_item->>'content', v_item->>'text', v_item->>'hint', '');
        IF v_item ? 'cost' THEN
            v_cost := GREATEST(0, COALESCE((v_item->>'cost')::int, 0));
        ELSE
            v_base_cost := GREATEST(10, LEAST(50, ROUND(v_chall_points * 0.1)));
            v_cost := ROUND(v_base_cost * (1 + p_hint_idx * 0.5));
        END IF;
    ELSE
        v_content := trim(both '"' from v_item::text);
        v_base_cost := GREATEST(10, LEAST(50, ROUND(v_chall_points * 0.1)));
        v_cost := ROUND(v_base_cost * (1 + p_hint_idx * 0.5));
    END IF;

    -- 3. Cek apakah hint sudah pernah dibuka
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
            'cost', v_cost,
            'content', v_content,
            'message', 'Hint sudah dibuka sebelumnya'
        );
    END IF;

    -- 4. Hitung skor user saat ini (Solves - Hint costs)
    SELECT COALESCE(SUM(c.points), 0)
    INTO v_total_solves_score
    FROM public.solves s
    JOIN public.challenges c ON s.challenge_id = c.id
    WHERE s.user_id = v_user_id;

    SELECT COALESCE(SUM(cost), 0)
    INTO v_total_hint_cost
    FROM public.unlocked_hints
    WHERE user_id = v_user_id;

    v_current_score := v_total_solves_score - v_total_hint_cost;

    -- 5. Validasi kecukupan poin
    IF v_cost > 0 AND v_current_score < v_cost THEN
        RETURN json_build_object(
            'success', false,
            'message', format('Poin Anda tidak mencukupi! Skor saat ini: %s pts, biaya hint: %s pts.', GREATEST(0, v_current_score), v_cost)
        );
    END IF;

    -- 6. Rekam pembukaan hint di database
    INSERT INTO public.unlocked_hints(user_id, challenge_id, hint_idx, cost)
    VALUES (v_user_id, p_challenge_id, p_hint_idx, v_cost)
    ON CONFLICT (user_id, challenge_id, hint_idx) DO UPDATE SET cost = EXCLUDED.cost;

    -- Recalculate user rank/score if function exists
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'recalc_user_peak_rank') THEN
        PERFORM public.recalc_user_peak_rank(v_user_id);
    END IF;

    RETURN json_build_object(
        'success', true,
        'already_unlocked', false,
        'cost', v_cost,
        'content', v_content,
        'remaining_score', (v_current_score - v_cost),
        'message', CASE 
            WHEN v_cost = 0 THEN 'Hint gratis berhasil dibuka!' 
            ELSE format('Hint berhasil dibuka! -%s poin.', v_cost) 
        END
    );
END;
$$;

REVOKE ALL ON FUNCTION public.unlock_hint(UUID, INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.unlock_hint(UUID, INT, INT) TO authenticated;


-- 3) UPGRADE submit_flag: Tiered Cooldown Enforcement
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
    -- Hitung kegagalan setelah insert untuk memberi info cooldown berikutnya
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
