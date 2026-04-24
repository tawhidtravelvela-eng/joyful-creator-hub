
ALTER TABLE public.high_demand_dates ADD COLUMN IF NOT EXISTS fetched_year int DEFAULT 0;

-- Update existing seeded rows with their actual year
UPDATE public.high_demand_dates SET fetched_year = EXTRACT(YEAR FROM date)::int WHERE fetched_year = 0;
