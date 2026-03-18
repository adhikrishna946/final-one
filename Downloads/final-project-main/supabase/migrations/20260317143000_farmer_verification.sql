-- Farmer verification system (Kisan ID based)

-- 1) Verification status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'farmer_verification_status') THEN
    CREATE TYPE public.farmer_verification_status AS ENUM ('pending', 'verified', 'rejected');
  END IF;
END $$;

-- 2) Add verification fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kisan_id text,
  ADD COLUMN IF NOT EXISTS verification_status public.farmer_verification_status,
  ADD COLUMN IF NOT EXISTS verification_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 3) Prevent duplicate Kisan IDs (case-insensitive) when provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'profiles_kisan_id_unique_ci'
  ) THEN
    CREATE UNIQUE INDEX profiles_kisan_id_unique_ci
      ON public.profiles ((lower(kisan_id)))
      WHERE kisan_id IS NOT NULL;
  END IF;
END $$;

-- 4) Backfill verification_status for existing farmers
UPDATE public.profiles
SET
  verification_status = CASE
    WHEN role = 'farmer'::public.user_role AND is_verified = true THEN 'verified'::public.farmer_verification_status
    WHEN role = 'farmer'::public.user_role AND is_verified = false THEN COALESCE(verification_status, 'pending'::public.farmer_verification_status)
    ELSE verification_status
  END
WHERE role = 'farmer'::public.user_role;

-- 5) Tighten RLS: users can update their profile but cannot change verification fields
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can update own profile'
  ) THEN
    EXECUTE 'DROP POLICY "Users can update own profile" ON public.profiles';
  END IF;
END $$;

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    -- Farmers can submit/resubmit verification (set pending), but can never self-verify.
    AND (
      is_verified = (SELECT is_verified FROM public.profiles WHERE id = auth.uid())
      OR (
        role = 'farmer'::public.user_role
        AND (SELECT is_verified FROM public.profiles WHERE id = auth.uid()) = false
        AND is_verified = false
      )
    )
    AND (
      verification_status IS NOT DISTINCT FROM (SELECT verification_status FROM public.profiles WHERE id = auth.uid())
      OR (
        role = 'farmer'::public.user_role
        AND verification_status = 'pending'::public.farmer_verification_status
      )
    )
    AND (
      verification_requested_at IS NOT DISTINCT FROM (SELECT verification_requested_at FROM public.profiles WHERE id = auth.uid())
      OR (
        role = 'farmer'::public.user_role
        AND verification_status = 'pending'::public.farmer_verification_status
      )
    )
    -- Verified fields can only be set by admins.
    AND verified_at IS NOT DISTINCT FROM (SELECT verified_at FROM public.profiles WHERE id = auth.uid())
    AND verified_by IS NOT DISTINCT FROM (SELECT verified_by FROM public.profiles WHERE id = auth.uid())
    -- On resubmission, rejection fields must be cleared (or unchanged).
    AND (
      rejected_at IS NOT DISTINCT FROM (SELECT rejected_at FROM public.profiles WHERE id = auth.uid())
      OR (role = 'farmer'::public.user_role AND rejected_at IS NULL)
    )
    AND (
      rejected_by IS NOT DISTINCT FROM (SELECT rejected_by FROM public.profiles WHERE id = auth.uid())
      OR (role = 'farmer'::public.user_role AND rejected_by IS NULL)
    )
    AND (
      rejection_reason IS NOT DISTINCT FROM (SELECT rejection_reason FROM public.profiles WHERE id = auth.uid())
      OR (role = 'farmer'::public.user_role AND rejection_reason IS NULL)
    )
  );

-- 6) Update new-user trigger to initialize verification status for farmers
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

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    is_verified,
    phone,
    address,
    city,
    state,
    pincode,
    verification_status
  )
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
    NEW.raw_user_meta_data->>'pincode',
    CASE WHEN user_role_value = 'farmer' THEN 'pending'::public.farmer_verification_status ELSE NULL END
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role_value);

  RETURN NEW;
END;
$function$;

