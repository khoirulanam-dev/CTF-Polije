-- Engagement features: scoped leaderboards, teams, activity feed, event mode,
-- and category progress.

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  invite_code text UNIQUE NOT NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  is_solo boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member' NOT NULL CHECK (role IN ('owner', 'member')),
  joined_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (team_id, user_id),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.ctf_event_settings (
  id boolean PRIMARY KEY DEFAULT true,
  event_name text DEFAULT 'CTF Event' NOT NULL,
  is_enabled boolean DEFAULT false NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  freeze_scoreboard boolean DEFAULT false NOT NULL,
  freeze_at timestamptz,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CHECK (id = true)
);

INSERT INTO public.ctf_event_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_solves_created_at ON public.solves(created_at);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ctf_event_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teams select authenticated" ON public.teams;
CREATE POLICY "teams select authenticated"
  ON public.teams FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "team members select authenticated" ON public.team_members;
CREATE POLICY "team members select authenticated"
  ON public.team_members FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "event settings select authenticated" ON public.ctf_event_settings;
CREATE POLICY "event settings select authenticated"
  ON public.ctf_event_settings FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.period_start(p_period text)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT CASE lower(COALESCE(p_period, 'all'))
    WHEN 'today' THEN date_trunc('day', now())
    WHEN 'day' THEN date_trunc('day', now())
    WHEN 'weekly' THEN date_trunc('week', now())
    WHEN 'week' THEN date_trunc('week', now())
    WHEN 'monthly' THEN date_trunc('month', now())
    WHEN 'month' THEN date_trunc('month', now())
    WHEN 'event' THEN (
      SELECT starts_at
      FROM public.ctf_event_settings
      WHERE id = true AND is_enabled = true
    )
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.scoreboard_cutoff()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN freeze_scoreboard THEN COALESCE(freeze_at, now())
    ELSE NULL
  END
  FROM public.ctf_event_settings
  WHERE id = true;
$$;

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
  v_start timestamptz := public.period_start(p_period);
  v_cutoff timestamptz := public.scoreboard_cutoff();
BEGIN
  RETURN QUERY
  SELECT
    ranked.id,
    ranked.username,
    ranked.score,
    ranked.last_solve,
    ranked.rank
  FROM (
    SELECT
      u.id,
      u.username,
      COALESCE(SUM(c.points), 0)::bigint AS score,
      MAX(s.created_at) AS last_solve,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(SUM(c.points), 0) DESC, MAX(s.created_at) ASC NULLS LAST, u.username ASC
      ) AS rank
    FROM public.users u
    LEFT JOIN public.solves s
      ON s.user_id = u.id
      AND (v_start IS NULL OR s.created_at >= v_start)
      AND (v_cutoff IS NULL OR s.created_at <= v_cutoff)
    LEFT JOIN public.challenges c ON c.id = s.challenge_id
    GROUP BY u.id, u.username
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
  v_start timestamptz := public.period_start(p_period);
  v_cutoff timestamptz := public.scoreboard_cutoff();
BEGIN
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
      t.id AS team_id,
      t.name AS team_name,
      COUNT(DISTINCT tm.user_id)::bigint AS member_count,
      COALESCE(SUM(c.points), 0)::bigint AS score,
      MAX(s.created_at) AS last_solve,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(SUM(c.points), 0) DESC, MAX(s.created_at) ASC NULLS LAST, t.name ASC
      ) AS rank
    FROM public.teams t
    JOIN public.team_members tm ON tm.team_id = t.id
    LEFT JOIN public.solves s
      ON s.user_id = tm.user_id
      AND (v_start IS NULL OR s.created_at >= v_start)
      AND (v_cutoff IS NULL OR s.created_at <= v_cutoff)
    LEFT JOIN public.challenges c ON c.id = s.challenge_id
    GROUP BY t.id, t.name
  ) ranked
  ORDER BY ranked.rank
  LIMIT p_limit OFFSET p_offset;
