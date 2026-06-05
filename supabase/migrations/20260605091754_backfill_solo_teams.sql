-- Give every existing user a solo team so historical users are represented in
-- the team leaderboard. Users can leave the solo team later to join a shared one.

DO $$
DECLARE
  r record;
  v_team_id uuid;
  v_invite_code text;
BEGIN
  FOR r IN
    SELECT u.id, u.username
    FROM public.users u
    LEFT JOIN public.team_members tm ON tm.user_id = u.id
    WHERE tm.user_id IS NULL
  LOOP
    LOOP
      v_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.teams WHERE invite_code = v_invite_code
      );
    END LOOP;

    INSERT INTO public.teams(name, invite_code, created_by, is_solo)
    VALUES (
      COALESCE(NULLIF(trim(r.username), ''), 'Solo') || '''s Team',
      v_invite_code,
      r.id,
      true
    )
    RETURNING id INTO v_team_id;

    INSERT INTO public.team_members(team_id, user_id, role)
    VALUES (v_team_id, r.id, 'owner');
  END LOOP;
END $$;
