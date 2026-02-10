import { ReactNode, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ShoppingBag, Grid3x3, Zap, ListOrdered, User, LogOut, LogIn } from 'lucide-react';
import type { SiteMode } from '../../lib/database.types';

interface StorefrontLayoutProps {
  children: ReactNode;
  currentMode: SiteMode;
  onModeChange: (mode: SiteMode) => void;
}

export function StorefrontLayout({ children, currentMode, onModeChange }: StorefrontLayoutProps) {
  const { profile, signOut } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const modes = [
    { id: 'retail' as SiteMode, label: 'Retail', icon: ShoppingBag, description: 'Browse & discover' },
    { id: 'wholesale' as SiteMode, label: 'Wholesale', icon: Grid3x3, description: 'Bulk ordering' },
    { id: 'deals' as SiteMode, label: 'Deals', icon: Zap, description: 'Special offers' },
    { id: 'quick_order' as SiteMode, label: 'Quick Order', icon: ListOrdered, description: 'Rapid checkout' },
  ];

  const availableModes = modes.filter(mode => {
    if (mode.id === 'wholesale' && !profile?.role.includes('b2b')) return false;
    if (mode.id === 'quick_order' && !profile?.role.includes('b2b')) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-gray-900">Commerce OS</h1>

              <nav className="hidden md:flex space-x-1">
                {availableModes.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => onModeChange(mode.id)}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                        currentMode === mode.id
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{mode.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <User className="w-5 h-5 text-gray-600" />
                  {profile && (
                    <span className="text-sm font-medium text-gray-700">
                      {profile.full_name || profile.email}
                    </span>
                  )}
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                    {profile ? (
                      <>
                        <div className="px-4 py-2 border-b border-gray-200">
                          <p className="text-sm font-medium text-gray-900">{profile.email}</p>
                          <p className="text-xs text-gray-500 capitalize">{profile.role}</p>
                        </div>
                        <button
                          onClick={() => {
                            signOut();
                            setUserMenuOpen(false);
                          }}
                          className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Sign Out</span>
                        </button>
                      </>
                    ) : (
                      <a
                        href="/login"
                        className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>Sign In</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="md:hidden pb-3 space-x-2 overflow-x-auto flex">
            {availableModes.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => onModeChange(mode.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                    currentMode === mode.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main>
        {children}
      </main>
    </div>
  );
}
