/*
  # Multi-Domain Support, Custom Auth System, and Enforcement Gates

  ## 1. Multi-Domain Support
    - `site_domains` - Multiple domains per site with primary domain designation
    - Domain resolution for scoping all operations by site

  ## 2. Custom Auth System (Source of Truth)
    - `auth_users` - Core user identity (replaces reliance on Supabase auth)
    - `auth_credentials` - Password hashes and credential management
    - `auth_sessions` - Session tokens and expiry tracking
    - `auth_role_assignments` - Role management with audit trail
    - `auth_audit_log` - Complete audit trail for auth events

  ## 3. Enforcement Gates
    - Vendor go-live checks (subscription + agreement)
    - Site visibility enforcement columns
    - Promo cost tracking and vendor debit columns

  ## Important Notes
    - Custom auth tables are now the source of truth
    - Supabase auth.users can be kept as optional adapter
    - All permission checks must use auth_users and auth_role_assignments
    - Domain resolution must happen server-side from Host header
*/

-- ============================================================================
-- 1. MULTI-DOMAIN SUPPORT
-- ============================================================================

-- Site domains (multiple domains per site)
CREATE TABLE IF NOT EXISTS site_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  domain text NOT NULL UNIQUE,
  is_primary boolean DEFAULT false,
  ssl_enabled boolean DEFAULT true,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'disabled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure only one primary domain per site
CREATE UNIQUE INDEX IF NOT EXISTS idx_site_domains_primary 
  ON site_domains(site_id) 
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_site_domains_domain ON site_domains(domain);
CREATE INDEX IF NOT EXISTS idx_site_domains_site ON site_domains(site_id);

-- ============================================================================
-- 2. CUSTOM AUTH SYSTEM (SOURCE OF TRUTH)
-- ============================================================================

-- Core user identity table (our source of truth)
CREATE TABLE IF NOT EXISTS auth_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  email_verified boolean DEFAULT false,
  email_verified_at timestamptz,
  full_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  
  -- Optional: link to Supabase auth if used as adapter
  supabase_user_id uuid UNIQUE,
  
  -- Metadata
  last_login_at timestamptz,
  last_login_ip text,
  login_count integer DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Password credentials (hashed)
CREATE TABLE IF NOT EXISTS auth_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  
  -- Password policy
  must_change_password boolean DEFAULT false,
  password_changed_at timestamptz DEFAULT now(),
  
  -- Failed login tracking
  failed_attempts integer DEFAULT 0,
  locked_until timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Active sessions
CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  
  -- Session metadata
  ip_address text,
  user_agent text,
  
  -- Expiry
  expires_at timestamptz NOT NULL,
  last_activity_at timestamptz DEFAULT now(),
  
  -- Session status
  revoked boolean DEFAULT false,
  revoked_at timestamptz,
  revoked_reason text,
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);

-- Role assignments with audit trail
CREATE TABLE IF NOT EXISTS auth_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('guest', 'retail', 'b2b_pending', 'b2b_approved', 'vip', 'sales_rep', 'vendor', 'admin')),
  
  -- Assignment metadata
  assigned_by uuid REFERENCES auth_users(id) ON DELETE SET NULL,
  assigned_at timestamptz DEFAULT now(),
  assigned_reason text,
  
  -- Revocation
  revoked boolean DEFAULT false,
  revoked_by uuid REFERENCES auth_users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoked_reason text,
  
  -- Current role indicator
  is_current boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now()
);

-- Only one current role per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_role_current 
  ON auth_role_assignments(user_id) 
  WHERE is_current = true AND revoked = false;

CREATE INDEX IF NOT EXISTS idx_auth_role_user ON auth_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_role_role ON auth_role_assignments(role);

-- Comprehensive auth audit log
CREATE TABLE IF NOT EXISTS auth_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth_users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'signup', 'login', 'logout', 'login_failed', 
    'password_changed', 'password_reset_requested', 'password_reset_completed',
    'email_verified', 'email_changed',
    'role_assigned', 'role_revoked', 'role_changed',
    'account_suspended', 'account_reactivated', 'account_deleted',
    'session_created', 'session_revoked',
    'approval_granted', 'approval_denied'
  )),
  
  -- Event details
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Context
  ip_address text,
  user_agent text,
  performed_by uuid REFERENCES auth_users(id) ON DELETE SET NULL,
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_user ON auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_event ON auth_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_created ON auth_audit_log(created_at DESC);

