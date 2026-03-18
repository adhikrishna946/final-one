import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, X, Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string | null;
  image_url: string | null;
}

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  product: Product;
}

interface FloatingCartProps {
  cartItems: CartItem[];
  onUpdateQuantity: (productId: string, change: number) => void;
}

export default function FloatingCart({ cartItems, onUpdateQuantity }: FloatingCartProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cartItems.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity,
    0
  );

  if (cartItems.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Expanded Cart Panel */}
      <div
        className={cn(
          'absolute bottom-16 right-0 w-80 transition-all duration-300 origin-bottom-right',
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
        )}
      >
        <Card className="shadow-2xl border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Your Cart
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pb-3">
            <ScrollArea className="h-[250px] pr-3">
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                  >
                    <div className="w-12 h-12 rounded-md bg-muted overflow-hidden flex-shrink-0">
                      {item.product?.image_url ? (
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {item.product?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ₹{item.product?.price}/{item.product?.unit}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onUpdateQuantity(item.product_id, -1)}
                      >
                        {item.quantity === 1 ? (
                          <Trash2 className="w-3 h-3" />
                        ) : (
                          <Minus className="w-3 h-3" />
                        )}
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onUpdateQuantity(item.product_id, 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>

          <CardFooter className="flex-col gap-3 pt-3 border-t">
            <div className="flex items-center justify-between w-full">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-lg font-bold">₹{totalAmount.toFixed(2)}</span>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                setIsOpen(false);
                navigate('/cart');
              }}
            >
              Proceed to Checkout
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Floating Button */}
      <Button
        size="lg"
        className="rounded-full h-14 w-14 shadow-lg hover:shadow-xl transition-shadow relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <ShoppingCart className="w-6 h-6" />
        <Badge
          className="absolute -top-1 -right-1 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs"
          variant="secondary"
        >
          {totalItems}
        </Badge>
      </Button>
    </div>
  );
}
