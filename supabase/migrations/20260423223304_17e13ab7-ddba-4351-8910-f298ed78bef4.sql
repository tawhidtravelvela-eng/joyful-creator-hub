INSERT INTO public.platform_module_settings (module_key, display_name, is_enabled, notes)
VALUES ('ai_trip_planner', 'AI Trip Planner', true, 'Global kill-switch for the Vela AI Trip Planner across all tenant sites and the platform homepage')
ON CONFLICT (module_key) DO NOTHING;