-- ============================================================================
-- 3. ENFORCEMENT GATES
-- ============================================================================

-- Add promo cost tracking columns to promotions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'promotions' AND column_name = 'total_vendor_cost'
  ) THEN
    ALTER TABLE promotions ADD COLUMN total_vendor_cost decimal(12,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'promotions' AND column_name = 'total_discount_given'
  ) THEN
    ALTER TABLE promotions ADD COLUMN total_discount_given decimal(12,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'promotions' AND column_name = 'usage_count'
  ) THEN
    ALTER TABLE promotions ADD COLUMN usage_count integer DEFAULT 0;
  END IF;
END $$;

-- Add visibility enforcement flag to products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'enforce_site_visibility'
  ) THEN
    ALTER TABLE products ADD COLUMN enforce_site_visibility boolean DEFAULT true;
  END IF;
END $$;

-- Vendor payout tracking
CREATE TABLE IF NOT EXISTS vendor_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  
  -- Payout period
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  
  -- Amounts
  gross_sales decimal(12,2) NOT NULL DEFAULT 0,
  platform_fees decimal(12,2) NOT NULL DEFAULT 0,
  promo_costs decimal(12,2) NOT NULL DEFAULT 0,
  other_deductions decimal(12,2) DEFAULT 0,
  net_payout decimal(12,2) NOT NULL,
  
  -- Status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  paid_at timestamptz,
  payment_method text,
  payment_reference text,
  
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_payouts_vendor ON vendor_payouts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payouts_period ON vendor_payouts(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_vendor_payouts_status ON vendor_payouts(status);

-- Update user_profiles to reference auth_users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN auth_user_id uuid REFERENCES auth_users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Migrate data from Supabase auth to custom auth (if needed)
INSERT INTO auth_users (id, email, supabase_user_id, created_at)
SELECT id, email, id, created_at
FROM user_profiles
WHERE NOT EXISTS (
  SELECT 1 FROM auth_users WHERE auth_users.id = user_profiles.id
)
ON CONFLICT (id) DO NOTHING;

-- Link user_profiles to auth_users
UPDATE user_profiles
SET auth_user_id = id
WHERE auth_user_id IS NULL;

-- Create role assignments for existing users
INSERT INTO auth_role_assignments (user_id, role, assigned_at, is_current)
SELECT id, role, created_at, true
FROM user_profiles
WHERE NOT EXISTS (
  SELECT 1 FROM auth_role_assignments 
  WHERE auth_role_assignments.user_id = user_profiles.id 
  AND auth_role_assignments.is_current = true
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ROW LEVEL SECURITY FOR NEW TABLES
-- ============================================================================

ALTER TABLE site_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_payouts ENABLE ROW LEVEL SECURITY;

-- Site domains: Public read for active domains, admin write
CREATE POLICY "Anyone can view active site domains"
  ON site_domains FOR SELECT
  TO authenticated
  USING (status = 'active');

CREATE POLICY "Admins can manage site domains"
  ON site_domains FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth_role_assignments
      WHERE auth_role_assignments.user_id = auth.uid()
      AND auth_role_assignments.role = 'admin'
      AND auth_role_assignments.is_current = true
    )
  );

-- Auth users: Users can view own profile, admins can view all
CREATE POLICY "Users can view own auth profile"
  ON auth_users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can view all auth users"
  ON auth_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth_role_assignments
      WHERE auth_role_assignments.user_id = auth.uid()
      AND auth_role_assignments.role = 'admin'
      AND auth_role_assignments.is_current = true
    )
  );

-- Auth credentials: Users can view/update own, admins can manage all
CREATE POLICY "Users can view own credentials"
  ON auth_credentials FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own credentials"
  ON auth_credentials FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auth sessions: Users can view own sessions, admins can view all
