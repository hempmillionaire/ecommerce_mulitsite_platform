/*
  # Complete Commerce Operating System - Initial Schema

  ## Overview
  This migration creates the foundational schema for a multi-brand, multi-vendor commerce OS
  with dropshipping, distribution, and AI-driven marketing capabilities.

  ## 1. Authentication & Identity Tables
    - `user_profiles` - Extended user profiles with role management
    - `companies` - B2B company entities with pricing tiers
    - `company_users` - Junction table linking users to companies

  ## 2. Product Catalog Tables
    - `categories` - Global product taxonomy
    - `products` - Master product records
    - `product_variants` - SKU-level records with pricing
    - `product_images` - Product imagery
    - `site_product_visibility` - Per-site product toggles
    - `site_category_visibility` - Per-site category toggles

  ## 3. Multi-Site Tables
    - `sites` - Brand/storefront configurations
    - `site_settings` - Per-site configuration

  ## 4. Vendor System Tables
    - `vendors` - Vendor profiles and status
    - `vendor_agreements` - Versioned legal agreements with e-signatures
    - `vendor_subscriptions` - Monthly subscription tiers
    - `vendor_selling_modes` - Vendor's enabled selling modes

  ## 5. Pricing & Promotions Tables
    - `pricing_tiers` - B2B pricing tier definitions
    - `variant_tier_pricing` - Per-variant tier pricing
    - `promotions` - Vendor-funded promotional campaigns
    - `promo_product_rules` - Product-specific promo rules
    - `promo_category_rules` - Category-specific promo rules
    - `promo_usage` - Promo redemption tracking

  ## 6. Sales Rep Tables
    - `sales_reps` - Sales representative profiles
    - `sales_rep_companies` - Company assignments
    - `quotes` - Sales rep generated quotes

  ## 7. Order Management Tables
    - `orders` - Master order records
    - `order_items` - Line items with vendor attribution
    - `order_vendor_splits` - Vendor-specific order routing
    - `fulfillments` - Shipment tracking

  ## 8. Email & Marketing Tables
    - `email_identities` - Email subscribers and users
    - `email_campaigns` - Marketing campaign records
    - `email_events` - Send/open/click tracking
    - `ai_customer_profiles` - AI-generated customer intent profiles
    - `ai_message_queue` - Pending AI-generated messages
    - `marketing_suppressions` - Opt-out and frequency cap enforcement

  ## 9. Security
    - RLS enabled on ALL tables
    - Role-based access policies
    - Server-side enforcement of business rules
*/

-- ============================================================================
-- 1. AUTHENTICATION & IDENTITY
-- ============================================================================

-- User profiles with role management
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'guest' CHECK (role IN ('guest', 'retail', 'b2b_pending', 'b2b_approved', 'vip', 'sales_rep', 'vendor', 'admin')),
  company_id uuid,
  assigned_sales_rep_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- B2B Companies
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pricing_tier_id uuid,
  resale_certificate text,
  tax_exempt boolean DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended')),
  assigned_sales_rep_id uuid,
  credit_limit decimal(12,2) DEFAULT 0,
  net_terms_days integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Company-User junction
CREATE TABLE IF NOT EXISTS company_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- ============================================================================
-- 2. PRODUCT CATALOG
-- ============================================================================

-- Global categories
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Master products
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  short_description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Product variants (SKU level)
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  
  -- Pricing structure
  retail_price decimal(12,2) NOT NULL,
  vip_price decimal(12,2),
  vendor_cost decimal(12,2) NOT NULL,
  platform_margin_percent decimal(5,2) NOT NULL DEFAULT 15.00,
  floor_price decimal(12,2),
  map_price decimal(12,2),
  
  -- Inventory
  inventory_quantity integer DEFAULT 0,
  low_stock_threshold integer DEFAULT 10,
  
  -- Shipping
  weight_oz decimal(8,2),
  requires_shipping boolean DEFAULT true,
  
  -- B2B
  moq integer DEFAULT 1,
  case_quantity integer DEFAULT 1,
  
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Product images
CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt_text text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 3. MULTI-SITE SYSTEM
-- ============================================================================

