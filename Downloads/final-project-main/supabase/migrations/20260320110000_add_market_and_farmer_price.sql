-- Migration: add_market_and_farmer_price
-- Adds pricing columns for AgMarkNet API integration

ALTER TABLE public.products
ADD COLUMN market_price NUMERIC,
ADD COLUMN farmer_price NUMERIC;

-- Backfill existing products so they have a farmer_price
UPDATE public.products
SET farmer_price = price
WHERE farmer_price IS NULL;
