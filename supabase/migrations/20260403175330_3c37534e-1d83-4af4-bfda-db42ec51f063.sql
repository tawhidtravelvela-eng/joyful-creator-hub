
-- Drop the expression-based unique index and add a proper unique constraint
DROP INDEX IF EXISTS idx_high_demand_date_country;

-- Set default for country so upserts with NULL work
ALTER TABLE public.high_demand_dates ALTER COLUMN country SET DEFAULT '';

-- Update existing NULLs
UPDATE public.high_demand_dates SET country = '' WHERE country IS NULL;

-- Add unique constraint
ALTER TABLE public.high_demand_dates ADD CONSTRAINT uq_high_demand_date_country UNIQUE (date, country);