-- Sites (brands/storefronts)
CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  domain text UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'archived')),
  default_mode text NOT NULL DEFAULT 'retail' CHECK (default_mode IN ('retail', 'wholesale', 'deals', 'quick_order')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Site-specific settings
CREATE TABLE IF NOT EXISTS site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid UNIQUE NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  logo_url text,
  primary_color text DEFAULT '#000000',
  secondary_color text DEFAULT '#666666',
  accent_color text DEFAULT '#0066cc',
  custom_css text,
  contact_email text,
  support_email text,
  settings jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- Per-site product visibility
CREATE TABLE IF NOT EXISTS site_product_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(site_id, product_id)
);

-- Per-site category visibility
CREATE TABLE IF NOT EXISTS site_category_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(site_id, category_id)
);

-- ============================================================================
-- 4. VENDOR SYSTEM
-- ============================================================================

-- Vendors
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  company_name text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'pending', 'approved', 'rejected', 'suspended')),
  
  -- Dropship integration
  shopify_store_url text,
  shopify_api_key text,
  api_integration_type text CHECK (api_integration_type IN ('shopify', '3pl', 'manual', 'custom')),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Vendor selling modes
CREATE TABLE IF NOT EXISTS vendor_selling_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('d2c', 'b2b_wholesale', 'distributor')),
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(vendor_id, mode)
);

-- Vendor agreements (versioned, immutable)
CREATE TABLE IF NOT EXISTS vendor_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  agreement_version text NOT NULL,
  agreement_text text NOT NULL,
  
  -- E-signature
  signed_by_name text,
  signed_at timestamptz,
  signed_ip_address text,
  
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'rejected', 'expired')),
  created_at timestamptz DEFAULT now()
);

-- Vendor subscriptions
CREATE TABLE IF NOT EXISTS vendor_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('starter', 'growth', 'scale')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled', 'expired')),
  
  -- Billing
  monthly_price decimal(10,2) NOT NULL,
  billing_period_start timestamptz NOT NULL,
  billing_period_end timestamptz NOT NULL,
  
  -- Features
  allows_d2c boolean DEFAULT true,
  allows_wholesale boolean DEFAULT false,
  allows_distributor boolean DEFAULT false,
  allows_ai_marketing boolean DEFAULT false,
  max_products integer,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 5. PRICING & PROMOTIONS
-- ============================================================================

-- Pricing tiers (B2B)
CREATE TABLE IF NOT EXISTS pricing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  discount_percent decimal(5,2) DEFAULT 0,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Variant-level tier pricing
CREATE TABLE IF NOT EXISTS variant_tier_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  pricing_tier_id uuid NOT NULL REFERENCES pricing_tiers(id) ON DELETE CASCADE,
  price decimal(12,2) NOT NULL,
  moq integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE(variant_id, pricing_tier_id)
);

