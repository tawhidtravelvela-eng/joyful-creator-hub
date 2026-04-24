INSERT INTO airline_settings (airline_code, airline_name, cabin_baggage, checkin_baggage, cancellation_policy, date_change_policy, name_change_policy, no_show_policy)
VALUES 
  ('BS', 'US-Bangla Airlines', '7 Kg', '30 Kg', 'Cancellation allowed with fee before departure', 'Date change allowed with fee', 'Name change not allowed', 'No-show results in ticket forfeiture'),
  ('BG', 'Biman Bangladesh Airlines', '7 Kg', '30 Kg', 'Cancellation allowed with fee', 'Date change allowed with fee', 'Name change not allowed after ticketing', 'No-show results in ticket forfeiture'),
  ('VQ', 'Novoair', '7 Kg', '20 Kg', 'Cancellation allowed with fee', 'Date change allowed with fee', 'Name change not allowed', 'No-show results in ticket forfeiture'),
  ('EK', 'Emirates', '7 Kg', '30 Kg', 'Cancellation allowed with fee', 'Date change allowed with fee', 'Name correction allowed', 'No-show: ticket valid for rebooking within 1 year'),
  ('QR', 'Qatar Airways', '7 Kg', '30 Kg', 'Cancellation allowed with fee based on fare rules', 'Date change allowed with fee', 'Name correction allowed', 'No-show penalty applies'),
  ('SQ', 'Singapore Airlines', '7 Kg', '30 Kg', 'Cancellation allowed with fee', 'Date change allowed with fee', 'Name correction allowed', 'No-show penalty applies'),
  ('TK', 'Turkish Airlines', '8 Kg', '30 Kg', 'Cancellation allowed with fee', 'Date change allowed with fee', 'Name correction allowed', 'No-show penalty applies'),
  ('SV', 'Saudia', '7 Kg', '23 Kg', 'Cancellation allowed with fee', 'Date change allowed with fee', 'Name change not allowed', 'No-show penalty applies'),
  ('6E', 'IndiGo', '7 Kg', '15 Kg', 'Cancellation fee applies', 'Date change with fee', 'Name change not allowed', 'No-show: full fare forfeiture'),
  ('AI', 'Air India', '8 Kg', '25 Kg', 'Cancellation allowed with fee', 'Date change allowed with fee', 'Name correction allowed', 'No-show penalty applies')
ON CONFLICT (airline_code) DO UPDATE SET
  airline_name = EXCLUDED.airline_name,
  cabin_baggage = EXCLUDED.cabin_baggage,
  checkin_baggage = EXCLUDED.checkin_baggage,
  cancellation_policy = EXCLUDED.cancellation_policy,
  date_change_policy = EXCLUDED.date_change_policy,
  name_change_policy = EXCLUDED.name_change_policy,
  no_show_policy = EXCLUDED.no_show_policy,
  updated_at = now();