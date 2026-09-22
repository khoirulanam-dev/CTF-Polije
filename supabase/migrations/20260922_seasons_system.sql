-- =========================================================================
-- CTF POLIJE - SEASONS & RESET MANAGEMENT MIGRATION
-- Jalankan file SQL ini di Supabase SQL Editor untuk membuat sistem Season
-- =========================================================================

-- 1. Table: seasons
CREATE TABLE IF NOT EXISTS public.seasons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  number INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for status lookup
CREATE INDEX IF NOT EXISTS idx_seasons_status ON public.seasons(status);

-- 2. Table: season_archives (Menyimpan snapshot riwayat lengkap top player, top soal, & statistik)
CREATE TABLE IF NOT EXISTS public.season_archives (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID REFERENCES public.seasons(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  season_name TEXT NOT NULL,
  top_players JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_challenges JSONB NOT NULL DEFAULT '[]'::jsonb,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_season_archives_number ON public.season_archives(season_number);

-- 3. Add season_id to challenges
ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES public.seasons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_challenges_season_id ON public.challenges(season_id);

-- 4. Inisialisasi Season 1 & Backfill Data Tantangan yang Ada
DO $$
DECLARE
  v_season_1_id UUID;
BEGIN
  -- Cek apakah Season 1 sudah ada
  SELECT id INTO v_season_1_id FROM public.seasons WHERE number = 1;
  
  IF v_season_1_id IS NULL THEN
    INSERT INTO public.seasons (number, name, description, status, started_at)
    VALUES (
      1,
      'Season 1',
      'Musim perdana CTF Politeknik Negeri Jember. Menghadirkan tantangan dasar keamanan siber, eksploitasi web, kriptografi, dan forensik digital.',
      'active',
      now() - interval '30 days'
    )
    RETURNING id INTO v_season_1_id;
  END IF;

  -- Tautkan semua challenge lama yang belum memiliki season_id ke Season 1
  UPDATE public.challenges
  SET season_id = v_season_1_id
  WHERE season_id IS NULL;
END $$;

-- 5. RLS Policies
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active or archived seasons" ON public.seasons;
CREATE POLICY "Public can view active or archived seasons"
ON public.seasons FOR SELECT
TO authenticated, anon
USING (status IN ('active', 'archived') OR COALESCE((SELECT is_admin()), false) = true);

DROP POLICY IF EXISTS "Admins can manage seasons" ON public.seasons;
CREATE POLICY "Admins can manage seasons"
ON public.seasons FOR ALL
TO authenticated
USING (COALESCE((SELECT is_admin()), false) = true)
WITH CHECK (COALESCE((SELECT is_admin()), false) = true);

DROP POLICY IF EXISTS "Public can view season archives" ON public.season_archives;
CREATE POLICY "Public can view season archives"
ON public.season_archives FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Admins can manage season archives" ON public.season_archives;
CREATE POLICY "Admins can manage season archives"
ON public.season_archives FOR ALL
TO authenticated
USING (COALESCE((SELECT is_admin()), false) = true)
WITH CHECK (COALESCE((SELECT is_admin()), false) = true);
