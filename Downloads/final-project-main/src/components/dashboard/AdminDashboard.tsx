import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  Package, 
  ShoppingBag,
  Tractor
} from 'lucide-react';
import AdminFarmerApproval from './AdminFarmerApproval';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'farmer' | 'customer' | 'admin';
  is_verified: boolean;
  created_at: string;
}

interface Order {
  id: string;
  customer_id: string;
  total_amount: number;
  status: string;
  created_at: string;
  customer: Profile;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Fetch users
    const { data: usersData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (usersData) {
      setUsers(usersData as Profile[]);
      setStats(prev => ({
        ...prev,
        totalUsers: usersData.length,
      }));
    }

    // Fetch products
    const { data: productsData } = await supabase
      .from('products')
      .select('*, farmer:profiles(*)')
      .order('created_at', { ascending: false });
    
    if (productsData) {
      setProducts(productsData);
      setStats(prev => ({
        ...prev,
        totalProducts: productsData.length,
      }));
    }

    // Fetch orders
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*, customer:profiles(*)')
      .order('created_at', { ascending: false });
    
    if (ordersData) {
      setOrders(ordersData as Order[]);
      setStats(prev => ({
        ...prev,
        totalOrders: ordersData.length,
      }));
    }

    setIsLoading(false);
  };



  const updateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);
    
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } else {
      toast({
        title: 'Order updated',
        description: `Order status changed to ${status}.`,
      });
      fetchData();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-12 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-serif font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage users, products, and orders</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalProducts}</p>
                <p className="text-sm text-muted-foreground">Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-farm-sage/30 flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-farm-brown" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalOrders}</p>
                <p className="text-sm text-muted-foreground">Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="farmers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="farmers">Farmer Approval</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>
        
        <TabsContent value="farmers" className="space-y-4">
          <AdminFarmerApproval />
        </TabsContent>
        
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {user.full_name?.[0] || user.email[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{user.full_name || 'No name'}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                      {user.role}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          by {product.farmer?.full_name || 'Unknown'} • ₹{product.price}/{product.unit}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="capitalize">
                        {product.category}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Stock: {product.stock_quantity || 0}
                      </span>
                    </div>
                  </div>
                ))}
                
                {products.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No products yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.customer?.full_name || order.customer?.email} • ₹{order.total_amount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          order.status === 'completed' ? 'default' :
                          order.status === 'pending' ? 'secondary' :
                          'outline'
                        }
                        className="capitalize"
                      >
                        {order.status}
                      </Badge>
                      
                      {order.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => updateOrderStatus(order.id, 'completed')}
                        >
                          Complete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                
                {orders.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No orders yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