-- Promotions (vendor-funded)
CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  
  name text NOT NULL,
  code text UNIQUE,
  description text,
  
  -- Discount structure
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed_amount', 'fixed_price')),
  discount_value decimal(12,2) NOT NULL,
  
  -- Applicability
  applies_to text NOT NULL CHECK (applies_to IN ('sitewide', 'category', 'product', 'variant')),
  min_order_value decimal(12,2),
  max_discount_amount decimal(12,2),
  
  -- Targeting
  allowed_roles text[] DEFAULT ARRAY['retail', 'b2b_approved', 'vip'],
  
  -- Limits
  usage_limit integer,
  usage_per_customer integer,
  
  -- Schedule
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  
  -- Stacking
  stackable boolean DEFAULT false,
  
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'expired')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Promo product rules
CREATE TABLE IF NOT EXISTS promo_product_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Promo category rules
CREATE TABLE IF NOT EXISTS promo_category_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Promo usage tracking
CREATE TABLE IF NOT EXISTS promo_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  order_id uuid NOT NULL,
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  discount_amount decimal(12,2) NOT NULL,
  vendor_cost decimal(12,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 6. SALES REP SYSTEM
-- ============================================================================

-- Sales representatives
CREATE TABLE IF NOT EXISTS sales_reps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  commission_rate decimal(5,2) DEFAULT 5.00,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Sales rep company assignments
CREATE TABLE IF NOT EXISTS sales_rep_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_rep_id uuid NOT NULL REFERENCES sales_reps(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(sales_rep_id, company_id)
);

-- Sales quotes
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_rep_id uuid NOT NULL REFERENCES sales_reps(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  quote_number text UNIQUE NOT NULL,
  
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal decimal(12,2) NOT NULL,
  discount_amount decimal(12,2) DEFAULT 0,
  tax_amount decimal(12,2) DEFAULT 0,
  total decimal(12,2) NOT NULL,
  
  notes text,
  expires_at timestamptz,
  
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 7. ORDER MANAGEMENT
-- ============================================================================

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  
  -- Attribution
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  sales_rep_id uuid REFERENCES sales_reps(id) ON DELETE SET NULL,
  
  -- Customer info
  customer_email text NOT NULL,
  customer_name text NOT NULL,
  
  -- Shipping
  shipping_address jsonb NOT NULL,
  billing_address jsonb NOT NULL,
  
  -- Pricing
  subtotal decimal(12,2) NOT NULL,
  discount_amount decimal(12,2) DEFAULT 0,
  tax_amount decimal(12,2) DEFAULT 0,
  shipping_amount decimal(12,2) DEFAULT 0,
  total decimal(12,2) NOT NULL,
  
  -- Payment
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_method text,
  
  -- Fulfillment
  fulfillment_status text NOT NULL DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Order line items
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Product info (denormalized for immutability)
  product_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  
  sku text NOT NULL,
  product_name text NOT NULL,
  variant_name text NOT NULL,
  
  -- Pricing snapshot
  unit_price decimal(12,2) NOT NULL,
  quantity integer NOT NULL,
  subtotal decimal(12,2) NOT NULL,
  discount_amount decimal(12,2) DEFAULT 0,
  total decimal(12,2) NOT NULL,
  
  -- Vendor attribution
  vendor_cost decimal(12,2) NOT NULL,
  platform_margin decimal(12,2) NOT NULL,
  promo_vendor_cost decimal(12,2) DEFAULT 0,
  
  created_at timestamptz DEFAULT now()
);

-- Vendor-specific order splits
CREATE TABLE IF NOT EXISTS order_vendor_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  
  -- Routing
  routing_method text NOT NULL CHECK (routing_method IN ('shopify', '3pl', 'manual', 'custom')),
  routing_status text NOT NULL DEFAULT 'pending' CHECK (routing_status IN ('pending', 'sent', 'confirmed', 'failed')),
  
  external_order_id text,
  sent_at timestamptz,
  
  line_item_ids uuid[] NOT NULL,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Fulfillments
CREATE TABLE IF NOT EXISTS fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  
  tracking_number text,
  tracking_url text,
  carrier text,
  
  line_item_ids uuid[] NOT NULL,
  
  shipped_at timestamptz,
  delivered_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 8. EMAIL & MARKETING
-- ============================================================================

-- Email identities
CREATE TABLE IF NOT EXISTS email_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  
  -- Opt-in status
  subscribed_marketing boolean DEFAULT false,
  subscribed_transactional boolean DEFAULT true,
  
  -- Preferences
  frequency_cap_daily integer DEFAULT 1,
  frequency_cap_weekly integer DEFAULT 3,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Email campaigns
CREATE TABLE IF NOT EXISTS email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  campaign_type text NOT NULL CHECK (campaign_type IN ('transactional', 'marketing', 'ai_generated')),
  
  subject text,
  from_name text,
  from_email text,
  
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  
  scheduled_at timestamptz,
  sent_at timestamptz,
  
  recipient_count integer DEFAULT 0,
  opened_count integer DEFAULT 0,
  clicked_count integer DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Email events
CREATE TABLE IF NOT EXISTS email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES email_campaigns(id) ON DELETE CASCADE,
  email_identity_id uuid NOT NULL REFERENCES email_identities(id) ON DELETE CASCADE,
  
  event_type text NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained')),
  
  metadata jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now()
);

