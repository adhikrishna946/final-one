
-- Add expiry_date to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS expiry_date date;

-- Add city, state, pincode to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pincode text;

-- Create farm_details table
CREATE TABLE IF NOT EXISTS public.farm_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  farm_name text NOT NULL,
  farm_location text,
  total_area numeric,
  area_unit text DEFAULT 'acres',
  farming_type text DEFAULT 'conventional',
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on farm_details
ALTER TABLE public.farm_details ENABLE ROW LEVEL SECURITY;

-- RLS: Farmers can manage own farm details
CREATE POLICY "Farmers can view own farm details" ON public.farm_details
  FOR SELECT USING (farmer_id = auth.uid() OR has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Farmers can insert own farm details" ON public.farm_details
  FOR INSERT WITH CHECK (farmer_id = auth.uid() AND has_role(auth.uid(), 'farmer'::user_role));

CREATE POLICY "Farmers can update own farm details" ON public.farm_details
  FOR UPDATE USING (farmer_id = auth.uid());

-- Allow anyone authenticated to view farm details (for product listings)
CREATE POLICY "Authenticated users can view farm details" ON public.farm_details
  FOR SELECT TO authenticated USING (true);
