-- Remove all stale GPT-5 Nano entries (all were low-confidence $0 guesses)
DELETE FROM public.activity_price_cache WHERE source = 'ai-GPT-5 Nano';

-- Fix specific paid attractions incorrectly cached as free/zero
DELETE FROM public.activity_price_cache 
WHERE price_usd = 0 
  AND activity_name IN (
    'zoo negara', 'zoo negara kuala lumpur', 'artscience museum', 
    'aquaria kl', 'sky world theme park', 'sky park observation deck',
    'sky bridge (cable car inclusive)', 'sentosa island (cable car)',
    'universal studio (express pass)', 'genting highland (sky world theme park)',
    'penang hills (guided day trip)', 'penang hills (guided day trip covering few other locations)',
    'marina bay sands', 'sentosa island', 'genting highland'
  );