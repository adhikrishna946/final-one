
-- Add latitude and longitude to farm_details
ALTER TABLE public.farm_details ADD COLUMN IF NOT EXISTS latitude numeric DEFAULT NULL;
ALTER TABLE public.farm_details ADD COLUMN IF NOT EXISTS longitude numeric DEFAULT NULL;

-- Add delivery_charge and delivery_distance to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_charge numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_distance_km numeric DEFAULT NULL;
