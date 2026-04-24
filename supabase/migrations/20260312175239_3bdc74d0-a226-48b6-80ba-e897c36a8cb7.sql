
CREATE TABLE public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model text NOT NULL,
  provider text NOT NULL DEFAULT 'gemini',
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  estimated_cost numeric DEFAULT 0,
  function_name text DEFAULT 'crisp-plugin',
  route_reason text DEFAULT '',
  duration_ms integer DEFAULT 0,
  success boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for time-range queries
CREATE INDEX idx_ai_usage_logs_created_at ON public.ai_usage_logs (created_at DESC);
CREATE INDEX idx_ai_usage_logs_provider ON public.ai_usage_logs (provider, created_at DESC);

-- RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read ai_usage_logs"
  ON public.ai_usage_logs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service manage ai_usage_logs"
  ON public.ai_usage_logs FOR ALL
  TO service_role
  USING (true);
