CREATE TABLE public.message_dedup (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_dedup_created ON public.message_dedup(created_at);

ALTER TABLE public.message_dedup ENABLE ROW LEVEL SECURITY;