-- AI customer profiles
CREATE TABLE IF NOT EXISTS ai_customer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
  email_identity_id uuid UNIQUE REFERENCES email_identities(id) ON DELETE CASCADE,
  
  -- Intent analysis
  intent_score decimal(5,2) DEFAULT 0,
  product_affinities jsonb DEFAULT '[]'::jsonb,
  category_affinities jsonb DEFAULT '[]'::jsonb,
  behavioral_signals jsonb DEFAULT '{}'::jsonb,
  
  -- AI recommendations
  recommended_products uuid[],
  recommended_promos uuid[],
  
  last_analyzed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- AI message queue
CREATE TABLE IF NOT EXISTS ai_message_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_identity_id uuid NOT NULL REFERENCES email_identities(id) ON DELETE CASCADE,
  
  subject text NOT NULL,
  message_body text NOT NULL,
  
  -- Guardrails
  frequency_check_passed boolean DEFAULT false,
  opt_in_verified boolean DEFAULT false,
  suppression_check_passed boolean DEFAULT false,
  
  -- Scheduling
  scheduled_send_at timestamptz NOT NULL,
  sent_at timestamptz,
  
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'sent', 'cancelled')),
  
  created_at timestamptz DEFAULT now()
);

-- Marketing suppressions
CREATE TABLE IF NOT EXISTS marketing_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_identity_id uuid NOT NULL REFERENCES email_identities(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  
  reason text NOT NULL CHECK (reason IN ('unsubscribe', 'complaint', 'bounce', 'manual')),
  
  suppressed_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_company ON user_profiles(company_id);

CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_company ON orders(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_site ON orders(site_id);
CREATE INDEX IF NOT EXISTS idx_orders_sales_rep ON orders(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_vendor ON order_items(vendor_id);

CREATE INDEX IF NOT EXISTS idx_promotions_vendor ON promotions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_email_identities_email ON email_identities(email);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign ON email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_identity ON email_events(email_identity_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_product_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_category_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_selling_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_tier_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_product_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_rep_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_vendor_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_message_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_suppressions ENABLE ROW LEVEL SECURITY;

-- User Profiles: Users can view their own profile, admins can view all
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Products: Public read for active products, vendor/admin write
CREATE POLICY "Anyone can view active products"
  ON products FOR SELECT
  TO authenticated
  USING (status = 'active');

CREATE POLICY "Vendors can manage own products"
  ON products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = products.vendor_id
      AND vendors.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all products"
  ON products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Product Variants: Similar to products
CREATE POLICY "Anyone can view active variants"
  ON product_variants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_variants.product_id
      AND products.status = 'active'
    )
  );

-- Orders: Users see own orders, sales reps see assigned, admins see all
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Sales reps can view assigned company orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_rep_companies src
      JOIN sales_reps sr ON sr.id = src.sales_rep_id
      WHERE sr.user_id = auth.uid()
      AND src.company_id = orders.company_id
    )
  );

CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Vendors: Vendors can manage own profile, admins can manage all
CREATE POLICY "Vendors can view own profile"
  ON vendors FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Vendors can update own profile"
  ON vendors FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all vendors"
  ON vendors FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Sales Reps: Reps can view assigned companies only
CREATE POLICY "Sales reps can view assigned companies"
  ON sales_rep_companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_reps
      WHERE sales_reps.id = sales_rep_companies.sales_rep_id
      AND sales_reps.user_id = auth.uid()
    )
  );

-- Email Identities: Users can manage own, admins can view all
CREATE POLICY "Users can view own email identity"
  ON email_identities FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own email preferences"
  ON email_identities FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin-only tables (full access)
CREATE POLICY "Admins can manage sites"
  ON sites FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage pricing tiers"
  ON pricing_tiers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage promotions"
  ON promotions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );
