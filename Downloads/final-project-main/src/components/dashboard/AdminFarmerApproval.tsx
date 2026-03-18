import { useMemo, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock, Tractor } from 'lucide-react';

interface FarmerProfile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  kisan_id: string | null;
  verification_status: 'pending' | 'verified' | 'rejected' | null;
  verification_requested_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
}

export default function AdminFarmerApproval() {
  const { toast } = useToast();
  const { profile: adminProfile } = useAuth();
  const [farmers, setFarmers] = useState<FarmerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<FarmerProfile | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchFarmers();
  }, []);

  const fetchFarmers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at, kisan_id, verification_status, verification_requested_at, verified_at, verified_by, rejected_at, rejected_by, rejection_reason')
      .eq('role', 'farmer')
      .order('created_at', { ascending: false });

    if (data) setFarmers(data as FarmerProfile[]);
    setIsLoading(false);
  };

  const filteredFarmers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return farmers;
    return farmers.filter((f) => (f.kisan_id || '').toLowerCase().includes(q));
  }, [farmers, search]);

  const pendingFarmers = filteredFarmers.filter(f => (f.verification_status || 'pending') === 'pending' && !!f.kisan_id);
  const verifiedFarmers = filteredFarmers.filter(f => f.verification_status === 'verified');
  const rejectedFarmers = filteredFarmers.filter(f => f.verification_status === 'rejected');

  const openDetails = (farmer: FarmerProfile) => {
    setSelected(farmer);
    setRejectReason(farmer.rejection_reason || '');
  };

  const verifySelected = async () => {
    if (!selected) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          verification_status: 'verified',
          is_verified: true,
          verified_at: new Date().toISOString(),
          verified_by: adminProfile?.id || null,
          rejected_at: null,
          rejected_by: null,
          rejection_reason: null,
        })
        .eq('id', selected.id);

      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }

      toast({ title: 'Verified', description: 'Farmer has been verified successfully.' });
      setSelected(null);
      await fetchFarmers();
    } finally {
      setIsUpdating(false);
    }
  };

  const rejectSelected = async () => {
    if (!selected) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast({ variant: 'destructive', title: 'Reason required', description: 'Please enter a rejection reason.' });
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          verification_status: 'rejected',
          is_verified: false,
          rejected_at: new Date().toISOString(),
          rejected_by: adminProfile?.id || null,
          rejection_reason: reason,
          verified_at: null,
          verified_by: null,
        })
        .eq('id', selected.id);

      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }

      toast({ title: 'Rejected', description: 'Farmer verification has been rejected.' });
      setSelected(null);
      await fetchFarmers();
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="pt-6"><div className="h-24 bg-muted rounded" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tractor className="w-5 h-5" />
          Farmer Verification ({pendingFarmers.length} pending)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {farmers.length === 0 && (
          <p className="text-center text-muted-foreground py-4">No farmer registrations yet.</p>
        )}

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="kisanSearch">Search by Kisan ID</Label>
            <Input
              id="kisanSearch"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type Kisan ID…"
            />
          </div>
          <div className="text-sm text-muted-foreground sm:mb-1">
            Showing {filteredFarmers.length} farmers
          </div>
        </div>

        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="w-4 h-4" /> Pending ({pendingFarmers.length})
            </TabsTrigger>
            <TabsTrigger value="verified">Verified ({verifiedFarmers.length})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({rejectedFarmers.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3">
            {pendingFarmers.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No pending verification requests.</p>
            ) : (
              pendingFarmers.map((farmer) => (
                <button
                  key={farmer.id}
                  type="button"
                  onClick={() => openDetails(farmer)}
                  className="w-full text-left flex items-center justify-between p-4 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                >
                  <div>
                    <p className="font-medium">{farmer.full_name || 'No name'}</p>
                    <p className="text-sm text-muted-foreground">Kisan ID: <span className="font-medium text-foreground">{farmer.kisan_id || '—'}</span></p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {farmer.verification_requested_at ? new Date(farmer.verification_requested_at).toLocaleString() : new Date(farmer.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="secondary" className="capitalize">pending</Badge>
                </button>
              ))
            )}
          </TabsContent>

          <TabsContent value="verified" className="space-y-2">
            {verifiedFarmers.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No verified farmers yet.</p>
            ) : (
              verifiedFarmers.map((farmer) => (
                <button
                  key={farmer.id}
                  type="button"
                  onClick={() => openDetails(farmer)}
                  className="w-full text-left flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{farmer.full_name || 'No name'}</p>
                    <p className="text-xs text-muted-foreground">Kisan ID: {farmer.kisan_id || '—'}</p>
                  </div>
                  <Badge variant="default">Verified</Badge>
                </button>
              ))
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-2">
            {rejectedFarmers.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No rejected farmers.</p>
            ) : (
              rejectedFarmers.map((farmer) => (
                <button
                  key={farmer.id}
                  type="button"
                  onClick={() => openDetails(farmer)}
                  className="w-full text-left flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{farmer.full_name || 'No name'}</p>
                    <p className="text-xs text-muted-foreground">Kisan ID: {farmer.kisan_id || '—'}</p>
                  </div>
                  <Badge variant="destructive">Rejected</Badge>
                </button>
              ))
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Farmer Verification Details</DialogTitle>
            </DialogHeader>

            {selected && (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selected.full_name || 'No name'}</p>
                      <p className="text-sm text-muted-foreground">{selected.email}</p>
                    </div>
                    <Badge
                      variant={
                        selected.verification_status === 'verified'
                          ? 'default'
                          : selected.verification_status === 'rejected'
                            ? 'destructive'
                            : 'secondary'
                      }
                      className="capitalize"
                    >
                      {selected.verification_status || 'pending'}
                    </Badge>
                  </div>

                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Kisan ID</div>
                    <div className="text-lg font-semibold tracking-wide">{selected.kisan_id || '—'}</div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    Submitted: {selected.verification_requested_at ? new Date(selected.verification_requested_at).toLocaleString() : '—'}
                  </div>
                  {selected.verified_at && (
                    <div className="text-sm text-muted-foreground">
                      Verified at: {new Date(selected.verified_at).toLocaleString()}
                    </div>
                  )}
                  {selected.rejected_at && (
                    <div className="text-sm text-muted-foreground">
                      Rejected at: {new Date(selected.rejected_at).toLocaleString()}
                    </div>
                  )}
                </div>

                {(selected.verification_status || 'pending') !== 'verified' && (
                  <div className="space-y-2">
                    <Label htmlFor="rejectReason">Reject reason</Label>
                    <Textarea
                      id="rejectReason"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Explain why this Kisan ID cannot be verified…"
                      rows={3}
                    />
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setSelected(null)} disabled={isUpdating}>
                Close
              </Button>
              {selected && (selected.verification_status || 'pending') !== 'verified' && (
                <>
                  <Button onClick={verifySelected} disabled={isUpdating} className="gap-1">
                    <CheckCircle className="w-4 h-4" /> Verify
                  </Button>
                  <Button variant="destructive" onClick={rejectSelected} disabled={isUpdating} className="gap-1">
                    <XCircle className="w-4 h-4" /> Reject
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
