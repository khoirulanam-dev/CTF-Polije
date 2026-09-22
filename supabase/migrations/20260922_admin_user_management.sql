-- Admin user management: keep role values consistent for CRUD operations.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

UPDATE public.users
SET role = 'admin'
WHERE is_admin IS TRUE;

UPDATE public.users
SET role = 'user'
WHERE role IS NULL OR role NOT IN ('user', 'contributor', 'admin');

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'contributor', 'admin'))
  NOT VALID;

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
