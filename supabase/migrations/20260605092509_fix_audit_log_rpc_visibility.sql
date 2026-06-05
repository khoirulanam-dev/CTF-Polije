-- Make audit log RPC fail clearly only for non-admins and avoid relying on the
-- overloaded is_admin helpers inside this sensitive SECURITY DEFINER function.

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
DECLARE
  v_is_admin boolean := false;
BEGIN
  SELECT COALESCE(u.is_admin, false)
  INTO v_is_admin
  FROM public.users u
  WHERE u.id = auth.uid();

  IF NOT COALESCE(v_is_admin, false) THEN
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
  WHERE COALESCE(a.payload->>'action', '') <> 'token_revoked'
  ORDER BY a.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 5000)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_auth_audit_logs(integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_auth_audit_logs(integer, integer) TO authenticated;
