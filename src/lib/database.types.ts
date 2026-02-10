export type UserRole = 'guest' | 'retail' | 'b2b_pending' | 'b2b_approved' | 'vip' | 'sales_rep' | 'vendor' | 'admin';

export type CompanyStatus = 'pending' | 'approved' | 'suspended';

export type VendorStatus = 'applied' | 'pending' | 'approved' | 'rejected' | 'suspended';

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type SiteMode = 'retail' | 'wholesale' | 'deals' | 'quick_order';

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          company_id: string | null;
          assigned_sales_rep_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          company_id?: string | null;
          assigned_sales_rep_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: UserRole;
          company_id?: string | null;
          assigned_sales_rep_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      companies: {
        Row: {
          id: string;
          name: string;
          pricing_tier_id: string | null;
          resale_certificate: string | null;
          tax_exempt: boolean;
          status: CompanyStatus;
          assigned_sales_rep_id: string | null;
          credit_limit: number;
          net_terms_days: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          pricing_tier_id?: string | null;
          resale_certificate?: string | null;
          tax_exempt?: boolean;
          status?: CompanyStatus;
          assigned_sales_rep_id?: string | null;
          credit_limit?: number;
          net_terms_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          pricing_tier_id?: string | null;
          resale_certificate?: string | null;
          tax_exempt?: boolean;
          status?: CompanyStatus;
          assigned_sales_rep_id?: string | null;
          credit_limit?: number;
          net_terms_days?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      sites: {
        Row: {
          id: string;
          name: string;
          slug: string;
          domain: string | null;
          status: string;
          default_mode: SiteMode;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          domain?: string | null;
          status?: string;
          default_mode?: SiteMode;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          domain?: string | null;
          status?: string;
          default_mode?: SiteMode;
          created_at?: string;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          vendor_id: string;
          category_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          short_description: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          category_id?: string | null;
          name: string;
          slug: string;
          description?: string | null;
          short_description?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          category_id?: string | null;
          name?: string;
          slug?: string;
          description?: string | null;
          short_description?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          sku: string;
          name: string;
          retail_price: number;
          vip_price: number | null;
          vendor_cost: number;
          platform_margin_percent: number;
          floor_price: number | null;
          map_price: number | null;
          inventory_quantity: number;
          low_stock_threshold: number;
          weight_oz: number | null;
          requires_shipping: boolean;
          moq: number;
          case_quantity: number;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          sku: string;
          name: string;
          retail_price: number;
          vip_price?: number | null;
          vendor_cost: number;
          platform_margin_percent?: number;
          floor_price?: number | null;
          map_price?: number | null;
          inventory_quantity?: number;
          low_stock_threshold?: number;
          weight_oz?: number | null;
          requires_shipping?: boolean;
          moq?: number;
          case_quantity?: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          sku?: string;
          name?: string;
          retail_price?: number;
          vip_price?: number | null;
          vendor_cost?: number;
          platform_margin_percent?: number;
          floor_price?: number | null;
          map_price?: number | null;
          inventory_quantity?: number;
          low_stock_threshold?: number;
          weight_oz?: number | null;
          requires_shipping?: boolean;
          moq?: number;
          case_quantity?: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          site_id: string;
          user_id: string | null;
          company_id: string | null;
          sales_rep_id: string | null;
          customer_email: string;
          customer_name: string;
          shipping_address: any;
          billing_address: any;
          subtotal: number;
          discount_amount: number;
          tax_amount: number;
          shipping_amount: number;
          total: number;
          payment_status: PaymentStatus;
          payment_method: string | null;
          fulfillment_status: OrderStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number: string;
          site_id: string;
          user_id?: string | null;
          company_id?: string | null;
          sales_rep_id?: string | null;
          customer_email: string;
          customer_name: string;
          shipping_address: any;
          billing_address: any;
          subtotal: number;
          discount_amount?: number;
          tax_amount?: number;
          shipping_amount?: number;
          total: number;
          payment_status?: PaymentStatus;
          payment_method?: string | null;
          fulfillment_status?: OrderStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          site_id?: string;
          user_id?: string | null;
          company_id?: string | null;
          sales_rep_id?: string | null;
          customer_email?: string;
          customer_name?: string;
          shipping_address?: any;
          billing_address?: any;
          subtotal?: number;
          discount_amount?: number;
          tax_amount?: number;
          shipping_amount?: number;
          total?: number;
          payment_status?: PaymentStatus;
          payment_method?: string | null;
          fulfillment_status?: OrderStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      vendors: {
        Row: {
          id: string;
          user_id: string | null;
          company_name: string;
          contact_name: string;
          contact_email: string;
          contact_phone: string | null;
          status: VendorStatus;
          shopify_store_url: string | null;
          shopify_api_key: string | null;
          api_integration_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          company_name: string;
          contact_name: string;
          contact_email: string;
          contact_phone?: string | null;
          status?: VendorStatus;
          shopify_store_url?: string | null;
          shopify_api_key?: string | null;
          api_integration_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          company_name?: string;
          contact_name?: string;
          contact_email?: string;
          contact_phone?: string | null;
          status?: VendorStatus;
          shopify_store_url?: string | null;
          shopify_api_key?: string | null;
          api_integration_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
