
ALTER TABLE public.viator_destination_map ADD COLUMN IF NOT EXISTS auto_learned boolean DEFAULT false;
