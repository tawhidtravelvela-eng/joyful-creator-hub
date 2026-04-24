-- ============================================================
-- PHASE 3.2 — SECTION LIBRARY EXPANSION
-- ============================================================

INSERT INTO public.whitelabel_section_registry (type_key, display_name, description, category, icon, default_config, is_active, is_premium, sort_order) VALUES
  -- Content
  ('rich_text', 'Rich Text', 'Long-form formatted content (terms, policies, about copy).', 'content', 'FileText',
   '{"title":"","content":"<p>Your content here. Use HTML for formatting.</p>","maxWidth":"prose","align":"left"}'::jsonb, true, false, 200),

  ('image_text_split', 'Image + Text', 'Image on one side, copy on the other. Alternate blocks for storytelling.', 'content', 'Columns2',
   '{"headline":"Built for modern travel","subtitle":"From quick getaways to lifetime journeys, every detail handled.","image":"https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200","imagePosition":"right","ctaText":"","ctaLink":""}'::jsonb, true, false, 210),

  ('team_grid', 'Team Grid', 'Showcase your team — photos, names, roles, bios.', 'content', 'Users',
   '{"title":"Meet the team","subtitle":"The people behind your trips.","members":[{"name":"Alex Carter","role":"Founder","image":"https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400","bio":""},{"name":"Maya Singh","role":"Head of Trips","image":"https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400","bio":""},{"name":"Jordan Lee","role":"Travel Designer","image":"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400","bio":""}]}'::jsonb, true, false, 220),

  ('stats_band', 'Stats Band', 'Big numbers strip — 10K+ travelers, 50+ countries, 4.9★ rating.', 'content', 'BarChart3',
   '{"title":"","items":[{"value":"10K+","label":"Happy travelers"},{"value":"50+","label":"Countries"},{"value":"4.9★","label":"Average rating"},{"value":"24/7","label":"Support"}],"background":"primary"}'::jsonb, true, false, 230),

  ('quote_band', 'Quote Band', 'Single large pull-quote with attribution.', 'content', 'Quote',
   '{"quote":"The trip exceeded every expectation. Every detail was anticipated, every moment intentional.","author":"Sarah K.","authorRole":"Honeymoon — Maldives","background":"muted"}'::jsonb, true, false, 240),

  ('timeline', 'Timeline / Steps', 'Numbered steps, milestones, or "how it works" flow.', 'content', 'ListOrdered',
   '{"title":"How it works","steps":[{"title":"Tell us your dream","description":"Share where, when, and what kind of trip you want."},{"title":"We design it","description":"A travel expert curates a personalized plan within 24 hours."},{"title":"Book and go","description":"Confirm in one click. We handle every detail."}]}'::jsonb, true, false, 250),

  -- Marketing
  ('feature_grid', 'Feature Grid', 'Icon + title + description grid for product features or services.', 'marketing', 'Grid3x3',
   '{"title":"Why choose us","subtitle":"","columns":3,"items":[{"icon":"Zap","title":"Instant booking","description":"Confirm trips in seconds, not days."},{"icon":"Shield","title":"Protected","description":"Every booking covered by our guarantee."},{"icon":"Heart","title":"Curated","description":"Hand-picked stays and experiences."},{"icon":"Globe","title":"Worldwide","description":"50+ countries, one trusted partner."},{"icon":"Headphones","title":"24/7 support","description":"Real humans, anytime, anywhere."},{"icon":"Sparkles","title":"AI-powered","description":"Smart suggestions tailored to you."}]}'::jsonb, true, false, 300),

  ('pricing_table', 'Pricing Table', 'Tiered pricing comparison — Starter / Pro / Enterprise.', 'marketing', 'CreditCard',
   '{"title":"Simple, transparent pricing","subtitle":"Choose the plan that fits your travel style.","tiers":[{"name":"Essentials","price":"Free","period":"forever","description":"Perfect for occasional travelers","features":["Search flights & hotels","Basic trip planning","Email support"],"ctaText":"Get started","highlighted":false},{"name":"Pro","price":"$29","period":"/month","description":"For frequent travelers","features":["Everything in Essentials","Priority support","Concierge service","Lounge access discounts"],"ctaText":"Start free trial","highlighted":true},{"name":"Enterprise","price":"Custom","period":"","description":"For travel agencies","features":["Unlimited bookings","API access","Dedicated manager","White-label options"],"ctaText":"Contact sales","highlighted":false}]}'::jsonb, true, false, 310),

  ('logo_cloud', 'Logo Cloud', 'Partner, press, or supplier logo strip with grayscale hover.', 'marketing', 'Building2',
   '{"title":"Trusted by leading brands","logos":[{"name":"Marriott","url":"https://logo.clearbit.com/marriott.com"},{"name":"Emirates","url":"https://logo.clearbit.com/emirates.com"},{"name":"Booking","url":"https://logo.clearbit.com/booking.com"},{"name":"IATA","url":"https://logo.clearbit.com/iata.org"},{"name":"Visa","url":"https://logo.clearbit.com/visa.com"}]}'::jsonb, true, false, 320),

  ('comparison_table', 'Comparison Table', 'Feature-by-feature comparison rows.', 'marketing', 'TableProperties',
   '{"title":"How we compare","columns":["Feature","Us","Other agencies"],"rows":[["Live pricing","✓","✗"],["Free cancellation","✓","Sometimes"],["24/7 expert support","✓","Email only"],["Multi-currency","✓","✗"]]}'::jsonb, true, false, 330),

  -- Forms
  ('lead_capture', 'Lead Capture', 'Short inline form — name, email, destination interest.', 'forms', 'UserPlus',
   '{"title":"Get a custom trip plan","subtitle":"Tell us about your dream trip — we''ll respond within 24 hours.","fields":["name","email","destination","travelers"],"submitText":"Request a plan","successMessage":"Thank you! We''ll be in touch shortly."}'::jsonb, true, false, 400),

  ('newsletter_inline', 'Newsletter (Inline)', 'Minimal email-only strip — perfect for blog post bottoms.', 'forms', 'Mail',
   '{"title":"Get travel deals in your inbox","subtitle":"","ctaText":"Subscribe","compact":true}'::jsonb, true, false, 410),

  -- Media
  ('gallery_masonry', 'Photo Gallery', 'Masonry image grid with lightbox on click.', 'media', 'Image',
   '{"title":"Recent trips","columns":3,"images":[{"url":"https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800","alt":"Travel"},{"url":"https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800","alt":"Mountain"},{"url":"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800","alt":"Beach"},{"url":"https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800","alt":"Paris"},{"url":"https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800","alt":"Maldives"},{"url":"https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800","alt":"Istanbul"}]}'::jsonb, true, false, 500),

  ('video_embed', 'Video Embed', 'YouTube, Vimeo, or MP4 embed with optional caption.', 'media', 'Video',
   '{"title":"","videoUrl":"https://www.youtube.com/embed/dQw4w9WgXcQ","caption":"","aspectRatio":"16:9","autoplay":false}'::jsonb, true, false, 510),

  ('map_embed', 'Map Embed', 'Embed a Google Map showing your office or a destination.', 'media', 'MapPin',
   '{"title":"Visit us","address":"123 Travel Street, Dubai, UAE","embedUrl":"","height":400,"showAddress":true}'::jsonb, true, false, 520),

  -- Blog
  ('blog_post_grid', 'Blog Post Grid', 'List latest posts with optional category filter.', 'blog', 'Newspaper',
   '{"title":"From the journal","limit":6,"columns":3,"showCategory":true,"showExcerpt":true,"category":""}'::jsonb, true, false, 600),

  ('blog_post_renderer', 'Blog Post Body', 'Renders a single blog post (used on dynamic post pages).', 'blog', 'BookOpen',
   '{"showAuthor":true,"showDate":true,"showShareButtons":true,"showRelated":true}'::jsonb, true, false, 610),

  -- Custom / power-user
  ('custom_html', 'Custom HTML', 'Raw HTML block for advanced customization.', 'custom', 'Code',
   '{"html":"<div style=\"padding:2rem;text-align:center;\">\n  <h2>Your custom HTML here</h2>\n  <p>Edit in the inspector.</p>\n</div>"}'::jsonb, true, true, 700),

  ('custom_embed', 'Custom Embed', 'Embed third-party widgets — booking calculators, chat, scripts.', 'custom', 'Plug',
   '{"embedCode":"","height":500,"sandboxed":true}'::jsonb, true, true, 710)

ON CONFLICT (type_key) DO NOTHING;