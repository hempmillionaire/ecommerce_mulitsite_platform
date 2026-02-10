import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Globe, Plus, Trash2, Check, X, Shield } from 'lucide-react';

interface Site {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  status: string;
  default_mode: string;
  created_at: string;
}

interface SiteDomain {
  id: string;
  site_id: string;
  domain: string;
  is_primary: boolean;
  ssl_enabled: boolean;
  status: string;
}

export function SiteManagement() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [domains, setDomains] = useState<SiteDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddSite, setShowAddSite] = useState(false);
  const [showAddDomain, setShowAddDomain] = useState(false);

  const [newSite, setNewSite] = useState({
    name: '',
    slug: '',
    default_mode: 'retail',
  });

  const [newDomain, setNewDomain] = useState({
    domain: '',
    is_primary: false,
    ssl_enabled: true,
  });

  useEffect(() => {
    loadSites();
  }, []);

  useEffect(() => {
    if (selectedSite) {
      loadDomains(selectedSite);
    }
  }, [selectedSite]);

  const loadSites = async () => {
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSites(data || []);
      if (data && data.length > 0 && !selectedSite) {
        setSelectedSite(data[0].id);
      }
    } catch (error) {
      console.error('Error loading sites:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDomains = async (siteId: string) => {
    try {
      const { data, error } = await supabase
        .from('site_domains')
        .select('*')
        .eq('site_id', siteId)
        .order('is_primary', { ascending: false });

      if (error) throw error;
      setDomains(data || []);
    } catch (error) {
      console.error('Error loading domains:', error);
    }
  };

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('sites')
        .insert({
          name: newSite.name,
          slug: newSite.slug.toLowerCase().replace(/\s+/g, '-'),
          default_mode: newSite.default_mode,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      setSites([data, ...sites]);
      setSelectedSite(data.id);
      setShowAddSite(false);
      setNewSite({ name: '', slug: '', default_mode: 'retail' });
    } catch (error) {
      console.error('Error adding site:', error);
      alert('Failed to add site');
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSite) return;

    try {
      const { data, error } = await supabase
        .from('site_domains')
        .insert({
          site_id: selectedSite,
          domain: newDomain.domain.toLowerCase(),
          is_primary: newDomain.is_primary,
          ssl_enabled: newDomain.ssl_enabled,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      setDomains([data, ...domains]);
      setShowAddDomain(false);
      setNewDomain({ domain: '', is_primary: false, ssl_enabled: true });
    } catch (error) {
      console.error('Error adding domain:', error);
      alert('Failed to add domain. Make sure the domain is unique.');
    }
  };

  const handleDeleteDomain = async (domainId: string) => {
    if (!confirm('Are you sure you want to delete this domain?')) return;

    try {
      const { error } = await supabase
        .from('site_domains')
        .delete()
        .eq('id', domainId);

      if (error) throw error;
      setDomains(domains.filter(d => d.id !== domainId));
    } catch (error) {
      console.error('Error deleting domain:', error);
      alert('Failed to delete domain');
    }
  };

  const handleSetPrimaryDomain = async (domainId: string) => {
    if (!selectedSite) return;

    try {
      await supabase
        .from('site_domains')
        .update({ is_primary: false })
        .eq('site_id', selectedSite);

      const { error } = await supabase
        .from('site_domains')
        .update({ is_primary: true })
        .eq('id', domainId);

      if (error) throw error;
      await loadDomains(selectedSite);
    } catch (error) {
      console.error('Error setting primary domain:', error);
      alert('Failed to set primary domain');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading sites...</p>
      </div>
    );
  }

  const currentSite = sites.find(s => s.id === selectedSite);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Site Management</h1>
        <p className="text-gray-600">Manage sites and their domains with zero-code deployment</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Sites</h2>
              <button
                onClick={() => setShowAddSite(true)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {showAddSite && (
              <form onSubmit={handleAddSite} className="mb-4 p-3 bg-gray-50 rounded-lg">
                <input
                  type="text"
                  placeholder="Site Name"
                  value={newSite.name}
                  onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2"
                  required
                />
                <input
                  type="text"
                  placeholder="Slug"
                  value={newSite.slug}
                  onChange={(e) => setNewSite({ ...newSite, slug: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2"
                  required
                />
                <select
                  value={newSite.default_mode}
                  onChange={(e) => setNewSite({ ...newSite, default_mode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2"
                >
                  <option value="retail">Retail Mode</option>
                  <option value="wholesale">Wholesale Mode</option>
                  <option value="deals">Deals Mode</option>
                  <option value="quick_order">Quick Order Mode</option>
                </select>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add Site
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddSite(false)}
                    className="py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {sites.map((site) => (
                <button
                  key={site.id}
                  onClick={() => setSelectedSite(site.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    selectedSite === site.id
                      ? 'bg-blue-50 border-2 border-blue-600'
                      : 'bg-white border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium text-gray-900">{site.name}</div>
                  <div className="text-sm text-gray-600">{site.slug}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {currentSite ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{currentSite.name}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">{currentSite.slug}</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded capitalize">{currentSite.status}</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded capitalize">{currentSite.default_mode}</span>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Globe className="w-5 h-5 mr-2" />
                    Domains
                  </h3>
                  <button
                    onClick={() => setShowAddDomain(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Domain</span>
                  </button>
                </div>

                {showAddDomain && (
                  <form onSubmit={handleAddDomain} className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      placeholder="example.com"
                      value={newDomain.domain}
                      onChange={(e) => setNewDomain({ ...newDomain, domain: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3"
                      required
                    />
                    <div className="flex items-center gap-4 mb-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={newDomain.is_primary}
                          onChange={(e) => setNewDomain({ ...newDomain, is_primary: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Primary Domain</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={newDomain.ssl_enabled}
                          onChange={(e) => setNewDomain({ ...newDomain, ssl_enabled: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">SSL Enabled</span>
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Add Domain
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddDomain(false)}
                        className="py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {domains.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Globe className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">No domains configured for this site</p>
                    <p className="text-sm text-gray-500 mt-1">Add a domain to make this site accessible</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {domains.map((domain) => (
                      <div
                        key={domain.id}
                        className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{domain.domain}</span>
                            {domain.is_primary && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                                PRIMARY
                              </span>
                            )}
                            {domain.ssl_enabled && (
                              <Shield className="w-4 h-4 text-green-600" />
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            Status: <span className="capitalize">{domain.status}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!domain.is_primary && (
                            <button
                              onClick={() => handleSetPrimaryDomain(domain.id)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Set as primary"
                            >
                              <Check className="w-5 h-5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteDomain(domain.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete domain"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Domain Resolution</h4>
                <p className="text-sm text-blue-800">
                  All domains are automatically resolved server-side from the Host header.
                  No code changes needed when adding new sites or domains.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Site Selected</h3>
              <p className="text-gray-600">Select a site to manage its domains</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
