import { supabase } from './supabase';

export interface VendorGoLiveStatus {
  canGoLive: boolean;
  isApproved: boolean;
  hasActiveSubscription: boolean;
  hasSignedAgreement: boolean;
  blockers: string[];
}

export interface ProductVisibilityCheck {
  isVisible: boolean;
  reason?: string;
}

export interface PromoValidation {
  isValid: boolean;
  canBeUsed: boolean;
  errors: string[];
}

export class EnforcementService {
  static async checkVendorCanGoLive(vendorId: string): Promise<VendorGoLiveStatus> {
    try {
      const { data, error } = await supabase.rpc('check_vendor_can_go_live', {
        p_vendor_id: vendorId,
      });

      if (error) throw error;

      const { data: vendor } = await supabase
        .from('vendors')
        .select('status')
        .eq('id', vendorId)
        .single();

      const { data: subscription } = await supabase
        .from('vendor_subscriptions')
        .select('status, billing_period_end')
        .eq('vendor_id', vendorId)
        .eq('status', 'active')
        .maybeSingle();

      const { data: agreement } = await supabase
        .from('vendor_agreements')
        .select('status')
        .eq('vendor_id', vendorId)
        .eq('status', 'signed')
        .maybeSingle();

      const isApproved = vendor?.status === 'approved';
      const hasActiveSubscription = !!subscription && new Date(subscription.billing_period_end) > new Date();
      const hasSignedAgreement = !!agreement;

      const blockers: string[] = [];
      if (!isApproved) blockers.push('Vendor not approved');
      if (!hasActiveSubscription) blockers.push('No active subscription');
      if (!hasSignedAgreement) blockers.push('No signed agreement');

      return {
        canGoLive: data === true,
        isApproved,
        hasActiveSubscription,
        hasSignedAgreement,
        blockers,
      };
    } catch (error) {
      console.error('Error checking vendor go-live status:', error);
      return {
        canGoLive: false,
        isApproved: false,
        hasActiveSubscription: false,
        hasSignedAgreement: false,
        blockers: ['Error checking status'],
      };
    }
  }

  static async checkProductVisibilityOnSite(
    productId: string,
    siteId: string
  ): Promise<ProductVisibilityCheck> {
    try {
      const { data, error } = await supabase.rpc('is_product_visible_on_site', {
        p_product_id: productId,
        p_site_id: siteId,
      });

      if (error) throw error;

      if (!data) {
        return {
          isVisible: false,
          reason: 'Product not visible on this site',
        };
      }

      const { data: product } = await supabase
        .from('products')
        .select('status, vendor_id')
        .eq('id', productId)
        .single();

      if (product?.status !== 'active') {
        return {
          isVisible: false,
          reason: 'Product is not active',
        };
      }

      const vendorStatus = await this.checkVendorCanGoLive(product.vendor_id);
      if (!vendorStatus.canGoLive) {
        return {
          isVisible: false,
          reason: `Vendor cannot go live: ${vendorStatus.blockers.join(', ')}`,
        };
      }

      return {
        isVisible: true,
      };
    } catch (error) {
      console.error('Error checking product visibility:', error);
      return {
        isVisible: false,
        reason: 'Error checking visibility',
      };
    }
  }

  static async getVisibleProductsForSite(siteId: string, limit = 100): Promise<string[]> {
    try {
      const { data: visibilityRecords } = await supabase
        .from('site_product_visibility')
        .select('product_id')
        .eq('site_id', siteId)
        .eq('visible', true)
        .limit(limit);

      if (!visibilityRecords) return [];

      const productIds = visibilityRecords.map(v => v.product_id);

      const { data: products } = await supabase
        .from('products')
        .select('id, vendor_id')
        .in('id', productIds)
        .eq('status', 'active');

      if (!products) return [];

      const visibleProducts: string[] = [];

      for (const product of products) {
        const vendorStatus = await this.checkVendorCanGoLive(product.vendor_id);
        if (vendorStatus.canGoLive) {
          visibleProducts.push(product.id);
        }
      }

      return visibleProducts;
    } catch (error) {
      console.error('Error getting visible products:', error);
      return [];
    }
  }

