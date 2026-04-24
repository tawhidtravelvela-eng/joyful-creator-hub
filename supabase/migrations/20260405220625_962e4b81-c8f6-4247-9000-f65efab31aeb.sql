
CREATE OR REPLACE FUNCTION public.backfill_tour_highlights(batch_size integer DEFAULT 5000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  fixed_count int := 0;
  remaining_count int := 0;
  rec RECORD;
  new_highlights text[];
  new_places text[];
  incl jsonb;
  item jsonb;
  val text;
BEGIN
  FOR rec IN
    SELECT id, product_data
    FROM tour_product_cache
    WHERE is_active = true
      AND detail_fetched = true
      AND (highlights IS NULL OR highlights = '{}')
      AND product_data IS NOT NULL
    ORDER BY review_count DESC NULLS LAST
    LIMIT batch_size
  LOOP
    new_highlights := '{}';
    new_places := '{}';

    -- 1. Extract highlights from inclusions
    IF rec.product_data->'inclusions' IS NOT NULL AND jsonb_typeof(rec.product_data->'inclusions') = 'array' THEN
      FOR incl IN SELECT * FROM jsonb_array_elements(rec.product_data->'inclusions')
      LOOP
        val := COALESCE(incl->>'otherDescription', incl->>'typeDescription');
        IF val IS NOT NULL AND length(val) > 3 AND length(val) < 100
           AND val !~* 'viator|tripadvisor|getyourguide|klook' THEN
          new_highlights := array_append(new_highlights, val);
        END IF;
        EXIT WHEN array_length(new_highlights, 1) >= 8;
      END LOOP;
    END IF;

    -- 2. Fallback: extract from tags if no inclusions
    IF array_length(new_highlights, 1) IS NULL OR array_length(new_highlights, 1) < 2 THEN
      IF rec.product_data->'tags' IS NOT NULL AND jsonb_typeof(rec.product_data->'tags') = 'array' THEN
        new_highlights := '{}';
        FOR item IN SELECT * FROM jsonb_array_elements(rec.product_data->'tags')
        LOOP
          val := COALESCE(item->'allNamesByLocale'->>'en', item->>'tagName');
          IF val IS NOT NULL AND length(val) > 2 AND val !~* 'viator' THEN
            new_highlights := array_append(new_highlights, val);
          END IF;
          EXIT WHEN array_length(new_highlights, 1) >= 5;
        END LOOP;
      END IF;
    END IF;

    -- 3. Extract places_covered from itinerary items
    IF rec.product_data->'itinerary'->'itineraryItems' IS NOT NULL
       AND jsonb_typeof(rec.product_data->'itinerary'->'itineraryItems') = 'array' THEN
      FOR item IN SELECT * FROM jsonb_array_elements(rec.product_data->'itinerary'->'itineraryItems')
      LOOP
        -- POI name
        val := item->'pointOfInterestLocation'->'location'->>'name';
        IF val IS NOT NULL AND length(val) > 2 AND length(val) < 60
           AND val !~* 'viator|tour start|tour end|hotel pickup|pickup point' THEN
          IF NOT val = ANY(new_places) THEN
            new_places := array_append(new_places, val);
          END IF;
        END IF;
        -- Item title
        val := COALESCE(item->>'title', item->>'name');
        IF val IS NOT NULL AND length(val) > 2 AND length(val) < 60
           AND val !~* 'viator|tour start|tour end|hotel pickup|pickup point'
           AND NOT val = ANY(new_places) THEN
          new_places := array_append(new_places, val);
        END IF;
        EXIT WHEN array_length(new_places, 1) >= 10;
      END LOOP;
    END IF;

    -- Update if we found anything
    IF (array_length(new_highlights, 1) IS NOT NULL AND array_length(new_highlights, 1) > 0)
       OR (array_length(new_places, 1) IS NOT NULL AND array_length(new_places, 1) > 0) THEN
      UPDATE tour_product_cache
      SET highlights = CASE WHEN array_length(new_highlights, 1) > 0 THEN new_highlights ELSE highlights END,
          tags = CASE WHEN array_length(new_highlights, 1) > 0 THEN new_highlights ELSE tags END,
          places_covered = CASE WHEN array_length(new_places, 1) > 0 THEN new_places ELSE places_covered END
      WHERE id = rec.id;
      fixed_count := fixed_count + 1;
    END IF;
  END LOOP;

  -- Count remaining
  SELECT count(*) INTO remaining_count
  FROM tour_product_cache
  WHERE is_active = true AND detail_fetched = true
    AND (highlights IS NULL OR highlights = '{}');

  RETURN jsonb_build_object('fixed', fixed_count, 'remaining', remaining_count);
END;
$function$;
