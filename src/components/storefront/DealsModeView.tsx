import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Tag, Clock } from 'lucide-react';

interface Promotion {
  id: string;
  name: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  code: string | null;
  starts_at: string;
  ends_at: string | null;
}

export function DealsModeView() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPromotions();
  }, []);

  const loadPromotions = async () => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('status', 'active')
        .lte('starts_at', now)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .limit(20);

      if (error) throw error;
      setPromotions(data || []);
    } catch (error) {
      console.error('Error loading promotions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDiscount = (promo: Promotion) => {
    if (promo.discount_type === 'percent') {
      return `${promo.discount_value}% OFF`;
    } else if (promo.discount_type === 'fixed_amount') {
      return `$${promo.discount_value} OFF`;
    }
    return 'SPECIAL OFFER';
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading deals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Active Deals & Promotions</h2>
        <p className="text-gray-600">Limited-time offers and exclusive discounts</p>
      </div>

      {promotions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Tag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Promotions</h3>
          <p className="text-gray-600">Check back soon for exciting deals and offers.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {promotions.map((promo) => (
            <div
              key={promo.id}
              className="bg-white rounded-lg border-2 border-blue-200 overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1"
            >
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
                <div className="flex items-start justify-between mb-4">
                  <Tag className="w-8 h-8" />
                  <span className="bg-white text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
                    {formatDiscount(promo)}
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-2">{promo.name}</h3>
                {promo.code && (
                  <div className="inline-block bg-white/20 px-3 py-1 rounded text-sm font-mono">
                    CODE: {promo.code}
                  </div>
                )}
              </div>

              <div className="p-6">
                {promo.description && (
                  <p className="text-gray-600 mb-4">{promo.description}</p>
                )}

                <div className="flex items-center text-sm text-gray-500 mb-4">
                  <Clock className="w-4 h-4 mr-2" />
                  {promo.ends_at ? (
                    <span>Ends {new Date(promo.ends_at).toLocaleDateString()}</span>
                  ) : (
                    <span>No expiration</span>
                  )}
                </div>

                <button className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                  Shop Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
