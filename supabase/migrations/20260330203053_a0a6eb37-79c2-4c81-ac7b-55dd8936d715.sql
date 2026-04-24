UPDATE tour_sync_state 
SET product_codes_pending = array_cat(
  product_codes_pending, 
  ARRAY['42771P153','414517P50','242747P152','461245P311','5497382P81','266847P99','461245P339','461245P282']
),
updated_at = now()
WHERE destination_id = '662' 
AND NOT product_codes_pending @> ARRAY['42771P153'];