  static async validatePromotion(
    promoId: string,
    siteId: string,
    userRole: string
  ): Promise<PromoValidation> {
    try {
      const { data: promo } = await supabase
        .from('promotions')
        .select('*')
        .eq('id', promoId)
        .single();

      if (!promo) {
        return {
          isValid: false,
          canBeUsed: false,
          errors: ['Promotion not found'],
        };
      }

      const errors: string[] = [];

      if (promo.status !== 'active') {
        errors.push('Promotion is not active');
      }

      if (promo.site_id && promo.site_id !== siteId) {
        errors.push('Promotion not valid for this site');
      }

      const now = new Date();
      if (new Date(promo.starts_at) > now) {
        errors.push('Promotion has not started yet');
      }

      if (promo.ends_at && new Date(promo.ends_at) < now) {
        errors.push('Promotion has expired');
      }

      if (promo.allowed_roles && !promo.allowed_roles.includes(userRole)) {
        errors.push('Promotion not available for your account type');
      }

      if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
        errors.push('Promotion usage limit reached');
      }

      const vendorStatus = await this.checkVendorCanGoLive(promo.vendor_id);
      if (!vendorStatus.canGoLive) {
        errors.push('Promotion vendor is not active');
      }

      return {
        isValid: promo.status === 'active',
        canBeUsed: errors.length === 0,
        errors,
      };
    } catch (error) {
      console.error('Error validating promotion:', error);
      return {
        isValid: false,
        canBeUsed: false,
        errors: ['Error validating promotion'],
      };
    }
  }

  static async enforceVendorSubscription(vendorId: string): Promise<boolean> {
    try {
      const { data: subscription } = await supabase
        .from('vendor_subscriptions')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('status', 'active')
        .maybeSingle();

      if (!subscription) {
        await supabase
          .from('products')
          .update({ status: 'archived' })
          .eq('vendor_id', vendorId)
          .eq('status', 'active');

        return false;
      }

      if (new Date(subscription.billing_period_end) < new Date()) {
        await supabase
          .from('vendor_subscriptions')
          .update({ status: 'expired' })
          .eq('id', subscription.id);

        await supabase
          .from('products')
          .update({ status: 'archived' })
          .eq('vendor_id', vendorId)
          .eq('status', 'active');

        return false;
      }

      return true;
    } catch (error) {
      console.error('Error enforcing vendor subscription:', error);
      return false;
    }
  }

  static async calculateVendorPromoCosts(
    vendorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    try {
      const { data: promoUsage } = await supabase
        .from('promo_usage')
        .select('vendor_cost')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('promo_id', vendorId);

      if (!promoUsage) return 0;

      return promoUsage.reduce((sum, usage) => sum + Number(usage.vendor_cost), 0);
    } catch (error) {
      console.error('Error calculating vendor promo costs:', error);
      return 0;
    }
  }

  static async trackPromoUsage(
    promoId: string,
    orderId: string,
    userId: string | null,
    discountAmount: number
  ): Promise<void> {
    try {
      const { data: promo } = await supabase
        .from('promotions')
        .select('vendor_id')
        .eq('id', promoId)
        .single();

      if (!promo) return;

      await supabase.from('promo_usage').insert({
        promo_id: promoId,
        order_id: orderId,
        user_id: userId,
        discount_amount: discountAmount,
        vendor_cost: discountAmount,
      });
    } catch (error) {
      console.error('Error tracking promo usage:', error);
    }
  }

  static async checkCategoryVisibilityOnSite(
    categoryId: string,
    siteId: string
  ): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('site_category_visibility')
        .select('visible')
        .eq('category_id', categoryId)
        .eq('site_id', siteId)
        .maybeSingle();

      return data?.visible ?? false;
    } catch (error) {
      console.error('Error checking category visibility:', error);
      return false;
    }
  }

  static async enforceProductVisibility(productId: string): Promise<void> {
    try {
      const { data: product } = await supabase
        .from('products')
        .select('vendor_id')
        .eq('id', productId)
        .single();

      if (!product) return;

      const vendorStatus = await this.checkVendorCanGoLive(product.vendor_id);

      if (!vendorStatus.canGoLive) {
        await supabase
          .from('products')
          .update({ status: 'archived' })
          .eq('id', productId);
      }
    } catch (error) {
      console.error('Error enforcing product visibility:', error);
    }
  }
}
