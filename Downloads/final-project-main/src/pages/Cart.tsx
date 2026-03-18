import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  ShoppingCart, Trash2, Plus, Minus, ArrowLeft, Package, Leaf, Truck, Loader2, MapPin
} from 'lucide-react';
import { geocodeAddress, calculateDistance, getDeliveryCharge, reverseGeocode } from '@/lib/delivery';

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    unit: string | null;
    image_url: string | null;
    stock_quantity: number | null;
    farmer_id: string;
  };
}

interface DeliveryInfo {
  charge: number;
  distance: number;
  farmerIds: string[];
}

export default function Cart() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [shippingAddress, setShippingAddress] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [farmCoords, setFarmCoords] = useState<Map<string, { lat: number; lng: number }>>(new Map());
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [maxDistance, setMaxDistance] = useState(0);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profile) fetchCart();
  }, [profile]);

  // Load saved delivery address
  useEffect(() => {
    try {
      const saved = localStorage.getItem('farmfresh_delivery_address');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.address) setShippingAddress(parsed.address);
        if (parsed.lat && parsed.lon) setCustomerCoords({ lat: parsed.lat, lon: parsed.lon });
      }
    } catch {}
  }, []);

  // Recalculate delivery when coords or cart changes
  useEffect(() => {
    if (customerCoords && farmCoords.size > 0 && cartItems.length > 0) {
      // Get unique farmer IDs from cart
      const farmerIds = [...new Set(cartItems.map(i => i.product.farmer_id))];
      let maxDist = 0;
      farmerIds.forEach(fid => {
        const fc = farmCoords.get(fid);
        if (fc) {
          const dist = calculateDistance(fc.lat, fc.lng, customerCoords.lat, customerCoords.lon);
          if (dist > maxDist) maxDist = dist;
        }
      });
      const dist = parseFloat(maxDist.toFixed(1));
      setMaxDistance(dist);
      setDeliveryCharge(getDeliveryCharge(maxDist));
    } else {
      setDeliveryCharge(0);
      setMaxDistance(0);
    }
  }, [customerCoords, farmCoords, cartItems]);

  const fetchCart = async () => {
    if (!profile) return;
    
    const { data, error } = await supabase
      .from('cart_items')
      .select(`id, product_id, quantity, product:products(id, name, price, unit, image_url, stock_quantity, farmer_id)`)
      .eq('customer_id', profile.id);
    
    if (!error && data) {
      const items = data as unknown as CartItem[];
      setCartItems(items);

      // Fetch farm coordinates for all farmers in cart
      const farmerIds = [...new Set(items.map(i => i.product.farmer_id))];
      if (farmerIds.length > 0) {
        const { data: farms } = await supabase
          .from('farm_details')
          .select('farmer_id, farm_location, latitude, longitude')
          .in('farmer_id', farmerIds);
        
        const coordsMap = new Map<string, { lat: number; lng: number }>();
        const locationsToGeocode: { id: string; location: string }[] = [];
        
        farms?.forEach((f: any) => {
          if (f.latitude && f.longitude) {
            coordsMap.set(f.farmer_id, { lat: f.latitude, lng: f.longitude });
          } else if (f.farm_location) {
            locationsToGeocode.push({ id: f.farmer_id, location: f.farm_location });
          }
        });
        
        setFarmCoords(new Map(coordsMap)); // Set initial coords
        
        // Geocode missing coordinates in the background
        if (locationsToGeocode.length > 0) {
           Promise.all(locationsToGeocode.map(async (item) => {
             const coords = await geocodeAddress(item.location);
             return { id: item.id, coords };
           })).then(results => {
             setFarmCoords(prev => {
                const newMap = new Map(prev);
                results.forEach(res => {
                  if (res.coords) {
                    newMap.set(res.id, { lat: res.coords.lat, lng: res.coords.lon });
                  }
                });
                return newMap;
             });
           });
        }
      }
    }
    setIsLoading(false);
  };

  const handleGeocodeAddress = async () => {
    if (!shippingAddress.trim()) return;
    setIsGeocoding(true);
    const result = await geocodeAddress(shippingAddress);
    if (result) {
      setCustomerCoords(result);
      localStorage.setItem('farmfresh_delivery_address', JSON.stringify({ address: shippingAddress, lat: result.lat, lon: result.lon }));
      toast({ title: 'Address located!', description: 'Delivery charge calculated from Thrissur.' });
    } else {
      toast({ variant: 'destructive', title: 'Invalid Location', description: 'Delivery available only within Thrissur district. Please enter a valid Thrissur location.' });
    }
    setIsGeocoding(false);
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast({ variant: 'destructive', title: 'Error', description: 'Geolocation is not supported by your browser.' });
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const address = await reverseGeocode(latitude, longitude);
        
        if (address) {
          setShippingAddress(address);
          setCustomerCoords({ lat: latitude, lon: longitude });
          localStorage.setItem('farmfresh_delivery_address', JSON.stringify({ address, lat: latitude, lon: longitude }));
          toast({ title: `📍 Location detected`, description: address });
        } else {
          toast({ variant: 'destructive', title: 'Out of Bounds', description: 'Delivery available only in Thrissur. Please manually enter a valid Thrissur address.' });
        }
        setIsDetectingLocation(false);
      },
      (error) => {
        console.error(error);
        toast({ variant: 'destructive', title: 'Location Access Denied', description: 'Please allow location access or enter address manually.' });
        setIsDetectingLocation(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
      if (!error) fetchCart();
    } else {
      const { error } = await supabase.from('cart_items').update({ quantity: newQuantity }).eq('id', itemId);
      if (!error) fetchCart();
    }
  };

  const removeItem = async (itemId: string) => {
    const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
    if (!error) {
      fetchCart();
      toast({ title: 'Item removed', description: 'The item has been removed from your cart.' });
    }
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0);
  const grandTotal = cartTotal + deliveryCharge;

  const handleCheckout = async () => {
    if (!profile) return;
    if (!shippingAddress.trim()) {
      toast({ variant: 'destructive', title: 'Address required', description: 'Please enter a shipping address.' });
      return;
    }
    if (maxDistance > 80) {
      toast({ variant: 'destructive', title: 'Delivery Unavailable', description: 'Address is outside the 80km delivery limit for Thrissur.' });
      return;
    }
    if (customerCoords && farmCoords.size === 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Farm locations are missing.' });
        return;
    }

    setIsCheckingOut(true);
    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: profile.id,
          total_amount: grandTotal,
          status: 'pending',
          shipping_address: shippingAddress,
          delivery_charge: deliveryCharge,
          delivery_distance_km: maxDistance || null,
        } as any)
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cartItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product.name,
        quantity: item.quantity,
        price_at_purchase: item.product.price,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      const { error: clearError } = await supabase.from('cart_items').delete().eq('customer_id', profile.id);
      if (clearError) throw clearError;

      toast({
        title: '🎉 Order Placed Successfully!',
        description: `Your order #${order.id.slice(0, 8)} has been placed.`,
      });

      navigate(`/order-success?id=${order.id}`);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Checkout failed', description: error.message });
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-primary" />
            </div>
            <span className="font-serif text-xl font-semibold">FarmFresh</span>
          </Link>
        </div>
      </header>

      <main className="container py-8">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="gap-2 mb-6">
          <ArrowLeft className="w-4 h-4" />Back to Shop
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            <h1 className="text-3xl font-serif font-bold flex items-center gap-3">
              <ShoppingCart className="w-8 h-8" />Your Cart
            </h1>

            {cartItems.length === 0 ? (
              <Card className="py-12">
                <CardContent className="text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <ShoppingCart className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Your cart is empty</h3>
                  <p className="text-muted-foreground mb-4">Add some fresh produce to get started</p>
                  <Button onClick={() => navigate('/dashboard')}>Start Shopping</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <div className="w-20 h-20 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                          {item.product?.image_url ? (
                            <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold">{item.product?.name}</h3>
                              <p className="text-sm text-muted-foreground">₹{item.product?.price}/{item.product?.unit}</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(item.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-8 text-center font-medium">{item.quantity}</span>
                              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                            <p className="font-bold">₹{((item.product?.price || 0) * item.quantity).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Order Summary */}
          {cartItems.length > 0 && (
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{item.product?.name} × {item.quantity}</span>
                        <span>₹{((item.product?.price || 0) * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Delivery charge */}
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>₹{cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        Delivery {maxDistance > 0 && `(${maxDistance} km)`}
                      </span>
                      <span>{deliveryCharge > 0 ? `₹${deliveryCharge}` : customerCoords ? '₹0' : '—'}</span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>₹{grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="address">Shipping Address</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-xs text-primary gap-1 px-2"
                        onClick={handleDetectLocation}
                        disabled={isDetectingLocation}
                        type="button"
                      >
                        {isDetectingLocation ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                        Detect Location
                      </Button>
                    </div>
                    <Textarea
                      id="address"
                      placeholder="village/town, Thrissur, Kerala, India (Add Pincode if available)"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      rows={3}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={handleGeocodeAddress}
                      disabled={isGeocoding || !shippingAddress.trim()}
                    >
                      {isGeocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                      {customerCoords ? 'Recalculate Delivery' : 'Calculate Delivery Charge'}
                    </Button>
                    {customerCoords && deliveryCharge > 0 && maxDistance <= 80 && (
                      <p className="text-xs text-muted-foreground text-center">
                        📍 Delivery: ₹{deliveryCharge} (Distance from farm: {maxDistance} km)
                      </p>
                    )}
                    {customerCoords && maxDistance > 80 && (
                      <p className="text-xs text-destructive text-center font-bold">
                        ❌ Address is outside the 80km delivery bounds.
                      </p>
                    )}
                  </div>

                  <Button className="w-full" size="lg" onClick={handleCheckout} disabled={isCheckingOut || maxDistance > 80 || (customerCoords && farmCoords.size === 0) as boolean}>
                    {isCheckingOut ? 'Processing...' : `Place Order — ₹${grandTotal.toFixed(2)}`}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
