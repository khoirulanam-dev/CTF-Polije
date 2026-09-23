-- Event-driven Discord notifications.
-- A row is created only when a solve is the first solve for its challenge.

CREATE TABLE IF NOT EXISTS public.discord_first_blood_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solve_id UUID NOT NULL UNIQUE REFERENCES public.solves(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  discord_message_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_discord_first_blood_events_unsent
  ON public.discord_first_blood_events(created_at)
  WHERE sent_at IS NULL;

ALTER TABLE public.discord_first_blood_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.discord_first_blood_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_discord_first_blood()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Serialize first-blood checks for the same challenge so concurrent solves
  -- cannot both be treated as the first solve.
  PERFORM pg_advisory_xact_lock(hashtext(NEW.challenge_id::text));

  IF NOT EXISTS (
    SELECT 1
    FROM public.solves AS previous_solve
    WHERE previous_solve.challenge_id = NEW.challenge_id
      AND (
        previous_solve.created_at < NEW.created_at
        OR (
          previous_solve.created_at = NEW.created_at
          AND previous_solve.id < NEW.id
        )
      )
  ) THEN
    INSERT INTO public.discord_first_blood_events (
      solve_id,
      challenge_id,
      user_id,
      created_at
    )
    VALUES (
      NEW.id,
      NEW.challenge_id,
      NEW.user_id,
      NEW.created_at
    )
    ON CONFLICT (solve_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_discord_first_blood ON public.solves;
CREATE TRIGGER trg_enqueue_discord_first_blood
AFTER INSERT ON public.solves
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_discord_first_blood();
