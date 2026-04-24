UPDATE tour_product_cache 
SET destination = '', detail_fetched = false
WHERE destination = 'Singapore' 
AND (
  title ILIKE '%Miami%' OR title ILIKE '%New York%' OR title ILIKE '%Paris%' 
  OR title ILIKE '%London%' OR title ILIKE '%Dubai%' OR title ILIKE '%Bangkok%'
  OR title ILIKE '%Tokyo%' OR title ILIKE '%Rome%' OR title ILIKE '%Barcelona%'
  OR title ILIKE '%Amsterdam%' OR title ILIKE '%Istanbul%' OR title ILIKE '%Cairo%'
  OR title ILIKE '%Los Angeles%' OR title ILIKE '%Las Vegas%' OR title ILIKE '%Cancun%'
  OR title ILIKE '%Phuket%' OR title ILIKE '%Bali%' OR title ILIKE '%Sydney%'
  OR title ILIKE '%Hawaii%' OR title ILIKE '%Maui%' OR title ILIKE '%Orlando%'
  OR title ILIKE '%Fort Lauderdale%' OR title ILIKE '%Key West%' OR title ILIKE '%Boynton%'
  OR title ILIKE '%Everglades%' OR title ILIKE '%Jamaica%' OR title ILIKE '%Bahamas%'
  OR title ILIKE '%Mexico%' OR title ILIKE '%Cancún%' OR title ILIKE '%Hong Kong%'
);