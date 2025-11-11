-- Function to link new users to existing shares
CREATE OR REPLACE FUNCTION public.link_new_user_to_shares()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update any shares that match the new user's email
  UPDATE public.position_shares
  SET shared_with_user_id = NEW.id
  WHERE shared_with_email = NEW.email
    AND shared_with_user_id IS NULL;
  
  RETURN NEW;
END;
$$;

-- Trigger to run after user signup
CREATE TRIGGER on_auth_user_created_link_shares
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_new_user_to_shares();