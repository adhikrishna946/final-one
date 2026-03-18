import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

import { useToast } from '@/hooks/use-toast';
import { Plus, Package, IndianRupee, Edit, Trash2, ImagePlus, TrendingUp, Loader2, AlertTriangle, Clock } from 'lucide-react';
import FarmDetailsForm from './FarmDetailsForm';

interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  unit: string | null;
  image_url: string | null;
  stock_quantity: number | null;
  is_available: boolean | null;
  expiry_date: string | null;
}

interface MarketPrice {
  per_kg: number;
  per_quintal: number;
  min_price: number;
  max_price: number;
}

interface MarketPriceResponse {
  commodity: string;
  state: string;
  market?: string;
  market_price: MarketPrice;
  date?: string;
  source: string;
  message?: string;
}

export default function FarmerDashboard() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [kisanId, setKisanId] = useState('');
  const [isSubmittingKisanId, setIsSubmittingKisanId] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('vegetables');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('kg');
  const [stockQuantity, setStockQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Market price state
  const [marketPrice, setMarketPrice] = useState<MarketPriceResponse | null>(null);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    setKisanId(profile?.kisan_id || '');
  }, [profile?.kisan_id]);

  const fetchProducts = async () => {
    if (!profile) return;
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('farmer_id', profile.id)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setProducts(data);
    }
    setIsLoading(false);
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setCategory('vegetables');
    setPrice('');
    setUnit('kg');
    setStockQuantity('');
    setExpiryDate('');
    setImageFile(null);
    setEditingProduct(null);
    setMarketPrice(null);
    
  };

  // Fetch market price from AgMarkNet API
  const fetchMarketPrice = useCallback(async (productName: string) => {
    if (!productName || productName.length < 2) {
      setMarketPrice(null);
      return;
    }
    
    setIsFetchingPrice(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-market-price', {
        body: { commodity: productName, state: 'Karnataka' }
      });
      
      if (error) {
        console.error('Error fetching market price:', error);
        setMarketPrice(null);
      } else {
        setMarketPrice(data);
        // Auto-set price to recommended market price
        if (data?.market_price?.per_kg && !price) {
          setPrice(data.market_price.per_kg.toString());
        }
      }
    } catch (err) {
      console.error('Failed to fetch market price:', err);
      setMarketPrice(null);
    } finally {
      setIsFetchingPrice(false);
    }
  }, [price]);

  // Debounce name changes to fetch market price
  useEffect(() => {
    const timer = setTimeout(() => {
      if (name && isDialogOpen) {
        fetchMarketPrice(name);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [name, isDialogOpen, fetchMarketPrice]);

  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setName(product.name);
      setDescription(product.description || '');
      setCategory(product.category);
      setPrice(product.price.toString());
      setUnit(product.unit || 'kg');
      setStockQuantity(product.stock_quantity?.toString() || '');
      setExpiryDate(product.expiry_date || '');
      
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!profile) return null;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${profile.id}/${Date.now()}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file);
    
    if (error) {
      console.error('Upload error:', error);
      return null;
    }
    
    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);
    
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    setIsSubmitting(true);
    
    try {
      let imageUrl = editingProduct?.image_url || null;
      
      if (imageFile) {
        const uploadedUrl = await uploadImage(imageFile);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }
      
      const productData = {
        name,
        description: description || null,
        category,
        price: parseFloat(price),
        unit,
        stock_quantity: parseInt(stockQuantity) || 0,
        image_url: imageUrl,
        farmer_id: profile.id,
        expiry_date: expiryDate || null,
      };
      
      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);
        
        if (error) throw error;
        
        toast({
          title: 'Product updated!',
          description: 'Your product has been updated successfully.',
        });
      } else {
        const { error } = await supabase
          .from('products')
          .insert(productData);
        
        if (error) throw error;
        
        toast({
          title: 'Product added!',
          description: 'Your product has been added to the marketplace.',
        });
      }
      
      setIsDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (productId: string) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);
    
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } else {
      toast({
        title: 'Product deleted',
        description: 'The product has been removed.',
      });
      fetchProducts();
    }
  };

  const isApproved = profile?.is_verified;
  const verificationStatus = profile?.verification_status || (isApproved ? 'verified' : null);

  const validateKisanId = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return 'Kisan ID is required.';
    if (trimmed.length < 6) return 'Kisan ID must be at least 6 characters.';
    if (!/^[a-z0-9]+$/i.test(trimmed)) return 'Kisan ID must be alphanumeric (A–Z, 0–9).';
    return null;
  };

  const submitKisanId = async () => {
    if (!profile) return;

    const errorMsg = validateKisanId(kisanId);
    if (errorMsg) {
      toast({ variant: 'destructive', title: 'Invalid Kisan ID', description: errorMsg });
      return;
    }

    setIsSubmittingKisanId(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          kisan_id: kisanId.trim(),
          verification_status: 'pending',
          verification_requested_at: new Date().toISOString(),
          rejected_at: null,
          rejected_by: null,
          rejection_reason: null,
          is_verified: false,
          verified_at: null,
          verified_by: null,
        })
        .eq('id', profile.id);

      if (error) {
        // Unique constraint from DB (duplicate Kisan ID)
        const message = (error as any)?.message || 'Failed to submit Kisan ID.';
        toast({ variant: 'destructive', title: 'Could not submit', description: message });
        return;
      }

      await refreshProfile();
      toast({
        title: 'Submitted for verification',
        description: 'Your Kisan ID has been submitted and is pending admin verification.',
      });
    } finally {
      setIsSubmittingKisanId(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Kisan ID Verification */}
      <Card className="farm-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>Farmer Verification</span>
            {verificationStatus && (
              <Badge
                variant={
                  verificationStatus === 'verified'
                    ? 'default'
                    : verificationStatus === 'rejected'
                      ? 'destructive'
                      : 'secondary'
                }
                className="capitalize"
              >
                {verificationStatus}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {verificationStatus === 'verified' ? (
            <div className="text-sm text-muted-foreground">
              Your account is verified. Kisan ID: <span className="font-medium text-foreground">{profile?.kisan_id || '—'}</span>
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                Enter your Kisan ID to request verification. Until verified, you won’t be able to list products.
              </div>
              {verificationStatus === 'rejected' && profile?.rejection_reason && (
                <div className="text-sm text-destructive">
                  Rejection reason: <span className="font-medium">{profile.rejection_reason}</span>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="kisanId">Kisan ID</Label>
                  <Input
                    id="kisanId"
                    value={kisanId}
                    onChange={(e) => setKisanId(e.target.value)}
                    placeholder="e.g., AB12CD34"
                    disabled={verificationStatus === 'pending' && !!profile?.kisan_id}
                  />
                  <p className="text-xs text-muted-foreground">Alphanumeric, minimum 6 characters.</p>
                </div>
                <Button
                  onClick={submitKisanId}
                  disabled={isSubmittingKisanId || (verificationStatus === 'pending' && !!profile?.kisan_id)}
                  className="sm:mb-1"
                >
                  {verificationStatus === 'rejected' ? 'Resubmit' : 'Submit'}
                </Button>
              </div>
              {verificationStatus === 'pending' && (
                <div className="text-sm text-muted-foreground">
                  Status: Pending Verification {profile?.verification_requested_at ? `• submitted ${new Date(profile.verification_requested_at).toLocaleString()}` : ''}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Pending Approval Banner */}
      {!isApproved && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">Account Pending Approval</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">Your farmer account is under review. You cannot add products until approved by an admin.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold">My Products</h1>
          <p className="text-muted-foreground">Manage your farm produce listings</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2" disabled={!isApproved}>
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Fresh Tomatoes"
                  required
                />
              </div>
              
              {/* Market Price Display */}
              {(isFetchingPrice || marketPrice) && (
                <Card className="bg-muted/50 border-primary/20">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">AgMarkNet Market Price</span>
                      {isFetchingPrice && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
                    </div>
                    
                    {marketPrice && !isFetchingPrice && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Recommended Price:</span>
                          <span className="text-lg font-bold text-primary">₹{marketPrice.market_price.per_kg}/kg</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Range: ₹{marketPrice.market_price.min_price} - ₹{marketPrice.market_price.max_price}/kg</span>
                          <span className="capitalize">{marketPrice.source}</span>
                        </div>
                        {marketPrice.message && (
                          <p className="text-xs text-amber-600">{marketPrice.message}</p>
                        )}
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="w-full mt-2"
                          onClick={() => setPrice(marketPrice.market_price.per_kg.toString())}
                        >
                          Use Recommended Price (₹{marketPrice.market_price.per_kg})
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your product..."
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vegetables">Vegetables</SelectItem>
                      <SelectItem value="rice">Rice & Grains</SelectItem>
                      <SelectItem value="fruits">Fruits</SelectItem>
                      <SelectItem value="dairy">Dairy</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Kilogram (kg)</SelectItem>
                      <SelectItem value="g">Gram (g)</SelectItem>
                      <SelectItem value="piece">Piece</SelectItem>
                      <SelectItem value="dozen">Dozen</SelectItem>
                      <SelectItem value="bundle">Bundle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (₹)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="stock">Stock Quantity</Label>
                  <Input
                    id="stock"
                    type="number"
                    min="0"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    placeholder="0"
                  />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="image">Product Image</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                </div>
                {(editingProduct?.image_url || imageFile) && (
                  <p className="text-xs text-muted-foreground">
                    {imageFile ? imageFile.name : 'Current image will be kept'}
                  </p>
                )}
              </div>
              
              {/* Price Info Note */}
              {marketPrice && price && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground">
                    💡 Your price (₹{price}/{unit}) will be shown alongside the AgMarkNet market price 
                    (₹{marketPrice.market_price.per_kg}/kg) so customers can compare.
                  </p>
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Add Product'}
              </Button>
              
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{products.length}</p>
                <p className="text-sm text-muted-foreground">Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                <IndianRupee className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {products.reduce((sum, p) => sum + (p.stock_quantity || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Stock</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-40 bg-muted rounded-t-lg" />
              <CardContent className="pt-4 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <ImagePlus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No products yet</h3>
            <p className="text-muted-foreground mb-4">Start by adding your first product</p>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden group">
              <div className="aspect-video bg-muted relative overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-12 h-12 text-muted-foreground/50" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8"
                    onClick={() => handleOpenDialog(product)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-8 w-8"
                    onClick={() => handleDelete(product.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              
              <CardContent className="pt-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold">{product.name}</h3>
                    <p className="text-xs text-muted-foreground capitalize">{product.category}</p>
                  </div>
                  <p className="font-bold text-primary">
                    ₹{product.price}/{product.unit}
                  </p>
                </div>
                {product.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {product.description}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Stock: {product.stock_quantity || 0}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    product.is_available
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {product.is_available ? 'Available' : 'Unavailable'}
                  </span>
                </div>
                {product.expiry_date && (
                  <div className="mt-2">
                    {(() => {
                      const daysUntil = Math.ceil((new Date(product.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      if (daysUntil < 0) return <Badge variant="destructive" className="text-xs"><Clock className="w-3 h-3 mr-1" />Expired</Badge>;
                      if (daysUntil <= 3) return <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"><Clock className="w-3 h-3 mr-1" />Expiring in {daysUntil}d</Badge>;
                      return <span className="text-xs text-muted-foreground">Expires: {new Date(product.expiry_date).toLocaleDateString()}</span>;
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Farm Details */}
      <FarmDetailsForm />
    </div>
  );
}
