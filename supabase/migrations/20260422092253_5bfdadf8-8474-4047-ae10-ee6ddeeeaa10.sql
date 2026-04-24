
-- Trigger: keep renewal_price_usd at 50% of first_year_price_usd
CREATE OR REPLACE FUNCTION public.sync_plan_renewal_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only auto-sync when first_year > 0; free plans stay at 0
  IF NEW.first_year_price_usd IS NOT NULL AND NEW.first_year_price_usd > 0 THEN
    NEW.renewal_price_usd := round(NEW.first_year_price_usd / 2.0, 2);
  ELSE
    NEW.renewal_price_usd := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_plan_renewal_price ON public.b2b_plans;
CREATE TRIGGER trg_sync_plan_renewal_price
BEFORE INSERT OR UPDATE OF first_year_price_usd ON public.b2b_plans
FOR EACH ROW
EXECUTE FUNCTION public.sync_plan_renewal_price();

-- Backfill existing rows
UPDATE public.b2b_plans
SET renewal_price_usd = CASE
  WHEN first_year_price_usd > 0 THEN round(first_year_price_usd / 2.0, 2)
  ELSE 0
END
WHERE renewal_price_usd IS DISTINCT FROM (
  CASE WHEN first_year_price_usd > 0 THEN round(first_year_price_usd / 2.0, 2) ELSE 0 END
);
