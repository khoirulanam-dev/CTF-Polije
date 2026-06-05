-- Default privileges in the live project grant EXECUTE broadly. Keep these
-- engagement features behind authenticated sessions.

REVOKE ALL ON FUNCTION public.period_start(text) FROM anon;
REVOKE ALL ON FUNCTION public.scoreboard_cutoff() FROM anon;
REVOKE ALL ON FUNCTION public.get_leaderboard_scoped(text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_team_leaderboard(text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.create_team(text, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.join_team(text) FROM anon;
REVOKE ALL ON FUNCTION public.leave_team() FROM anon;
REVOKE ALL ON FUNCTION public.get_my_team() FROM anon;
REVOKE ALL ON FUNCTION public.get_team_detail(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_activity_feed(integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_event_settings() FROM anon;
REVOKE ALL ON FUNCTION public.update_event_settings(text, boolean, timestamptz, timestamptz, boolean, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.get_user_category_progress(uuid) FROM anon;

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

REVOKE ALL ON TABLE public.teams FROM anon;
REVOKE ALL ON TABLE public.team_members FROM anon;
REVOKE ALL ON TABLE public.ctf_event_settings FROM anon;
