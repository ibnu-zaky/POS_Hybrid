-- 009: HR & Staff Management (Phase 2.2)
-- Extend staff + tabel shifts, timesheets, commissions.

BEGIN;

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS hire_date DATE,
  ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20)
    CHECK (employment_type IN ('full_time', 'part_time', 'contract')),
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0
    CHECK (commission_rate >= 0 AND commission_rate <= 1);

CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time),
  CONSTRAINT shifts_merchant_staff_date_unique UNIQUE (merchant_id, staff_id, shift_date)
);

CREATE INDEX IF NOT EXISTS shifts_merchant_date_idx
  ON shifts (merchant_id, shift_date);

CREATE INDEX IF NOT EXISTS shifts_merchant_staff_idx
  ON shifts (merchant_id, staff_id);

CREATE TABLE IF NOT EXISTS timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  clock_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (clock_out IS NULL OR clock_out > clock_in)
);

CREATE UNIQUE INDEX IF NOT EXISTS timesheets_open_per_staff_idx
  ON timesheets (merchant_id, staff_id)
  WHERE clock_out IS NULL;

CREATE INDEX IF NOT EXISTS timesheets_merchant_staff_clock_idx
  ON timesheets (merchant_id, staff_id, clock_in DESC);

CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  period_date DATE NOT NULL,
  base_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commissions_merchant_staff_period_unique UNIQUE (merchant_id, staff_id, period_date)
);

CREATE INDEX IF NOT EXISTS commissions_merchant_period_idx
  ON commissions (merchant_id, period_date DESC);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE shifts FORCE ROW LEVEL SECURITY;
ALTER TABLE timesheets FORCE ROW LEVEL SECURITY;
ALTER TABLE commissions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shifts_isolation ON shifts;
CREATE POLICY shifts_isolation ON shifts
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

DROP POLICY IF EXISTS timesheets_isolation ON timesheets;
CREATE POLICY timesheets_isolation ON timesheets
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

DROP POLICY IF EXISTS commissions_isolation ON commissions;
CREATE POLICY commissions_isolation ON commissions
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE
ON shifts, timesheets, commissions
TO pos_app;

COMMIT;