END;
$$;

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
  v_clean_name text := NULLIF(trim(p_name), '');
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  IF EXISTS (SELECT 1 FROM public.team_members WHERE user_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'message', 'You are already in a team');
  END IF;

  IF v_clean_name IS NULL THEN
    SELECT username || '''s Team' INTO v_clean_name FROM public.users WHERE id = v_user_id;
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

CREATE OR REPLACE FUNCTION public.join_team(p_invite_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team public.teams%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  IF EXISTS (SELECT 1 FROM public.team_members WHERE user_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'message', 'You are already in a team');
  END IF;

  SELECT *
  INTO v_team
  FROM public.teams
  WHERE upper(invite_code) = upper(trim(p_invite_code));

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Invalid invite code');
  END IF;

  IF COALESCE(v_team.is_solo, false) THEN
    RETURN json_build_object('success', false, 'message', 'This is a solo team');
  END IF;

  INSERT INTO public.team_members(team_id, user_id, role)
  VALUES (v_team.id, v_user_id, 'member');

  RETURN json_build_object('success', true, 'team_id', v_team.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_team()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team_id uuid;
  v_remaining int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  SELECT team_id INTO v_team_id
  FROM public.team_members
  WHERE user_id = v_user_id;

  IF v_team_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'You are not in a team');
  END IF;

  DELETE FROM public.team_members WHERE user_id = v_user_id;

  SELECT COUNT(*) INTO v_remaining
  FROM public.team_members
  WHERE team_id = v_team_id;

  IF v_remaining = 0 THEN
    DELETE FROM public.teams WHERE id = v_team_id;
  ELSE
    UPDATE public.team_members
    SET role = 'owner'
    WHERE id = (
      SELECT id
      FROM public.team_members
      WHERE team_id = v_team_id
      ORDER BY joined_at ASC
      LIMIT 1
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.team_members WHERE team_id = v_team_id AND role = 'owner'
    );
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_team()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team json;
  v_members json;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  SELECT json_build_object(
    'id', t.id,
    'name', t.name,
    'invite_code', t.invite_code,
    'is_solo', t.is_solo,
    'created_by', t.created_by,
    'created_at', t.created_at,
    'my_role', tm.role
  )
  INTO v_team
  FROM public.teams t
  JOIN public.team_members tm ON tm.team_id = t.id
  WHERE tm.user_id = v_user_id;

  IF v_team IS NULL THEN
    RETURN json_build_object('success', true, 'team', NULL, 'members', '[]'::json);
  END IF;

  SELECT json_agg(member_row ORDER BY (member_row->>'score')::int DESC, member_row->>'username')
  INTO v_members
  FROM (
    SELECT json_build_object(
      'user_id', u.id,
      'username', u.username,
      'role', tm.role,
      'joined_at', tm.joined_at,
      'score', COALESCE(SUM(c.points), 0),
      'solves', COUNT(s.id)
    ) AS member_row
    FROM public.team_members tm
    JOIN public.users u ON u.id = tm.user_id
    LEFT JOIN public.solves s ON s.user_id = u.id
    LEFT JOIN public.challenges c ON c.id = s.challenge_id
    WHERE tm.team_id = (v_team->>'id')::uuid
    GROUP BY u.id, u.username, tm.role, tm.joined_at
  ) members;

  RETURN json_build_object(
    'success', true,
    'team', v_team,
    'members', COALESCE(v_members, '[]'::json)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_team_detail(p_team_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_team json;
  v_members json;
  v_recent_solves json;
BEGIN
  SELECT json_build_object(
    'id', t.id,
    'name', t.name,
    'invite_code', t.invite_code,
    'is_solo', t.is_solo,
    'created_by', t.created_by,
    'created_at', t.created_at
  )
  INTO v_team
  FROM public.teams t
  WHERE t.id = p_team_id;

  IF v_team IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Team not found');
  END IF;

  SELECT json_agg(member_row ORDER BY (member_row->>'score')::int DESC, member_row->>'username')
  INTO v_members
  FROM (
    SELECT json_build_object(
      'user_id', u.id,
      'username', u.username,
      'role', tm.role,
      'joined_at', tm.joined_at,
      'score', COALESCE(SUM(c.points), 0),
      'solves', COUNT(s.id)
    ) AS member_row
    FROM public.team_members tm
    JOIN public.users u ON u.id = tm.user_id
    LEFT JOIN public.solves s ON s.user_id = u.id
    LEFT JOIN public.challenges c ON c.id = s.challenge_id
    WHERE tm.team_id = p_team_id
    GROUP BY u.id, u.username, tm.role, tm.joined_at
  ) members;

  SELECT json_agg(solve_row ORDER BY solve_row->>'solved_at' DESC)
  INTO v_recent_solves
  FROM (
    SELECT json_build_object(
      'username', u.username,
      'challenge_id', c.id,
      'challenge_title', c.title,
      'category', c.category,
      'points', c.points,
      'solved_at', s.created_at
    ) AS solve_row
    FROM public.solves s
    JOIN public.users u ON u.id = s.user_id
    JOIN public.team_members tm ON tm.user_id = u.id
    JOIN public.challenges c ON c.id = s.challenge_id
    WHERE tm.team_id = p_team_id
    ORDER BY s.created_at DESC
    LIMIT 25
  ) solves;

  RETURN json_build_object(
    'success', true,
    'team', v_team,
    'members', COALESCE(v_members, '[]'::json),
    'recent_solves', COALESCE(v_recent_solves, '[]'::json)
  );
END;
$$;

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

    UNION ALL

    SELECT
      'team_join'::text,
      u.id,
      u.username,
      NULL::uuid,
      NULL::text,
      NULL::text,
      NULL::integer,
      t.id,
      t.name,
      tm.joined_at
    FROM public.team_members tm
    JOIN public.users u ON u.id = tm.user_id
    JOIN public.teams t ON t.id = tm.team_id
  ) feed
  ORDER BY created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_event_settings()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT json_build_object(
    'success', true,
    'event', json_build_object(
      'event_name', event_name,
      'is_enabled', is_enabled,
      'starts_at', starts_at,
      'ends_at', ends_at,
      'freeze_scoreboard', freeze_scoreboard,
      'freeze_at', freeze_at,
      'updated_at', updated_at
    )
  )
  FROM public.ctf_event_settings
  WHERE id = true;
$$;

CREATE OR REPLACE FUNCTION public.update_event_settings(
  p_event_name text,
  p_is_enabled boolean,
  p_starts_at timestamptz DEFAULT NULL,
  p_ends_at timestamptz DEFAULT NULL,
  p_freeze_scoreboard boolean DEFAULT false,
  p_freeze_at timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can update event settings';
  END IF;

  UPDATE public.ctf_event_settings
  SET event_name = COALESCE(NULLIF(trim(p_event_name), ''), 'CTF Event'),
      is_enabled = COALESCE(p_is_enabled, false),
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      freeze_scoreboard = COALESCE(p_freeze_scoreboard, false),
      freeze_at = CASE
        WHEN COALESCE(p_freeze_scoreboard, false) THEN COALESCE(p_freeze_at, now())
        ELSE p_freeze_at
      END,
      updated_at = now()
  WHERE id = true;

  RETURN public.get_event_settings();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_category_progress(p_user_id uuid)
RETURNS TABLE (
  category text,
  total_challenges integer,
  solved_challenges integer,
  solved_points integer,
  percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.category,
    COUNT(c.id)::integer AS total_challenges,
    COUNT(s.id)::integer AS solved_challenges,
    COALESCE(SUM(CASE WHEN s.id IS NOT NULL THEN c.points ELSE 0 END), 0)::integer AS solved_points,
    CASE
      WHEN COUNT(c.id) = 0 THEN 0::numeric
      ELSE ROUND((COUNT(s.id)::numeric / COUNT(c.id)::numeric) * 100, 1)
    END AS percentage
  FROM public.challenges c
  LEFT JOIN public.solves s
    ON s.challenge_id = c.id
    AND s.user_id = p_user_id
  WHERE COALESCE(c.is_active, true) = true
  GROUP BY c.category
  ORDER BY percentage DESC, solved_challenges DESC, c.category ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.period_start(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.scoreboard_cutoff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_scoped(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_leaderboard(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_team(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_team(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_team() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_team() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_activity_feed(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_event_settings(text, boolean, timestamptz, timestamptz, boolean, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_category_progress(uuid) TO authenticated;
