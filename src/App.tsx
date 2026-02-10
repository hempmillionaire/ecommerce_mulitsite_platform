import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/auth/LoginForm';
import { SignUpForm } from './components/auth/SignUpForm';
import { AdminLayout } from './components/layout/AdminLayout';
import { VendorLayout } from './components/layout/VendorLayout';
import { SalesRepLayout } from './components/layout/SalesRepLayout';
import { StorefrontLayout } from './components/storefront/StorefrontLayout';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { ProductManagement } from './components/admin/ProductManagement';
import { OrderManagement } from './components/admin/OrderManagement';
import { VendorManagement } from './components/admin/VendorManagement';
import { RetailModeView } from './components/storefront/RetailModeView';
import { WholesaleModeView } from './components/storefront/WholesaleModeView';
import { DealsModeView } from './components/storefront/DealsModeView';
import { QuickOrderView } from './components/storefront/QuickOrderView';
import type { SiteMode } from './lib/database.types';

function AppContent() {
  const { profile, loading } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const [adminView, setAdminView] = useState('dashboard');
  const [vendorView, setVendorView] = useState('dashboard');
  const [salesRepView, setSalesRepView] = useState('dashboard');
  const [storefrontMode, setStorefrontMode] = useState<SiteMode>('retail');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading Commerce OS...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
        <div className="w-full max-w-6xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Commerce OS</h1>
            <p className="text-lg text-gray-600">Multi-Brand Dropshipping & Distribution Platform</p>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-1">
              {authView === 'login' ? <LoginForm /> : <SignUpForm />}
              <div className="text-center mt-4">
                <button
                  onClick={() => setAuthView(authView === 'login' ? 'signup' : 'login')}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  {authView === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
                </button>
              </div>
            </div>

            <div className="flex-1 bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Platform Features</h2>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Multi-brand storefronts with mode-driven UX</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Vendor-funded promotions with cost attribution</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>B2B wholesale with tier pricing</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Automated dropship order routing</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Sales rep system with commission tracking</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>AI-driven 1:1 marketing with guardrails</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Comprehensive admin control tower</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (profile.role === 'admin') {
    return (
      <AdminLayout currentView={adminView} onNavigate={setAdminView}>
        {adminView === 'dashboard' && <AdminDashboard />}
        {adminView === 'products' && <ProductManagement />}
        {adminView === 'orders' && <OrderManagement />}
        {adminView === 'vendors' && <VendorManagement />}
        {adminView === 'sites' && (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Site Management</h2>
            <p className="text-gray-600">Multi-site management interface coming soon</p>
          </div>
        )}
        {adminView === 'promotions' && (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Promotions Management</h2>
            <p className="text-gray-600">Vendor-funded promotions interface coming soon</p>
          </div>
        )}
        {adminView === 'analytics' && (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Analytics Dashboard</h2>
            <p className="text-gray-600">Advanced analytics and reporting coming soon</p>
          </div>
        )}
        {adminView === 'settings' && (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">System Settings</h2>
            <p className="text-gray-600">Global configuration interface coming soon</p>
          </div>
        )}
      </AdminLayout>
    );
  }

  if (profile.role === 'vendor') {
    return (
      <VendorLayout currentView={vendorView} onNavigate={setVendorView}>
        {vendorView === 'dashboard' && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Vendor Dashboard</h1>
            <p className="text-gray-600">Manage your products, orders, and performance</p>
          </div>
        )}
        {vendorView === 'products' && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Products</h1>
            <p className="text-gray-600">Manage your product catalog</p>
          </div>
        )}
        {vendorView === 'orders' && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Orders</h1>
            <p className="text-gray-600">View and fulfill orders for your products</p>
          </div>
        )}
        {vendorView === 'analytics' && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
            <p className="text-gray-600">Track your sales performance and metrics</p>
          </div>
        )}
        {vendorView === 'agreements' && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Agreements</h1>
            <p className="text-gray-600">View and sign platform agreements</p>
          </div>
        )}
        {vendorView === 'subscription' && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Subscription</h1>
            <p className="text-gray-600">Manage your subscription tier and billing</p>
          </div>
        )}
        {vendorView === 'settings' && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
            <p className="text-gray-600">Configure your vendor profile and integrations</p>
          </div>
        )}
      </VendorLayout>
    );
  }

  if (profile.role === 'sales_rep') {
    return (
      <SalesRepLayout currentView={salesRepView} onNavigate={setSalesRepView}>
        {salesRepView === 'dashboard' && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Sales Dashboard</h1>
            <p className="text-gray-600">Track your performance and assigned companies</p>
          </div>
        )}
        {salesRepView === 'companies' && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Companies</h1>
            <p className="text-gray-600">Manage your assigned B2B accounts</p>
          </div>
        )}
        {salesRepView === 'orders' && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Orders</h1>
            <p className="text-gray-600">View orders from your companies</p>
          </div>
        )}
        {salesRepView === 'quotes' && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Quotes</h1>
            <p className="text-gray-600">Create and manage sales quotes</p>
          </div>
        )}
        {salesRepView === 'commissions' && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Commissions</h1>
            <p className="text-gray-600">Track your earnings and commission rates</p>
          </div>
        )}
        {salesRepView === 'settings' && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
            <p className="text-gray-600">Configure your sales rep profile</p>
          </div>
        )}
      </SalesRepLayout>
    );
  }

  return (
    <StorefrontLayout currentMode={storefrontMode} onModeChange={setStorefrontMode}>
      {storefrontMode === 'retail' && <RetailModeView />}
      {storefrontMode === 'wholesale' && <WholesaleModeView />}
      {storefrontMode === 'deals' && <DealsModeView />}
      {storefrontMode === 'quick_order' && <QuickOrderView />}
    </StorefrontLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
