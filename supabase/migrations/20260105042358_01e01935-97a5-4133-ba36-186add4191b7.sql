-- Phase 1: Repair existing user data

-- Insert missing profiles for users who don't have one
INSERT INTO public.profiles (user_id, full_name)
SELECT u.id, COALESCE(u.raw_user_meta_data ->> 'full_name', SPLIT_PART(u.email, '@', 1))
FROM auth.users u
WHERE u.id NOT IN (SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;

-- Insert missing user_settings for users who don't have one
INSERT INTO public.user_settings (user_id)
SELECT u.id FROM auth.users u
WHERE u.id NOT IN (SELECT user_id FROM public.user_settings WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;

-- Insert missing simulator_settings for users who don't have one
INSERT INTO public.simulator_settings (user_id)
SELECT u.id FROM auth.users u
WHERE u.id NOT IN (SELECT user_id FROM public.simulator_settings WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;

-- Insert missing investor role for users who don't have any roles
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'investor'::app_role FROM auth.users u
WHERE u.id NOT IN (SELECT user_id FROM public.user_roles WHERE user_id IS NOT NULL)
ON CONFLICT (user_id, role) DO NOTHING;