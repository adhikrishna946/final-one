// Haversine formula to calculate distance between two lat/lng points in km
export function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Delivery charge based on distance
export function getDeliveryCharge(distanceKm: number): number {
  if (distanceKm <= 5) return 20;
  if (distanceKm <= 10) return 40;
  if (distanceKm <= 20) return 80;
  return 120;
}

// Geocode an address using OpenStreetMap Nominatim (free, no API key)
export async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    // Append standard context to help the API locate it properly if they only typed a village name
    const searchString = address.toLowerCase().includes('thrissur') 
      ? address 
      : `${address}, Thrissur, Kerala, India`;
      
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchString)}&addressdetails=1&limit=3`,
      { headers: { 'User-Agent': 'FarmFresh-App/1.0' } }
    );
    const data = await response.json();
    
    if (data && data.length > 0) {
      // Strictly filter results that actually fall inside Thrissur, Kerala
      const thrissurResult = data.find((item: any) => {
        const addr = item.address;
        if (!addr) return false;
        
        const stateStr = (addr.state || '').toLowerCase();
        const strForm = item.display_name.toLowerCase();
        
        // Either the exact state has to be Kerala and name implies Thrissur, or address literally has Thrissur in its bounding hierarchy
        if (stateStr.includes('kerala') && (strForm.includes('thrissur') || strForm.includes('trichur'))) {
          return true;
        }
        return false;
      });

      if (thrissurResult) {
        return { lat: parseFloat(thrissurResult.lat), lon: parseFloat(thrissurResult.lon) };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Reverse Geocode latitude/longitude using OpenStreetMap Nominatim
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
      { headers: { 'User-Agent': 'FarmFresh-App/1.0' } }
    );
    const data = await response.json();
    
    if (data && data.address) {
      const stateStr = (data.address.state || '').toLowerCase();
      const strForm = (data.display_name || '').toLowerCase();
      
      // Enforce Thrissur bounds
      if (stateStr.includes('kerala') && (strForm.includes('thrissur') || strForm.includes('trichur'))) {
        const place = data.address.village || data.address.town || data.address.city || data.address.suburb || data.address.neighbourhood || '';
        const nameParts = [place, 'Thrissur', 'Kerala', 'India'].filter(Boolean);
        // Build readable string like "Pudukkad, Thrissur, Kerala, India"
        return nameParts.join(', ');
      }
    }
    return null; // Return null if out of bounds or unstructured
  } catch {
    return null;
  }
}