CREATE POLICY "Users can view own sessions"
  ON auth_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can revoke own sessions"
  ON auth_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Role assignments: Users can view own, admins can manage all
CREATE POLICY "Users can view own role assignments"
  ON auth_role_assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage role assignments"
  ON auth_role_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth_role_assignments
      WHERE auth_role_assignments.user_id = auth.uid()
      AND auth_role_assignments.role = 'admin'
      AND auth_role_assignments.is_current = true
    )
  );

-- Audit log: Users can view own events, admins can view all
CREATE POLICY "Users can view own audit log"
  ON auth_audit_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all audit logs"
  ON auth_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth_role_assignments
      WHERE auth_role_assignments.user_id = auth.uid()
      AND auth_role_assignments.role = 'admin'
      AND auth_role_assignments.is_current = true
    )
  );

-- Vendor payouts: Vendors can view own, admins can manage all
CREATE POLICY "Vendors can view own payouts"
  ON vendor_payouts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = vendor_payouts.vendor_id
      AND vendors.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage vendor payouts"
  ON vendor_payouts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth_role_assignments
      WHERE auth_role_assignments.user_id = auth.uid()
      AND auth_role_assignments.role = 'admin'
      AND auth_role_assignments.is_current = true
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get current user's role from custom auth system
CREATE OR REPLACE FUNCTION get_user_role(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role
  FROM auth_role_assignments
  WHERE user_id = p_user_id
    AND is_current = true
    AND revoked = false
  LIMIT 1;
  
  RETURN COALESCE(v_role, 'guest');
END;
$$;

-- Function to check if vendor can go live
CREATE OR REPLACE FUNCTION check_vendor_can_go_live(p_vendor_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_active_subscription boolean;
  v_has_signed_agreement boolean;
  v_is_approved boolean;
BEGIN
  -- Check if vendor is approved
  SELECT status = 'approved' INTO v_is_approved
  FROM vendors
  WHERE id = p_vendor_id;
  
  -- Check for active subscription
  SELECT EXISTS (
    SELECT 1 FROM vendor_subscriptions
    WHERE vendor_id = p_vendor_id
      AND status = 'active'
      AND billing_period_end > now()
  ) INTO v_has_active_subscription;
  
  -- Check for signed agreement
  SELECT EXISTS (
    SELECT 1 FROM vendor_agreements
    WHERE vendor_id = p_vendor_id
      AND status = 'signed'
  ) INTO v_has_signed_agreement;
  
  RETURN v_is_approved AND v_has_active_subscription AND v_has_signed_agreement;
END;
$$;

-- Function to resolve site from domain
CREATE OR REPLACE FUNCTION resolve_site_from_domain(p_domain text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_site_id uuid;
BEGIN
  SELECT site_id INTO v_site_id
  FROM site_domains
  WHERE domain = p_domain
    AND status = 'active'
  LIMIT 1;
  
  RETURN v_site_id;
END;
$$;

-- Function to check product visibility for a site
CREATE OR REPLACE FUNCTION is_product_visible_on_site(p_product_id uuid, p_site_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enforce_visibility boolean;
  v_is_visible boolean;
BEGIN
  -- Check if product enforces site visibility
  SELECT enforce_site_visibility INTO v_enforce_visibility
  FROM products
  WHERE id = p_product_id;
  
  -- If not enforcing, product is visible everywhere
  IF NOT v_enforce_visibility THEN
    RETURN true;
  END IF;
  
  -- Check site visibility setting
  SELECT COALESCE(visible, false) INTO v_is_visible
  FROM site_product_visibility
  WHERE product_id = p_product_id
    AND site_id = p_site_id;
  
  RETURN COALESCE(v_is_visible, false);
END;
$$;

-- Trigger to update promo usage statistics
CREATE OR REPLACE FUNCTION update_promo_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE promotions
  SET 
    usage_count = usage_count + 1,
    total_discount_given = total_discount_given + NEW.discount_amount,
    total_vendor_cost = total_vendor_cost + NEW.vendor_cost
  WHERE id = NEW.promo_id;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_promo_stats ON promo_usage;
CREATE TRIGGER trigger_update_promo_stats
  AFTER INSERT ON promo_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_promo_stats();
