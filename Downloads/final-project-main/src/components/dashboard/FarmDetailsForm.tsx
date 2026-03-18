import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Loader2, Navigation } from 'lucide-react';
import { geocodeAddress } from '@/lib/delivery';

interface FarmDetails {
  id?: string;
  farm_name: string;
  farm_location: string;
  total_area: number | null;
  area_unit: string;
  farming_type: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
}

export default function FarmDetailsForm() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [details, setDetails] = useState<FarmDetails>({
    farm_name: '',
    farm_location: '',
    total_area: null,
    area_unit: 'acres',
    farming_type: 'conventional',
    description: '',
    latitude: null,
    longitude: null,
  });

  useEffect(() => {
    if (profile) fetchDetails();
  }, [profile]);

  const fetchDetails = async () => {
    const { data } = await supabase
      .from('farm_details')
      .select('*')
      .eq('farmer_id', profile!.id)
      .maybeSingle();

    if (data) {
      setDetails({
        id: data.id,
        farm_name: data.farm_name,
        farm_location: data.farm_location || '',
        total_area: data.total_area,
        area_unit: data.area_unit || 'acres',
        farming_type: data.farming_type || 'conventional',
        description: data.description || '',
        latitude: (data as any).latitude ?? null,
        longitude: (data as any).longitude ?? null,
      });
    }
    setIsLoading(false);
  };

  const handleGeocodeLocation = async () => {
    if (!details.farm_location.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Enter a farm location first.' });
      return;
    }
    setIsGeocoding(true);
    const result = await geocodeAddress(details.farm_location);
    if (result) {
      setDetails(d => ({ ...d, latitude: parseFloat(result.lat.toFixed(6)), longitude: parseFloat(result.lon.toFixed(6)) }));
      toast({ title: 'Location found!', description: `Lat: ${result.lat.toFixed(6)}, Lng: ${result.lon.toFixed(6)}` });
    } else {
      toast({ variant: 'destructive', title: 'Not found', description: 'Could not geocode this address. Try entering coordinates manually.' });
    }
    setIsGeocoding(false);
  };

  const handleSave = async () => {
    if (!profile || !details.farm_name.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Farm name is required.' });
      return;
    }

    setIsSaving(true);
    const payload: any = {
      farmer_id: profile.id,
      farm_name: details.farm_name.trim(),
      farm_location: details.farm_location.trim() || null,
      total_area: details.total_area,
      area_unit: details.area_unit,
      farming_type: details.farming_type,
      description: details.description.trim() || null,
      latitude: details.latitude,
      longitude: details.longitude,
    };

    let error;
    if (details.id) {
      ({ error } = await supabase.from('farm_details').update(payload).eq('id', details.id));
    } else {
      ({ error } = await supabase.from('farm_details').insert(payload));
    }

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Farm details saved!' });
      fetchDetails();
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Farm Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Farm Name *</Label>
            <Input
              value={details.farm_name}
              onChange={(e) => setDetails(d => ({ ...d, farm_name: e.target.value }))}
              placeholder="My Organic Farm"
            />
          </div>
          <div className="space-y-2">
            <Label>Farm Location</Label>
            <div className="flex gap-2">
              <Input
                value={details.farm_location}
                onChange={(e) => setDetails(d => ({ ...d, farm_location: e.target.value }))}
                placeholder="Village, District, State"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleGeocodeLocation}
                disabled={isGeocoding}
                title="Auto-detect coordinates from location"
              >
                {isGeocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Coordinates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Latitude</Label>
            <Input
              type="number"
              step="0.000001"
              value={details.latitude ?? ''}
              onChange={(e) => setDetails(d => ({ ...d, latitude: e.target.value ? parseFloat(e.target.value) : null }))}
              placeholder="e.g. 12.9716"
            />
          </div>
          <div className="space-y-2">
            <Label>Longitude</Label>
            <Input
              type="number"
              step="0.000001"
              value={details.longitude ?? ''}
              onChange={(e) => setDetails(d => ({ ...d, longitude: e.target.value ? parseFloat(e.target.value) : null }))}
              placeholder="e.g. 77.5946"
            />
          </div>
        </div>
        {details.latitude && details.longitude && (
          <p className="text-xs text-muted-foreground">
            📍 Coordinates set: {details.latitude}, {details.longitude} — used for delivery charge calculation.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Total Area</Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={details.total_area ?? ''}
              onChange={(e) => setDetails(d => ({ ...d, total_area: e.target.value ? parseFloat(e.target.value) : null }))}
              placeholder="10"
            />
          </div>
          <div className="space-y-2">
            <Label>Area Unit</Label>
            <Select value={details.area_unit} onValueChange={(v) => setDetails(d => ({ ...d, area_unit: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="acres">Acres</SelectItem>
                <SelectItem value="hectares">Hectares</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Type of Farming</Label>
            <Select value={details.farming_type} onValueChange={(v) => setDetails(d => ({ ...d, farming_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="organic">Organic</SelectItem>
                <SelectItem value="conventional">Conventional</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={details.description}
            onChange={(e) => setDetails(d => ({ ...d, description: e.target.value }))}
            placeholder="Tell customers about your farm..."
            rows={3}
          />
        </div>

        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : details.id ? 'Update Farm Details' : 'Save Farm Details'}
        </Button>
      </CardContent>
    </Card>
  );
}
