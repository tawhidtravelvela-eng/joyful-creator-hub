
-- Seed popular_routes with diverse global departure data
-- This ensures the homepage trending section shows relevant routes for users worldwide

INSERT INTO popular_routes (from_code, to_code, from_city, to_city, lowest_price, currency, airline, duration, stops, search_count)
VALUES
  -- US departures (JFK, LAX, ORD, SFO, MIA)
  ('JFK','LHR','New York','London',380,'USD','BA','7h 10m',0,200),
  ('JFK','CDG','New York','Paris',420,'USD','AF','7h 30m',0,180),
  ('JFK','CUN','New York','Cancun',220,'USD','DL','4h 15m',0,170),
  ('LAX','NRT','Los Angeles','Tokyo',520,'USD','JL','11h 30m',0,160),
  ('LAX','HNL','Los Angeles','Honolulu',180,'USD','HA','5h 45m',0,155),
  ('LAX','LHR','Los Angeles','London',440,'USD','AA','10h 45m',0,145),
  ('ORD','LHR','Chicago','London',410,'USD','UA','8h 00m',0,140),
  ('ORD','CUN','Chicago','Cancun',230,'USD','AA','4h 30m',0,135),
  ('SFO','NRT','San Francisco','Tokyo',490,'USD','UA','11h 15m',0,130),
  ('MIA','BOG','Miami','Bogota',210,'USD','AV','3h 45m',0,125),

  -- UK departures (LHR, MAN)
  ('LHR','DXB','London','Dubai',350,'USD','EK','7h 00m',0,190),
  ('LHR','JFK','London','New York',380,'USD','BA','8h 00m',0,185),
  ('LHR','BCN','London','Barcelona',95,'USD','BA','2h 15m',0,175),
  ('LHR','AMS','London','Amsterdam',85,'USD','KL','1h 15m',0,165),
  ('LHR','BKK','London','Bangkok',420,'USD','TG','11h 30m',0,150),
  ('MAN','AGA','Manchester','Agadir',120,'USD','RK','3h 40m',0,120),

  -- UAE departures (DXB)
  ('DXB','LHR','Dubai','London',350,'USD','EK','7h 10m',0,195),
  ('DXB','BKK','Dubai','Bangkok',280,'USD','EK','6h 20m',0,175),
  ('DXB','MLE','Dubai','Maldives',240,'USD','EK','4h 25m',0,165),
  ('DXB','IST','Dubai','Istanbul',220,'USD','EK','4h 45m',0,155),
  ('DXB','CMB','Dubai','Colombo',200,'USD','UL','4h 30m',0,145),

  -- India departures (DEL, BOM, BLR)
  ('DEL','DXB','Delhi','Dubai',180,'USD','AI','3h 45m',0,190),
  ('DEL','BKK','Delhi','Bangkok',200,'USD','TG','4h 10m',0,170),
  ('DEL','SIN','Delhi','Singapore',250,'USD','SQ','5h 30m',0,160),
  ('BOM','DXB','Mumbai','Dubai',160,'USD','EK','3h 30m',0,185),
  ('BOM','LHR','Mumbai','London',450,'USD','AI','9h 30m',0,155),
  ('BLR','SIN','Bangalore','Singapore',180,'USD','SQ','4h 15m',0,150),

  -- Singapore departures (SIN)
  ('SIN','BKK','Singapore','Bangkok',90,'USD','SQ','2h 25m',0,180),
  ('SIN','NRT','Singapore','Tokyo',350,'USD','SQ','7h 00m',0,170),
  ('SIN','KUL','Singapore','Kuala Lumpur',45,'USD','SQ','1h 00m',0,165),
  ('SIN','DPS','Singapore','Bali',120,'USD','SQ','2h 40m',0,160),
  ('SIN','SYD','Singapore','Sydney',320,'USD','SQ','7h 50m',0,145),

  -- Malaysia departures (KUL)
  ('KUL','SIN','Kuala Lumpur','Singapore',45,'USD','MH','1h 00m',0,175),
  ('KUL','BKK','Kuala Lumpur','Bangkok',80,'USD','AK','2h 15m',0,165),
  ('KUL','NRT','Kuala Lumpur','Tokyo',330,'USD','MH','7h 00m',0,140),
  ('KUL','DPS','Kuala Lumpur','Bali',100,'USD','AK','3h 10m',0,135),

  -- Australia departures (SYD, MEL)
  ('SYD','SIN','Sydney','Singapore',320,'USD','SQ','8h 00m',0,170),
  ('SYD','NRT','Sydney','Tokyo',450,'USD','QF','9h 30m',0,155),
  ('SYD','LAX','Sydney','Los Angeles',600,'USD','QF','13h 45m',0,140),
  ('SYD','DPS','Sydney','Bali',280,'USD','QF','6h 15m',0,150),
  ('MEL','SIN','Melbourne','Singapore',310,'USD','SQ','7h 50m',0,145),

  -- Europe departures (CDG, FRA, AMS)
  ('CDG','JFK','Paris','New York',420,'USD','AF','8h 30m',0,175),
  ('CDG','DXB','Paris','Dubai',350,'USD','AF','6h 30m',0,155),
  ('CDG','BCN','Paris','Barcelona',70,'USD','AF','1h 50m',0,165),
  ('FRA','JFK','Frankfurt','New York',400,'USD','LH','9h 00m',0,160),
  ('FRA','BKK','Frankfurt','Bangkok',450,'USD','LH','10h 45m',0,140),
  ('AMS','LHR','Amsterdam','London',85,'USD','KL','1h 15m',0,155),

  -- Saudi Arabia departures (JED, RUH)
  ('JED','CAI','Jeddah','Cairo',180,'USD','SV','2h 15m',0,165),
  ('JED','IST','Jeddah','Istanbul',220,'USD','SV','4h 00m',0,150),
  ('RUH','DXB','Riyadh','Dubai',120,'USD','SV','2h 00m',0,160),
  ('RUH','CAI','Riyadh','Cairo',200,'USD','SV','2h 30m',0,145),

  -- Pakistan departures (KHI, ISB)
  ('KHI','DXB','Karachi','Dubai',160,'USD','PK','2h 30m',0,175),
  ('KHI','JED','Karachi','Jeddah',200,'USD','PK','3h 30m',0,160),
  ('ISB','DXB','Islamabad','Dubai',180,'USD','PK','3h 00m',0,155),
  ('ISB','LHR','Islamabad','London',420,'USD','PK','8h 30m',0,140),

  -- Canada departures (YYZ, YVR)
  ('YYZ','LHR','Toronto','London',420,'USD','AC','7h 30m',0,165),
  ('YYZ','CUN','Toronto','Cancun',250,'USD','AC','4h 30m',0,155),
  ('YVR','NRT','Vancouver','Tokyo',480,'USD','AC','9h 30m',0,145),
  ('YVR','HNL','Vancouver','Honolulu',280,'USD','WS','6h 00m',0,140),

  -- Turkey departures (IST)
  ('IST','LHR','Istanbul','London',180,'USD','TK','3h 50m',0,170),
  ('IST','CDG','Istanbul','Paris',160,'USD','TK','3h 30m',0,160),
  ('IST','DXB','Istanbul','Dubai',200,'USD','TK','4h 30m',0,155),

  -- Japan departures (NRT)
  ('NRT','ICN','Tokyo','Seoul',180,'USD','JL','2h 30m',0,165),
  ('NRT','BKK','Tokyo','Bangkok',320,'USD','JL','6h 30m',0,155),
  ('NRT','LAX','Tokyo','Los Angeles',520,'USD','JL','10h 00m',0,150),

  -- South Korea departures (ICN)
  ('ICN','NRT','Seoul','Tokyo',180,'USD','KE','2h 20m',0,160),
  ('ICN','BKK','Seoul','Bangkok',280,'USD','KE','5h 30m',0,150),
  ('ICN','SIN','Seoul','Singapore',320,'USD','KE','6h 20m',0,140)

ON CONFLICT DO NOTHING;
