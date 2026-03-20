-- Fix infinite recursion in orders and order_items RLS policies

-- Create security definer function to check if user is the customer of an order
CREATE OR REPLACE FUNCTION public.check_order_customer(check_order_id UUID, current_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders 
    WHERE id = check_order_id AND customer_id = current_user_id
  );
$$;

-- Create security definer function to check if user is a farmer with products in an order
CREATE OR REPLACE FUNCTION public.check_order_farmer(check_order_id UUID, current_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = check_order_id AND p.farmer_id = current_user_id
  );
$$;

-- Drop offending policies
DROP POLICY IF EXISTS "Farmers can view orders with their products" ON public.orders;
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
DROP POLICY IF EXISTS "Customers can create order items" ON public.order_items;

-- Recreate policies using the security definer functions
CREATE POLICY "Farmers can view orders with their products"
  ON public.orders FOR SELECT
  USING (
    public.has_role(auth.uid(), 'farmer') AND public.check_order_farmer(id, auth.uid())
  );

CREATE POLICY "Users can view own order items"
  ON public.order_items FOR SELECT
  USING (
    public.check_order_customer(order_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'farmer') AND EXISTS (
      SELECT 1 FROM public.products WHERE id = product_id AND farmer_id = auth.uid()
    ))
  );

CREATE POLICY "Customers can create order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    public.check_order_customer(order_id, auth.uid())
  );
