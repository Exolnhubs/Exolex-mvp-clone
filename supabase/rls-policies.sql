-- ═══════════════════════════════════════════════════════════════════════════════
-- ExoLex Row Level Security (RLS) Policies
-- Apply these policies in Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 1: Core User Tables
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE lawyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_arms ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- Users Table
-- ─────────────────────────────────────────────────────────────────────────────

-- Users can read their own data
CREATE POLICY "users_select_own" ON users
  FOR SELECT
  USING (auth.uid()::text = id OR auth.uid()::text IN (
    SELECT user_id FROM admins WHERE status = 'active'
  ));

-- Users can update their own data
CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

-- Only admins can insert new users (or through service role)
CREATE POLICY "users_insert_admin" ON users
  FOR INSERT
  WITH CHECK (auth.uid()::text IN (
    SELECT user_id FROM admins WHERE status = 'active'
  ) OR current_setting('role') = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- Members Table
-- ─────────────────────────────────────────────────────────────────────────────

-- Members can only see their own membership
CREATE POLICY "members_select_own" ON members
  FOR SELECT
  USING (user_id = auth.uid()::text);

-- Members can update their own data
CREATE POLICY "members_update_own" ON members
  FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────────────────────
-- Lawyers Table
-- ─────────────────────────────────────────────────────────────────────────────

-- Lawyers can see their own profile
CREATE POLICY "lawyers_select_own" ON lawyers
  FOR SELECT
  USING (user_id = auth.uid()::text);

-- Legal arm admins can see lawyers in their organization
CREATE POLICY "lawyers_select_legal_arm" ON lawyers
  FOR SELECT
  USING (
    legal_arm_id IN (
      SELECT id FROM legal_arms WHERE admin_user_id = auth.uid()::text
    )
  );

-- Lawyers can update their own profile
CREATE POLICY "lawyers_update_own" ON lawyers
  FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Legal arm admins can update lawyers in their organization
CREATE POLICY "lawyers_update_legal_arm" ON lawyers
  FOR UPDATE
  USING (
    legal_arm_id IN (
      SELECT id FROM legal_arms WHERE admin_user_id = auth.uid()::text
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Partners Table
-- ─────────────────────────────────────────────────────────────────────────────

-- Partners can see their own organization
CREATE POLICY "partners_select_own" ON partners
  FOR SELECT
  USING (admin_user_id = auth.uid()::text);

-- Partner employees can see their organization
CREATE POLICY "partners_select_employee" ON partners
  FOR SELECT
  USING (
    id IN (
      SELECT partner_id FROM partner_employees WHERE user_id = auth.uid()::text AND status = 'active'
    )
  );

-- Only partner admins can update
CREATE POLICY "partners_update_admin" ON partners
  FOR UPDATE
  USING (admin_user_id = auth.uid()::text)
  WITH CHECK (admin_user_id = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────────────────────
-- Partner Employees Table
-- ─────────────────────────────────────────────────────────────────────────────

-- Employees can see their own record
CREATE POLICY "partner_employees_select_own" ON partner_employees
  FOR SELECT
  USING (user_id = auth.uid()::text);

-- Partner admins can see all employees in their organization
CREATE POLICY "partner_employees_select_admin" ON partner_employees
  FOR SELECT
  USING (
    partner_id IN (
      SELECT id FROM partners WHERE admin_user_id = auth.uid()::text
    )
  );

-- Partner admins can manage employees
CREATE POLICY "partner_employees_insert_admin" ON partner_employees
  FOR INSERT
  WITH CHECK (
    partner_id IN (
      SELECT id FROM partners WHERE admin_user_id = auth.uid()::text
    )
  );

CREATE POLICY "partner_employees_update_admin" ON partner_employees
  FOR UPDATE
  USING (
    partner_id IN (
      SELECT id FROM partners WHERE admin_user_id = auth.uid()::text
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 2: Service Requests & Cases
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_offers ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- Service Requests Table
-- ─────────────────────────────────────────────────────────────────────────────

-- Members can see their own requests
CREATE POLICY "service_requests_select_member" ON service_requests
  FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()::text
    )
  );

-- Assigned lawyers can see requests assigned to them
CREATE POLICY "service_requests_select_lawyer" ON service_requests
  FOR SELECT
  USING (
    assigned_lawyer_id IN (
      SELECT id FROM lawyers WHERE user_id = auth.uid()::text
    )
  );

-- Legal arm can see requests assigned to their organization
CREATE POLICY "service_requests_select_legal_arm" ON service_requests
  FOR SELECT
  USING (
    legal_arm_id IN (
      SELECT id FROM legal_arms WHERE admin_user_id = auth.uid()::text
    )
    OR
    legal_arm_id IN (
      SELECT legal_arm_id FROM lawyers WHERE user_id = auth.uid()::text
    )
  );

-- Partners can see requests they're handling
CREATE POLICY "service_requests_select_partner" ON service_requests
  FOR SELECT
  USING (
    partner_id IN (
      SELECT id FROM partners WHERE admin_user_id = auth.uid()::text
    )
    OR
    partner_id IN (
      SELECT partner_id FROM partner_employees WHERE user_id = auth.uid()::text AND status = 'active'
    )
  );

-- Members can create requests
CREATE POLICY "service_requests_insert_member" ON service_requests
  FOR INSERT
  WITH CHECK (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()::text
    )
  );

-- Assigned parties can update requests
CREATE POLICY "service_requests_update_assigned" ON service_requests
  FOR UPDATE
  USING (
    assigned_lawyer_id IN (SELECT id FROM lawyers WHERE user_id = auth.uid()::text)
    OR legal_arm_id IN (SELECT id FROM legal_arms WHERE admin_user_id = auth.uid()::text)
    OR partner_id IN (SELECT id FROM partners WHERE admin_user_id = auth.uid()::text)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Service Offers (Quotes) Table
-- ─────────────────────────────────────────────────────────────────────────────

-- Members can see offers for their requests
CREATE POLICY "service_offers_select_member" ON service_offers
  FOR SELECT
  USING (
    service_request_id IN (
      SELECT sr.id FROM service_requests sr
      JOIN members m ON sr.member_id = m.id
      WHERE m.user_id = auth.uid()::text
    )
  );

-- Lawyers can see their own offers
CREATE POLICY "service_offers_select_lawyer" ON service_offers
  FOR SELECT
  USING (
    lawyer_id IN (
      SELECT id FROM lawyers WHERE user_id = auth.uid()::text
    )
  );

-- Lawyers can create offers
CREATE POLICY "service_offers_insert_lawyer" ON service_offers
  FOR INSERT
  WITH CHECK (
    lawyer_id IN (
      SELECT id FROM lawyers WHERE user_id = auth.uid()::text
    )
  );

-- Lawyers can update their own offers
CREATE POLICY "service_offers_update_lawyer" ON service_offers
  FOR UPDATE
  USING (
    lawyer_id IN (
      SELECT id FROM lawyers WHERE user_id = auth.uid()::text
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 3: Subscriptions & Financial Data
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Members can see their own subscriptions
CREATE POLICY "subscriptions_select_member" ON subscriptions
  FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()::text
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 4: OTP & Authentication (Sensitive)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;

-- OTP table should only be accessible via service role
-- No user-level access
CREATE POLICY "otp_service_only" ON otp_verifications
  FOR ALL
  USING (current_setting('role') = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 5: Reference Tables (Public Read)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_roles ENABLE ROW LEVEL SECURITY;

-- Public read access for reference tables
CREATE POLICY "categories_public_read" ON categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "packages_public_read" ON packages
  FOR SELECT USING (is_active = true);

CREATE POLICY "extra_services_public_read" ON extra_services
  FOR SELECT USING (is_active = true);

CREATE POLICY "ref_roles_public_read" ON ref_roles
  FOR SELECT USING (is_active = true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 6: Organization-Specific Tables
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE partner_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_arm_roles ENABLE ROW LEVEL SECURITY;

-- Partner roles - visible to partner organization
CREATE POLICY "partner_roles_select" ON partner_roles
  FOR SELECT
  USING (
    partner_id IN (
      SELECT id FROM partners WHERE admin_user_id = auth.uid()::text
    )
    OR
    partner_id IN (
      SELECT partner_id FROM partner_employees WHERE user_id = auth.uid()::text AND status = 'active'
    )
  );

-- Partner admins can manage roles
CREATE POLICY "partner_roles_manage" ON partner_roles
  FOR ALL
  USING (
    partner_id IN (
      SELECT id FROM partners WHERE admin_user_id = auth.uid()::text
    )
  );

-- Partner permissions - public read (reference data)
CREATE POLICY "partner_permissions_read" ON partner_permissions
  FOR SELECT USING (true);

-- Legal arm roles
CREATE POLICY "legal_arm_roles_select" ON legal_arm_roles
  FOR SELECT
  USING (
    legal_arm_id IN (
      SELECT id FROM legal_arms WHERE admin_user_id = auth.uid()::text
    )
    OR
    legal_arm_id IN (
      SELECT legal_arm_id FROM lawyers WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "legal_arm_roles_manage" ON legal_arm_roles
  FOR ALL
  USING (
    legal_arm_id IN (
      SELECT id FROM legal_arms WHERE admin_user_id = auth.uid()::text
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Function to check if current user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins
    WHERE user_id = auth.uid()::text
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's partner_id
CREATE OR REPLACE FUNCTION get_user_partner_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT partner_id FROM partner_employees
    WHERE user_id = auth.uid()::text
    AND status = 'active'
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's legal_arm_id
CREATE OR REPLACE FUNCTION get_user_legal_arm_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT legal_arm_id FROM lawyers
    WHERE user_id = auth.uid()::text
    AND status = 'active'
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- NOTES FOR IMPLEMENTATION
-- ═══════════════════════════════════════════════════════════════════════════════
/*
1. Before applying these policies:
   - Backup your database
   - Test in a staging environment first
   - Ensure all existing queries still work

2. After applying:
   - Update API routes to use Supabase Auth
   - Remove localStorage-based auth
   - Test all CRUD operations for each user role

3. For service_role access (bypasses RLS):
   - Use for admin operations
   - Use for system processes (cron jobs, triggers)
   - Never expose service_role key to client

4. Performance considerations:
   - Add indexes on frequently filtered columns
   - Monitor query performance after RLS is enabled
   - Consider using materialized views for complex queries
*/
