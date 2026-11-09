-- Add meeting location support to Bureau meeting records.
ALTER TABLE public.bureau_reunions
  ADD COLUMN IF NOT EXISTS lieu text NOT NULL DEFAULT '';
