import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Leaf, Tractor, ShoppingBag, Shield, ArrowRight, Sprout, Truck, Heart } from 'lucide-react';
import heroImage from '@/assets/hero-farm.jpg';

export default function Index() {
  const features = [
    {
      icon: Sprout,
      title: 'Farm Fresh',
      description: 'Direct from local farms to your table',
    },
    {
      icon: Truck,
      title: 'Fast Delivery',
      description: 'Quick delivery of fresh produce',
    },
    {
      icon: Heart,
      title: 'Support Local',
      description: 'Help local farmers thrive',
    },
  ];

  const roles = [
    {
      icon: Tractor,
      title: 'For Farmers',
      description: 'List your fresh produce, set prices, and reach customers directly.',
      color: 'bg-primary',
    },
    {
      icon: ShoppingBag,
      title: 'For Customers',
      description: 'Browse fresh vegetables, rice, and more. Shop directly from farmers.',
      color: 'bg-secondary',
    },
    {
      icon: Shield,
      title: 'For Admins',
      description: 'Monitor the marketplace, verify users, and ensure quality.',
      color: 'bg-accent',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src={heroImage} 
            alt="Fresh farm produce" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/60" />
        </div>
        
        <div className="container relative py-20 md:py-32">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 backdrop-blur-sm text-primary mb-6 animate-fade-up">
              <Leaf className="w-4 h-4" />
              <span className="text-sm font-medium">Farm to Table Marketplace</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-serif font-bold mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
              Fresh From the{' '}
              <span className="farm-text-gradient">Farm</span>
              {' '}to Your{' '}
              <span className="farm-text-gradient">Table</span>
            </h1>
            
            <p className="text-lg text-muted-foreground mb-8 animate-fade-up" style={{ animationDelay: '0.2s' }}>
              Connect with local farmers, discover fresh vegetables, rice, and organic produce.
              Support sustainable farming while enjoying the freshest ingredients.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 animate-fade-up" style={{ animationDelay: '0.3s' }}>
              <Link to="/auth">
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="w-full sm:w-auto bg-background/50 backdrop-blur-sm">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-muted/30">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={feature.title} className="border-0 shadow-card animate-fade-up" style={{ animationDelay: `${0.1 * index}s` }}>
                <CardContent className="pt-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
              Who Can Join?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Whether you're a farmer looking to sell, a customer seeking fresh produce, 
              or an admin managing the marketplace - there's a place for you.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {roles.map((role, index) => (
              <Card 
                key={role.title} 
                className="group hover:shadow-elevated transition-shadow duration-300 animate-fade-up"
                style={{ animationDelay: `${0.1 * index}s` }}
              >
                <CardContent className="pt-6">
                  <div className={`w-14 h-14 rounded-2xl ${role.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <role.icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{role.title}</h3>
                  <p className="text-muted-foreground">{role.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                Join FARM TO HOME Today
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-primary" />
              </div>
              <span className="font-serif text-xl font-semibold">FARM TO HOME</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 FARM TO HOME. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
