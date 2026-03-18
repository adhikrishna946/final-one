-- Create user roles enum
CREATE TYPE public.user_role AS ENUM ('farmer', 'customer', 'admin');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'customer',
  is_verified BOOLEAN DEFAULT false,
  avatar_url TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'vegetables',
  price DECIMAL(10,2) NOT NULL,
  unit TEXT DEFAULT 'kg',
  image_url TEXT,
  stock_quantity INTEGER DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create cart_items table
CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(customer_id, product_id)
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  shipping_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create order_items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_at_purchase DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_roles table for role checking (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper function to get user role from profiles
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id
$$;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_value user_role;
BEGIN
  -- Get role from metadata or default to customer
  user_role_value := COALESCE(
    (NEW.raw_user_meta_data->>'role')::user_role,
    'customer'::user_role
  );
  
  -- Insert into profiles
  INSERT INTO public.profiles (id, email, full_name, role, is_verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    user_role_value,
    CASE WHEN user_role_value = 'admin' THEN true ELSE false END
  );
  
  -- Insert into user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role_value);
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add update triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for products
CREATE POLICY "Anyone authenticated can view available products"
  ON public.products FOR SELECT
  USING (is_available = true OR farmer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Farmers can create products"
  ON public.products FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'farmer') AND farmer_id = auth.uid());

CREATE POLICY "Farmers can update own products"
  ON public.products FOR UPDATE
  USING (farmer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Farmers can delete own products"
  ON public.products FOR DELETE
  USING (farmer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies for cart_items
CREATE POLICY "Customers can view own cart"
  ON public.cart_items FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY "Customers can add to cart"
  ON public.cart_items FOR INSERT
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update own cart"
  ON public.cart_items FOR UPDATE
  USING (customer_id = auth.uid());

CREATE POLICY "Customers can remove from cart"
  ON public.cart_items FOR DELETE
  USING (customer_id = auth.uid());

-- RLS Policies for orders
CREATE POLICY "Customers can view own orders"
  ON public.orders FOR SELECT
  USING (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Farmers can view orders with their products"
  ON public.orders FOR SELECT
  USING (
    public.has_role(auth.uid(), 'farmer') AND
    EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = orders.id AND p.farmer_id = auth.uid()
    )
  );

CREATE POLICY "Customers can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Admins can update orders"
  ON public.orders FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for order_items
CREATE POLICY "Users can view own order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND customer_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'farmer') AND EXISTS (
      SELECT 1 FROM public.products WHERE id = product_id AND farmer_id = auth.uid()
    ))
  );

CREATE POLICY "Customers can create order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND customer_id = auth.uid())
  );

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Storage policies
CREATE POLICY "Anyone can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Farmers can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'farmer'));

CREATE POLICY "Farmers can update own product images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Farmers can delete own product images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);