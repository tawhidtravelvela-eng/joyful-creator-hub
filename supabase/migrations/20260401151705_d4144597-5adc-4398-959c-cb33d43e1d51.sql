DO $$
DECLARE
  rec RECORD;
  new_slug TEXT;
  suffix INT;
  final_slug TEXT;
BEGIN
  FOR rec IN
    SELECT id, slug, product_code
    FROM tour_product_cache
    WHERE slug IS NOT NULL AND slug ~ '\d{3,10}[pP]\d+$'
    ORDER BY cached_at ASC NULLS LAST
  LOOP
    -- Strip trailing product code
    new_slug := regexp_replace(
      regexp_replace(rec.slug, '-?\d{3,10}[pP]\d+$', ''),
      '-$', ''
    );
    
    -- If empty after strip, generate from product_code
    IF new_slug = '' OR new_slug IS NULL THEN
      new_slug := 'tour-' || lower(rec.product_code);
    END IF;
    
    -- Check for collision and add suffix if needed
    final_slug := new_slug;
    suffix := 1;
    WHILE EXISTS (
      SELECT 1 FROM tour_product_cache 
      WHERE slug = final_slug AND id != rec.id
    ) LOOP
      suffix := suffix + 1;
      final_slug := new_slug || '-' || suffix;
    END LOOP;
    
    UPDATE tour_product_cache SET slug = final_slug WHERE id = rec.id;
  END LOOP;
END $$;