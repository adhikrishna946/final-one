import { useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Leaf, ShoppingBag, ArrowRight } from 'lucide-react';

export default function OrderSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('id') || '';

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

      <main className="container py-16 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-serif font-bold">Order Placed Successfully!</h1>
              {orderId && (
                <p className="text-sm text-muted-foreground">
                  Order ID: <span className="font-mono font-medium">#{orderId.slice(0, 8)}</span>
                </p>
              )}
              <p className="text-muted-foreground">
                Thank you for your order! Your fresh produce is on its way.
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button onClick={() => navigate('/dashboard')} className="gap-2">
                <ShoppingBag className="w-4 h-4" />
                View My Orders
              </Button>
              <Button variant="outline" onClick={() => navigate('/dashboard')} className="gap-2">
                Continue Shopping
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
