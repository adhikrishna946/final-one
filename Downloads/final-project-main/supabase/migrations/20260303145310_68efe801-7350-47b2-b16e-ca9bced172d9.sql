
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_role_value user_role;
BEGIN
  user_role_value := COALESCE(
    (NEW.raw_user_meta_data->>'role')::user_role,
    'customer'::user_role
  );
  
  INSERT INTO public.profiles (id, email, full_name, role, is_verified, phone, address, city, state, pincode)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    user_role_value,
    CASE WHEN user_role_value = 'farmer' THEN false ELSE true END,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'address',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state',
    NEW.raw_user_meta_data->>'pincode'
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role_value);
  
  RETURN NEW;
END;
$function$;
