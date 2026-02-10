-- Dues Accountant - Supabase (PostgreSQL) Schema
-- Run this in Supabase SQL Editor to create all tables for MongoDB → Supabase migration.
-- Enable UUID extension (usually already on in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- MASTER TABLES (shared across all tenants)
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'rejected', 'archived')),
  member_id_counter INTEGER NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  config JSONB DEFAULT '{}',
  contact JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('system', 'super', 'admin')),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  password_reset_token TEXT,
  password_reset_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- =============================================================================
-- TENANT-SCOPED TABLES (all include tenant_id)
-- =============================================================================

CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  member_id TEXT,
  subgroup_id UUID,
  contact TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  dues_per_month NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (dues_per_month >= 0),
  total_paid NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_paid >= 0),
  months_covered INTEGER NOT NULL DEFAULT 0 CHECK (months_covered >= 0),
  arrears INTEGER NOT NULL DEFAULT 0 CHECK (arrears >= 0),
  last_payment_date DATE,
  is_auto_generated_id BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_members_tenant ON members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_members_tenant_member_id ON members(tenant_id, member_id);

CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  months_covered INTEGER NOT NULL,
  recorded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_history_member ON payment_history(member_id);

CREATE TABLE IF NOT EXISTS subgroups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  leader_id UUID NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subgroups_tenant ON subgroups(tenant_id);

-- Add member -> subgroup FK after subgroups exist (avoids circular dependency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_members_subgroup'
  ) THEN
    ALTER TABLE members ADD CONSTRAINT fk_members_subgroup
      FOREIGN KEY (subgroup_id) REFERENCES subgroups(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_subgroups_leader'
  ) THEN
    ALTER TABLE subgroups ADD CONSTRAINT fk_subgroups_leader
      FOREIGN KEY (leader_id) REFERENCES members(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS contribution_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contribution_types_tenant ON contribution_types(tenant_id);

CREATE TABLE IF NOT EXISTS expenditures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  expense_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  category TEXT,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  spent_by TEXT NOT NULL,
  funded_by_contribution_type_id UUID REFERENCES contribution_types(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, expense_id)
);

CREATE INDEX IF NOT EXISTS idx_expenditures_tenant ON expenditures(tenant_id);

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  receipt_id TEXT NOT NULL,
  receipt_type TEXT NOT NULL DEFAULT 'dues' CHECK (receipt_type IN ('dues', 'contribution')),
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  member_name TEXT DEFAULT '',
  amount NUMERIC(12,2) NOT NULL,
  dues_per_month NUMERIC(12,2),
  months_covered INTEGER,
  payment_date TIMESTAMPTZ NOT NULL,
  recorded_by TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  remarks TEXT DEFAULT '',
  payment_id UUID,
  contribution_id UUID,
  contribution_type_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, receipt_id)
);

CREATE INDEX IF NOT EXISTS idx_receipts_tenant ON receipts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receipts_member ON receipts(member_id);

CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  amount_owed NUMERIC(12,2) NOT NULL,
  months_in_arrears INTEGER NOT NULL,
  scripture_ref TEXT,
  scripture_text TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error TEXT,
  triggered_by TEXT NOT NULL DEFAULT 'system' CHECK (triggered_by IN ('system', 'manual')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminders_tenant ON reminders(tenant_id);

CREATE TABLE IF NOT EXISTS contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contribution_type_id UUID NOT NULL REFERENCES contribution_types(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by TEXT NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  remarks TEXT DEFAULT '',
  receipt_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contributions_tenant ON contributions(tenant_id);

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('system', 'super', 'admin')),
  action TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  affected_member UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant ON activity_logs(tenant_id);

-- Optional: Row Level Security (RLS) - enable if using Supabase Auth + anon key
-- ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- (Then add policies per table. For service-role key, RLS is bypassed.)
