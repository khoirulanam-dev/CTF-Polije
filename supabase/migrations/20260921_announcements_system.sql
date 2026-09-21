-- Migration: Announcements & Feature Updates System
-- Enables developers and admins to broadcast feature releases, platform upgrades, and notices.

CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text NOT NULL,
    type text NOT NULL DEFAULT 'feature', -- 'feature', 'challenge', 'system', 'maintenance'
    badge text DEFAULT 'UPDATE',
    link text,
    created_at timestamptz NOT NULL DEFAULT now(),
    is_active boolean NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Policy 1: Anyone (authenticated & anon) can read active announcements
DROP POLICY IF EXISTS "Anyone can view active announcements" ON public.announcements;
CREATE POLICY "Anyone can view active announcements"
ON public.announcements FOR SELECT
TO authenticated, anon
USING (is_active = true);

-- Policy 2: Only admins can insert, update, or delete announcements
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
CREATE POLICY "Admins can manage announcements"
ON public.announcements FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
  )
);

-- Initial seed data for today's new features
INSERT INTO public.announcements (title, description, type, badge, link, created_at, is_active)
VALUES 
(
  'Scoreboard Upgrade: Foto Profil & Cincin Glow Avatar',
  'Scoreboard kini menampilkan foto profil resmi user dengan cincin glowing khusus untuk rank 1, 2, dan 3 beserta medali kehormatan!',
  'feature',
  'FITUR BARU',
  '/scoreboard',
  now(),
  true
),
(
  'Category Progress Bar di Menu Challenge',
  'Pantau progres tantangan Anda dengan progress bar real-time di tiap kategori soal beserta badge 100% Mastered!',
  'feature',
  'FITUR BARU',
  '/challenges',
  now() - interval '5 minutes',
  true
)
ON CONFLICT DO NOTHING;
