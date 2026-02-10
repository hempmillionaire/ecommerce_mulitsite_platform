import { supabase } from './supabase';

export interface ResolvedSite {
  siteId: string;
  siteName: string;
  siteSlug: string;
  domain: string;
  isPrimary: boolean;
}

export class DomainResolver {
  private static cache = new Map<string, ResolvedSite>();
  private static cacheExpiry = new Map<string, number>();
  private static CACHE_TTL = 5 * 60 * 1000;

  static async resolveSiteFromDomain(domain: string): Promise<ResolvedSite | null> {
    const normalizedDomain = domain.toLowerCase().replace(/:\d+$/, '');

    const cached = this.getCached(normalizedDomain);
    if (cached) {
      return cached;
    }

    try {
      const { data, error } = await supabase
        .rpc('resolve_site_from_domain', { p_domain: normalizedDomain });

      if (error) throw error;
      if (!data) return null;

      const { data: siteData } = await supabase
        .from('sites')
        .select('id, name, slug')
        .eq('id', data)
        .single();

      if (!siteData) return null;

      const { data: domainData } = await supabase
        .from('site_domains')
        .select('domain, is_primary')
        .eq('site_id', data)
        .eq('domain', normalizedDomain)
        .single();

      const resolved: ResolvedSite = {
        siteId: siteData.id,
        siteName: siteData.name,
        siteSlug: siteData.slug,
        domain: normalizedDomain,
        isPrimary: domainData?.is_primary || false,
      };

      this.setCached(normalizedDomain, resolved);
      return resolved;
    } catch (error) {
      console.error('Error resolving site from domain:', error);
      return null;
    }
  }

  static async resolveSiteFromHostHeader(hostHeader: string): Promise<ResolvedSite | null> {
    const domain = hostHeader.split(':')[0];
    return this.resolveSiteFromDomain(domain);
  }

  static async getSiteDomains(siteId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('site_domains')
        .select('domain')
        .eq('site_id', siteId)
        .eq('status', 'active')
        .order('is_primary', { ascending: false });

      if (error) throw error;
      return data?.map(d => d.domain) || [];
    } catch (error) {
      console.error('Error getting site domains:', error);
      return [];
    }
  }

  static async getPrimaryDomain(siteId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('site_domains')
        .select('domain')
        .eq('site_id', siteId)
        .eq('is_primary', true)
        .eq('status', 'active')
        .single();

      if (error) throw error;
      return data?.domain || null;
    } catch (error) {
      console.error('Error getting primary domain:', error);
      return null;
    }
  }

  private static getCached(domain: string): ResolvedSite | null {
    const expiry = this.cacheExpiry.get(domain);
    if (expiry && expiry > Date.now()) {
      return this.cache.get(domain) || null;
    }
    this.cache.delete(domain);
    this.cacheExpiry.delete(domain);
    return null;
  }

  private static setCached(domain: string, site: ResolvedSite): void {
    this.cache.set(domain, site);
    this.cacheExpiry.set(domain, Date.now() + this.CACHE_TTL);
  }

  static clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }
}

export function getCurrentDomain(): string {
  if (typeof window !== 'undefined') {
    return window.location.hostname;
  }
  return 'localhost';
}

export async function getCurrentSite(): Promise<ResolvedSite | null> {
  const domain = getCurrentDomain();
  return DomainResolver.resolveSiteFromDomain(domain);
}
