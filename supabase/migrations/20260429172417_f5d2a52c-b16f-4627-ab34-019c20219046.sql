-- Enum for the reason a dose was missed
DO $$ BEGIN
  CREATE TYPE public.missed_reason AS ENUM ('forgot', 'not_available', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.dose_logs
  ADD COLUMN IF NOT EXISTS missed_reason public.missed_reason;