-- =========================================================================
-- CTF POLIJE - CONTRIBUTOR ROLE, DYNAMIC AUTHOR, & FLAG VALIDATION
-- Jalankan migration ini di Supabase SQL Editor
-- =========================================================================

-- 1. Tambah kolom role di tabel users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- Sinkronkan admin yang sudah ada
UPDATE public.users 
SET role = 'admin' 
WHERE is_admin = true;

UPDATE public.users 
SET role = 'user' 
WHERE role IS NULL;

-- 2. Tambah kolom author & created_by di tabel challenges
ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS author TEXT;

ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_challenges_created_by ON public.challenges(created_by);

-- Backfill challenge lama yang belum memiliki author
UPDATE public.challenges 
SET author = 'Mas Anam' 
WHERE author IS NULL OR author = '';

-- 3. Fungsi Helper: is_contributor & get_user_role
CREATE OR REPLACE FUNCTION public.is_contributor()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'contributor' AND (is_admin IS NOT TRUE)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN is_admin = true OR role = 'admin' THEN 'admin'
    WHEN role = 'contributor' THEN 'contributor'
    ELSE 'user'
  END
  FROM public.users
  WHERE id = auth.uid();
$$;

-- 4. RLS & Policy: Kontributor dapat melihat/membaca soal
GRANT EXECUTE ON FUNCTION public.is_contributor TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role TO authenticated, anon;
