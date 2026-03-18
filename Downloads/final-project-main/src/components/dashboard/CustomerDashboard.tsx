import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Search, ShoppingCart, Package, Plus, Minus, ClipboardList, Clock, MapPin, TrendingUp, Loader2, Truck } from 'lucide-react';
import FloatingCart from '@/components/cart/FloatingCart';
import { geocodeAddress, calculateDistance, getDeliveryCharge, reverseGeocode } from '@/lib/delivery';

interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  unit: string | null;
  image_url: string | null;
  stock_quantity: number | null;
  farmer_id: string;
  expiry_date: string | null;
  farm_location?: string | null;
  market_price?: number | null;
  farm_lat?: number | null;
  farm_lng?: number | null;
  delivery_charge?: number | null;
  delivery_distance?: number | null;
}

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  product: Product;
}

interface Order {
  id: string;
  total_amount: number;
  status: string;
  shipping_address: string | null;
  created_at: string;
  delivery_charge?: number;
  delivery_distance_km?: number;
  order_items: OrderItem[];
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  price_at_purchase: number;
}

export default function CustomerDashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Delivery address state
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  const categories = ['vegetables', 'rice', 'fruits', 'dairy', 'other'];

  useEffect(() => {
    fetchProducts();
    fetchCart();
    fetchOrders();
    // Load saved delivery address
    const saved = localStorage.getItem('farmfresh_delivery_address');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setDeliveryAddress(parsed.address || '');
        if (parsed.lat && parsed.lon) setCustomerCoords({ lat: parsed.lat, lon: parsed.lon });
      } catch {}
    }
  }, [profile]);

  // Recalculate delivery charges when customer coords change
  useEffect(() => {
    if (customerCoords) {
      setProducts(prev => prev.map(p => {
        if (p.farm_lat && p.farm_lng) {
          const dist = calculateDistance(p.farm_lat, p.farm_lng, customerCoords.lat, customerCoords.lon);
          return { ...p, delivery_distance: parseFloat(dist.toFixed(1)), delivery_charge: getDeliveryCharge(dist) };
        }
        return { ...p, delivery_distance: null, delivery_charge: null };
      }));
    }
  }, [customerCoords]);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_available', true)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      const now = new Date().toISOString().split('T')[0];
      const active = data.filter((p: any) => !p.expiry_date || p.expiry_date >= now);
      
      // Fetch farm details (location + coordinates) for all farmer IDs
      const farmerIds = [...new Set(active.map((p: any) => p.farmer_id))];
      const { data: farms } = await supabase
        .from('farm_details')
        .select('farmer_id, farm_location, latitude, longitude')
        .in('farmer_id', farmerIds);
      
      const farmMap = new Map(farms?.map(f => [f.farmer_id, {
        location: f.farm_location,
        lat: (f as any).latitude,
        lng: (f as any).longitude,
      }]) || []);

      // Load saved coords
      let savedCoords: { lat: number; lon: number } | null = null;
      try {
        const saved = localStorage.getItem('farmfresh_delivery_address');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.lat && parsed.lon) savedCoords = { lat: parsed.lat, lon: parsed.lon };
        }
      } catch {}
      // Map farm details to products
      const productsWithLocation = active.map((p: any) => {
        const farm = farmMap.get(p.farmer_id);
        
        return {
          ...p,
          farm_location: farm?.location || null,
          market_price: null,
          farm_lat: farm?.lat ?? null, // Start with DB coords if any exist
          farm_lng: farm?.lng ?? null,
          delivery_distance: null, 
          delivery_charge: null,
        };
      }) as Product[];

      // Initial DB rendering with available coordinates synchronously
      if (savedCoords) {
        setProducts(productsWithLocation.map(p => {
           let deliveryDistance: number | null = null;
           let deliveryCharge: number | null = null;
           
           if (p.farm_lat && p.farm_lng) {
             const dist = calculateDistance(p.farm_lat, p.farm_lng, savedCoords!.lat, savedCoords!.lon);
             deliveryDistance = parseFloat(dist.toFixed(1));
             deliveryCharge = getDeliveryCharge(dist);
           }
           
           return { ...p, delivery_distance: deliveryDistance, delivery_charge: deliveryCharge };
        }));
      } else {
        setProducts(productsWithLocation);
      }
      
      // Background task: Geocode any missing text farm locations
      const uniqueLocations = [...new Set(productsWithLocation.map(p => p.farm_location).filter(Boolean))] as string[];
      if (uniqueLocations.length > 0) {
        const geocodePromises = uniqueLocations.map(async (loc) => {
          const coords = await geocodeAddress(loc);
          return { loc, coords };
        });
        
        Promise.all(geocodePromises).then(results => {
          const locationCoordsMap = new Map();
          results.forEach(res => {
            if (res.coords) {
              locationCoordsMap.set(res.loc, res.coords);
            }
          });
          
          if (locationCoordsMap.size > 0) {
            setProducts(prevProducts => prevProducts.map(p => {
              // If we already had lat/lng from the DB, prefer that, else use newly geocoded from text
              const pLat = p.farm_lat || (p.farm_location ? locationCoordsMap.get(p.farm_location)?.lat : null);
              const pLng = p.farm_lng || (p.farm_location ? locationCoordsMap.get(p.farm_location)?.lon : null); // Note: geocodeAddress returns 'lon'
              
              let deliveryDistance: number | null = null;
              let deliveryCharge: number | null = null;
              
              if (pLat && pLng && savedCoords) {
                const dist = calculateDistance(pLat, pLng, savedCoords.lat, savedCoords.lon);
                deliveryDistance = parseFloat(dist.toFixed(1));
                deliveryCharge = getDeliveryCharge(dist);
              }
              
              return {
                ...p,
                farm_lat: pLat,
                farm_lng: pLng,
                delivery_distance: deliveryDistance,
                delivery_charge: deliveryCharge,
              };
            }));
          }
        });
      }


      // Fetch market prices in background
      const uniqueNames = [...new Set(productsWithLocation.map(p => p.name))];
      const marketPriceMap = new Map<string, number>();
      
      await Promise.all(
        uniqueNames.map(async (name) => {
          try {
            const { data: mpData } = await supabase.functions.invoke('get-market-price', {
              body: { commodity: name, state: 'Karnataka' }
            });
            if (mpData?.market_price?.per_kg) {
              marketPriceMap.set(name, mpData.market_price.per_kg);
            }
          } catch {}
        })
      );
      
      if (marketPriceMap.size > 0) {
        setProducts(prev => prev.map(p => ({
          ...p,
          market_price: marketPriceMap.get(p.name) || null,
        })));
      }
    }
    setIsLoading(false);
  };

  const handleGeocodeDeliveryAddress = async () => {
    if (!deliveryAddress.trim()) return;
    setIsGeocoding(true);
    const result = await geocodeAddress(deliveryAddress);
    if (result) {
      setCustomerCoords(result);
      localStorage.setItem('farmfresh_delivery_address', JSON.stringify({ address: deliveryAddress, lat: result.lat, lon: result.lon }));
      toast({ title: 'Address located in Thrissur!', description: 'Delivery charges updated for products.' });
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
          setDeliveryAddress(address);
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

  const fetchCart = async () => {
    if (!profile) return;
    
    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        id,
        product_id,
        quantity,
        product:products(*)
      `)
      .eq('customer_id', profile.id);
    
    if (!error && data) {
      setCartItems(data as unknown as CartItem[]);
    }
  };

  const fetchOrders = async () => {
    if (!profile) return;
    
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        total_amount,
        status,
        shipping_address,
        created_at,
        delivery_charge,
        delivery_distance_km,
        order_items(id, product_name, quantity, price_at_purchase)
      `)
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setOrders(data as unknown as Order[]);
    }
  };

  const getCartQuantity = (productId: string) => {
    const item = cartItems.find(i => i.product_id === productId);
    return item?.quantity || 0;
  };

  const addToCart = async (product: Product) => {
    if (!profile) {
      toast({ variant: 'destructive', title: 'Please log in', description: 'You need to be logged in to add items to cart.' });
      return;
    }

    try {
      const existingItem = cartItems.find(i => i.product_id === product.id);
      
      if (existingItem) {
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity: existingItem.quantity + 1 })
          .eq('id', existingItem.id);
        if (!error) await fetchCart();
      } else {
        const { error } = await supabase
          .from('cart_items')
          .insert({ customer_id: profile.id, product_id: product.id, quantity: 1 });
        if (!error) {
          await fetchCart();
          toast({ title: 'Added to cart!', description: `${product.name} has been added to your cart.` });
        }
      }
    } catch (error) {
      console.error('Error adding item to cart:', error);
    }
  };

  const updateCartQuantity = async (productId: string, change: number) => {
    const existingItem = cartItems.find(i => i.product_id === productId);
    if (!existingItem) return;
    const newQuantity = existingItem.quantity + change;

    if (newQuantity <= 0) {
      const { error } = await supabase.from('cart_items').delete().eq('id', existingItem.id);
      if (!error) fetchCart();
    } else {
      const { error } = await supabase.from('cart_items').update({ quantity: newQuantity }).eq('id', existingItem.id);
      if (!error) fetchCart();
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const cartTotal = cartItems.reduce((sum, item) => 
    sum + (item.product?.price || 0) * item.quantity, 0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold">Fresh Market</h1>
          <p className="text-muted-foreground">Farm-fresh produce delivered to you</p>
        </div>
        
        {cartItems.length > 0 && (
          <Card className="px-4 py-2">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">{cartItems.length} items</p>
                <p className="text-xs text-muted-foreground">₹{cartTotal.toFixed(2)}</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Delivery Address Input */}
      <Card className="border-primary/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Your Delivery Address</span>
            <div className="ml-auto flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs text-primary gap-1 px-2"
                onClick={handleDetectLocation}
                disabled={isDetectingLocation}
              >
                {isDetectingLocation ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                Detect
              </Button>
              {customerCoords && (
                <Badge variant="secondary" className="text-[10px]">📍 Located</Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="village/town, Thrissur, Kerala, India (Add Pincode if available)"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGeocodeDeliveryAddress()}
              className="flex-1"
            />
            <Button
              onClick={handleGeocodeDeliveryAddress}
              disabled={isGeocoding || !deliveryAddress.trim()}
              size="sm"
            >
              {isGeocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Locate'}
            </Button>
          </div>
          {!customerCoords && (
            <p className="text-xs text-muted-foreground mt-2">
              Enter your address to see delivery charges for each product.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="shop" className="space-y-4">
        <TabsList>
          <TabsTrigger value="shop">Shop</TabsTrigger>
          <TabsTrigger value="orders" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            My Orders ({orders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shop" className="space-y-6">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
              <Button variant={selectedCategory === null ? 'default' : 'outline'} size="sm" onClick={() => setSelectedCategory(null)}>All</Button>
              {categories.map((cat) => (
                <Button key={cat} variant={selectedCategory === cat ? 'default' : 'outline'} size="sm" onClick={() => setSelectedCategory(cat)} className="capitalize whitespace-nowrap">{cat}</Button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Card key={i} className="animate-pulse">
                  <div className="aspect-square bg-muted rounded-t-lg" />
                  <CardContent className="pt-4 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No products found</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? 'Try a different search term' : 'Products will appear here soon'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map((product) => {
                const cartQty = getCartQuantity(product.id);
                
                return (
                  <Card key={product.id} className="overflow-hidden group">
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-12 h-12 text-muted-foreground/50" />
                        </div>
                      )}
                      <Badge className="absolute top-2 left-2 capitalize">{product.category}</Badge>
                      {product.expiry_date && (() => {
                        const daysUntil = Math.ceil((new Date(product.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        if (daysUntil <= 3 && daysUntil >= 0) {
                          return (
                            <Badge variant="secondary" className="absolute top-2 right-2 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                              <Clock className="w-3 h-3 mr-1" />Expiring Soon
                            </Badge>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    
                    <CardContent className="pt-4">
                      <h3 className="font-semibold line-clamp-1">{product.name}</h3>
                      {product.farm_location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="line-clamp-1">{product.farm_location}</span>
                        </p>
                      )}
                      {product.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{product.description}</p>
                      )}
                      
                      {/* Pricing section */}
                      <div className="mt-3 space-y-1">
                        <p className="font-bold text-primary text-lg">₹{product.price}/{product.unit}</p>
                        
                        {/* Market price comparison */}
                        {product.market_price && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <TrendingUp className="w-3 h-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Market: ₹{product.market_price}/kg</span>
                            {product.price < product.market_price ? (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">Below Market</Badge>
                            ) : product.price > product.market_price ? (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">Above Market</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">At Market</Badge>
                            )}
                          </div>
                        )}

                        {/* Delivery charge */}
                        {product.delivery_distance !== null && product.delivery_distance !== undefined && product.delivery_distance > 80 ? (
                          <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span>Location too far ({product.delivery_distance} km). Max 80 km.</span>
                          </div>
                        ) : product.delivery_charge !== null && product.delivery_charge !== undefined ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Truck className="w-3 h-3 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Delivery: ₹{product.delivery_charge} (Distance from farm: {product.delivery_distance} km)
                            </span>
                          </div>
                        ) : customerCoords ? (
                          <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                            <Truck className="w-3 h-3" />
                            <span>Delivery not available</span>
                          </div>
                        ) : null}

                        {/* Total with delivery */}
                        {product.delivery_charge !== null && product.delivery_charge !== undefined && product.delivery_distance !== null && product.delivery_distance <= 80 && (
                          <div className="pt-1 border-t border-border/50">
                            <p className="text-xs font-medium">
                              Total: ₹{(product.price + product.delivery_charge).toFixed(2)}/{product.unit} (incl. delivery)
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-end mt-2">
                        {(!product.delivery_distance && customerCoords) || (product.delivery_distance !== null && product.delivery_distance > 80) ? (
                            <Badge variant="outline" className="text-muted-foreground border-destructive/20 text-destructive">Unavailable</Badge>
                        ) : cartQty > 0 ? (
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateCartQuantity(product.id, -1)}>
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-6 text-center text-sm font-medium">{cartQty}</span>
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateCartQuantity(product.id, 1)}>
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" onClick={() => addToCart(product)} className="gap-1">
                            <Plus className="w-3 h-3" />Add
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* My Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                My Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <ClipboardList className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
                  <p className="text-muted-foreground">Your orders will appear here after checkout</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold">Order #{order.id.slice(0, 8)}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant={order.status === 'completed' ? 'default' : order.status === 'pending' ? 'secondary' : 'outline'} className="capitalize">{order.status}</Badge>
                          <p className="font-bold mt-1">₹{order.total_amount}</p>
                        </div>
                      </div>
                      
                      <div className="border-t pt-3 space-y-2">
                        {order.order_items.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{item.product_name} × {item.quantity}</span>
                            <span>₹{(item.price_at_purchase * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                        {order.delivery_charge !== undefined && order.delivery_charge !== null && order.delivery_charge > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Truck className="w-3 h-3" /> Delivery ({order.delivery_distance_km} km)
                            </span>
                            <span>₹{order.delivery_charge}</span>
                          </div>
                        )}
                      </div>

                      {order.shipping_address && (
                        <div className="border-t pt-3 mt-3">
                          <p className="text-xs text-muted-foreground">Shipping to:</p>
                          <p className="text-sm">{order.shipping_address}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <FloatingCart cartItems={cartItems} onUpdateQuantity={updateCartQuantity} />
    </div>
  );
}
