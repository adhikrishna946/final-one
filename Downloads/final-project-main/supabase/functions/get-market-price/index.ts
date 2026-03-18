import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Commodity name mapping to data.gov.in commodity names
const commodityMapping: Record<string, string> = {
  'tomato': 'Tomato',
  'tomatoes': 'Tomato',
  'potato': 'Potato',
  'potatoes': 'Potato',
  'onion': 'Onion',
  'onions': 'Onion',
  'rice': 'Rice',
  'wheat': 'Wheat',
  'carrot': 'Carrot',
  'carrots': 'Carrot',
  'cabbage': 'Cabbage',
  'cauliflower': 'Cauliflower',
  'brinjal': 'Brinjal',
  'eggplant': 'Brinjal',
  'spinach': 'Spinach',
  'palak': 'Spinach',
  'apple': 'Apple',
  'banana': 'Banana',
  'mango': 'Mango',
  'orange': 'Orange',
  'grapes': 'Grapes',
  'milk': 'Milk',
  'curd': 'Curd',
  'butter': 'Butter',
  'ghee': 'Ghee',
  'green chilli': 'Green Chilli',
  'chilli': 'Green Chilli',
  'ginger': 'Ginger',
  'garlic': 'Garlic',
  'coriander': 'Coriander(Leaves)',
  'beans': 'Beans',
  'lady finger': 'Ladies Finger',
  'okra': 'Ladies Finger',
  'bitter gourd': 'Bitter gourd',
  'bottle gourd': 'Bottle gourd',
  'cucumber': 'Cucumber',
  'pumpkin': 'Pumpkin',
  'drumstick': 'Drumstick',
  'radish': 'Radish',
  'beetroot': 'Beet Root',
  'capsicum': 'Capsicum',
  'mushroom': 'Mushrooms',
  'lemon': 'Lemon',
  'papaya': 'Papaya',
  'watermelon': 'Water Melon',
  'pomegranate': 'Pomegranate',
  'guava': 'Guava',
  'pineapple': 'Pineapple',
  'coconut': 'Coconut',
  'basmati rice': 'Rice',
  'paddy': 'Paddy(Dhan)(Common)',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { commodity, state = 'Karnataka' } = await req.json();
    
    if (!commodity) {
      return new Response(
        JSON.stringify({ error: 'Commodity name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('DATA_GOV_IN_API_KEY');
    
    // Normalize commodity name
    const normalizedCommodity = commodityMapping[commodity.toLowerCase()] || commodity;
    
    console.log(`Fetching price for: ${normalizedCommodity} in ${state}`);
    
    // Try to fetch from data.gov.in API if key is configured
    if (apiKey && apiKey !== 'not_configured') {
      try {
        const apiUrl = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${apiKey}&format=json&filters[commodity]=${encodeURIComponent(normalizedCommodity)}&filters[state]=${encodeURIComponent(state)}&limit=10`;
        
        console.log(`API URL: ${apiUrl.replace(apiKey, '***')}`);
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        console.log(`API Response status: ${response.status}, records: ${data?.records?.length || 0}`);
        
        if (response.ok && data.records && data.records.length > 0) {
          // Process the records to get average modal price
          const records = data.records;
          let totalModalPrice = 0;
          let count = 0;
          let latestDate = '';
          let market = '';

          for (const record of records) {
            if (record.modal_price && !isNaN(parseFloat(record.modal_price))) {
              totalModalPrice += parseFloat(record.modal_price);
              count++;
              if (!latestDate || record.arrival_date > latestDate) {
                latestDate = record.arrival_date;
                market = record.market;
              }
            }
          }

          const avgPrice = count > 0 ? Math.round(totalModalPrice / count) : 0;
          // Convert from quintal to kg (1 quintal = 100 kg)
          const pricePerKg = Math.round(avgPrice / 100);

          return new Response(
            JSON.stringify({
              commodity: normalizedCommodity,
              state: state,
              market: market,
              market_price: {
                per_kg: pricePerKg,
                per_quintal: avgPrice,
                min_price: Math.round(Math.min(...records.map((r: any) => parseFloat(r.min_price) || Infinity)) / 100),
                max_price: Math.round(Math.max(...records.map((r: any) => parseFloat(r.max_price) || 0)) / 100),
              },
              date: latestDate,
              source: 'agmarknet',
              records_count: count
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (apiError) {
        console.error('API fetch error:', apiError);
        // Fall through to use fallback prices
      }
    }
    
    // Return fallback prices based on common commodities
    console.log(`Using fallback prices for: ${normalizedCommodity}`);
    const fallbackPrices = getFallbackPrice(normalizedCommodity);
    return new Response(
      JSON.stringify({
        commodity: normalizedCommodity,
        state: state,
        market_price: fallbackPrices,
        source: 'estimated',
        message: 'Showing estimated market prices based on recent trends'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getFallbackPrice(commodity: string): { per_kg: number; per_quintal: number; min_price: number; max_price: number } {
  const fallbackPrices: Record<string, { per_kg: number }> = {
    'Tomato': { per_kg: 30 },
    'Potato': { per_kg: 25 },
    'Onion': { per_kg: 35 },
    'Rice': { per_kg: 45 },
    'Wheat': { per_kg: 30 },
    'Carrot': { per_kg: 40 },
    'Cabbage': { per_kg: 20 },
    'Cauliflower': { per_kg: 35 },
    'Brinjal': { per_kg: 30 },
    'Spinach': { per_kg: 25 },
    'Apple': { per_kg: 120 },
    'Banana': { per_kg: 40 },
    'Mango': { per_kg: 80 },
    'Orange': { per_kg: 60 },
  };

  const price = fallbackPrices[commodity] || { per_kg: 50 };
  return {
    per_kg: price.per_kg,
    per_quintal: price.per_kg * 100,
    min_price: Math.round(price.per_kg * 0.8),
    max_price: Math.round(price.per_kg * 1.2),
  };
}
