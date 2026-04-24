
-- Seed destinations table with popular global destinations
INSERT INTO destinations (name, country, image_url, price, rating, flights, is_active, sort_order)
VALUES
  ('Dubai','UAE','https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80',340,4.8,850,true,1),
  ('Bangkok','Thailand','https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=80',180,4.7,720,true,2),
  ('London','United Kingdom','https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=80',380,4.9,960,true,3),
  ('Singapore','Singapore','https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=80',250,4.8,640,true,4),
  ('Tokyo','Japan','https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80',520,4.9,480,true,5),
  ('Bali','Indonesia','https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80',190,4.7,380,true,6),
  ('Istanbul','Turkey','https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=600&q=80',200,4.6,520,true,7),
  ('Paris','France','https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80',420,4.9,880,true,8)
ON CONFLICT DO NOTHING;
