import { ReactNode } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  Leaf, 
  LogOut, 
  Home,
  Package,
  ShoppingCart,
  Users,
  Settings,
  BarChart3
} from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getNavItems = () => {
    switch (profile?.role) {
      case 'farmer':
        return [
          { icon: Home, label: 'Dashboard', href: '/dashboard' },
          { icon: Package, label: 'My Products', href: '/dashboard/products' },
          { icon: BarChart3, label: 'Orders', href: '/dashboard/orders' },
          { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
        ];
      case 'admin':
        return [
          { icon: Home, label: 'Dashboard', href: '/dashboard' },
          { icon: Users, label: 'Users', href: '/dashboard/users' },
          { icon: Package, label: 'Products', href: '/dashboard/products' },
          { icon: BarChart3, label: 'Orders', href: '/dashboard/orders' },
          { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
        ];
      default:
        return [
          { icon: Home, label: 'Shop', href: '/dashboard' },
          { icon: ShoppingCart, label: 'My Cart', href: '/cart' },
          { icon: Package, label: 'My Orders', href: '/dashboard/orders' },
          { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-primary" />
            </div>
            <span className="font-serif text-xl font-semibold">FARM TO HOME</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.href} to={item.href}>
                <Button variant="ghost" size="sm" className="gap-2">
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{profile?.full_name || 'User'}</p>
              <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-md">
        <div className="flex justify-around py-2">
          {navItems.slice(0, 4).map((item) => (
            <Link key={item.href} to={item.href}>
              <Button variant="ghost" size="sm" className="flex-col h-auto py-2 px-3">
                <item.icon className="w-5 h-5" />
                <span className="text-xs mt-1">{item.label}</span>
              </Button>
            </Link>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="container py-6 pb-24 md:pb-6">
        {children}
      </main>
    </div>
  );
}
