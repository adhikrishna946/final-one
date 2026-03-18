import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import FarmerDashboard from '@/components/dashboard/FarmerDashboard';
import CustomerDashboard from '@/components/dashboard/CustomerDashboard';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function Dashboard() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Setting up your profile...</div>
      </div>
    );
  }

  const renderDashboard = () => {
    switch (profile.role) {
      case 'farmer':
        return <FarmerDashboard />;
      case 'admin':
        return <AdminDashboard />;
      default:
        return <CustomerDashboard />;
    }
  };

  return (
    <DashboardLayout>
      {renderDashboard()}
    </DashboardLayout>
  );
}
