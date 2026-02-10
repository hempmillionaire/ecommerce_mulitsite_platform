import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Package, ShoppingCart, Users, TrendingUp } from 'lucide-react';

export function AdminDashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalVendors: 0,
    revenueTotal: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [productsResult, ordersResult, vendorsResult] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id, total', { count: 'exact' }),
        supabase.from('vendors').select('id', { count: 'exact', head: true }),
      ]);

      const revenue = ordersResult.data?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;

      setStats({
        totalProducts: productsResult.count || 0,
        totalOrders: ordersResult.count || 0,
        totalVendors: vendorsResult.count || 0,
        revenueTotal: revenue,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Products', value: stats.totalProducts, icon: Package, color: 'bg-blue-500' },
    { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingCart, color: 'bg-green-500' },
    { label: 'Active Vendors', value: stats.totalVendors, icon: Users, color: 'bg-orange-500' },
    { label: 'Total Revenue', value: `$${stats.revenueTotal.toFixed(2)}`, icon: TrendingUp, color: 'bg-red-500' },
  ];

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Commerce OS Control Tower</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h2>
          <p className="text-gray-600">Activity feed will appear here</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">System Status</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Database</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">Operational</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Email System</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">Operational</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">API</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">Operational</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
