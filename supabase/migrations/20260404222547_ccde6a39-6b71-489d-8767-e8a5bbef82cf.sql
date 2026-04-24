-- Backfill missing slugs with vela_id suffix for uniqueness
UPDATE tour_product_cache
SET slug = LEFT(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(trim(COALESCE(title, '')) || '-' || trim(COALESCE(destination, ''))),
          '[^a-z0-9\s\-]', '', 'g'
        ),
        '\s+', '-', 'g'
      ),
      '-+', '-', 'g'
    ),
    '^-|-$', '', 'g'
  ),
  112
) || '-' || COALESCE(vela_id, substring(md5(product_code) from 1 for 7))
WHERE slug IS NULL
  AND title IS NOT NULL
  AND title != '';