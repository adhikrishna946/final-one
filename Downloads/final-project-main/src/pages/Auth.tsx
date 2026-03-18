import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Leaf, Tractor, ShoppingBag } from 'lucide-react';

type UserRole = 'farmer' | 'customer';

const roleConfig = {
  farmer: {
    icon: Tractor,
    title: 'Farmer',
    description: 'Sell your fresh produce',
  },
  customer: {
    icon: ShoppingBag,
    title: 'Customer',
    description: 'Buy fresh from farms',
  },
};

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('customer');
  const [isLoading, setIsLoading] = useState(false);

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast({ variant: 'destructive', title: 'Login failed', description: error.message });
        } else {
          toast({ title: 'Welcome back!', description: 'You have successfully logged in.' });
          navigate('/dashboard');
        }
      } else {
        if (selectedRole === 'customer' && (!phone.trim() || !address.trim() || !city.trim() || !state.trim() || !pincode.trim())) {
          toast({ variant: 'destructive', title: 'Missing fields', description: 'Please fill in all required fields.' });
          setIsLoading(false);
          return;
        }
        const { error } = await signUp(email, password, fullName, selectedRole, {
          phone: phone.trim(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
        });
        if (error) {
          toast({ variant: 'destructive', title: 'Sign up failed', description: error.message });
        } else {
          const msg = selectedRole === 'farmer'
            ? 'Your account is pending admin approval. You will be notified once approved.'
            : 'Please check your email to verify your account.';
          toast({ title: 'Account created!', description: msg });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="absolute inset-0 farm-hero-gradient opacity-5" />

      <Card className="w-full max-w-md relative animate-fade-up shadow-elevated">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Leaf className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-serif">
            {isLogin ? 'Welcome Back' : 'Join FARM TO HOME'}
          </CardTitle>
          <CardDescription>
            {isLogin ? 'Sign in to access your account' : 'Create an account to get started'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={isLogin ? 'login' : 'signup'} onValueChange={(v) => setIsLogin(v === 'login')}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label>I am a...</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(roleConfig) as UserRole[]).map((role) => {
                        const config = roleConfig[role];
                        const Icon = config.icon;
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => setSelectedRole(role)}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              selectedRole === role
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <Icon className={`w-6 h-6 mx-auto mb-1 ${
                              selectedRole === role ? 'text-primary' : 'text-muted-foreground'
                            }`} />
                            <p className={`text-xs font-medium ${
                              selectedRole === role ? 'text-primary' : 'text-muted-foreground'
                            }`}>
                              {config.title}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+91 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>

                  {selectedRole === 'customer' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="address">Address *</Label>
                        <Input
                          id="address"
                          placeholder="House No, Street"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="city">City *</Label>
                          <Input
                            id="city"
                            placeholder="Bangalore"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="state">State *</Label>
                          <Input
                            id="state"
                            placeholder="Karnataka"
                            value={state}
                            onChange={(e) => setState(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pincode">Pincode *</Label>
                        <Input
                          id="pincode"
                          placeholder="560001"
                          value={pincode}
                          onChange={(e) => setPincode(e.target.value)}
                          required
                          maxLength={6}
                        />
                      </div>
                    </>
                  )}

                  {selectedRole === 'farmer' && (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
                      ⏳ Farmer accounts require admin approval before you can add products.
                    </div>
                  )}
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Loading...' : isLogin ? 'Sign In' : 'Create Account'}
              </Button>
            </form>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
