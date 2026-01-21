-- Migration: 010 - Create Quarantine Table with RLS
-- Description: Creates table for quarantined data records with proper security policies
-- Replaces insecure dynamic SQL creation

CREATE TABLE IF NOT EXISTS quarantined_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE, -- Critical for multitenancy
  record_id TEXT NOT NULL,
  gate_id TEXT NOT NULL,
  record JSONB NOT NULL,
  rejection_reason TEXT NOT NULL,
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  quarantined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by TEXT, -- Could be a UUID reference to profiles if strict integrity needed
  resolution TEXT CHECK (resolution IN ('approved', 'rejected', 'fixed', 'pending')),
  fixed_record JSONB,
  notes TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  context JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quarantined_records_agency ON quarantined_records(agency_id);
CREATE INDEX IF NOT EXISTS idx_quarantined_records_gate_id ON quarantined_records(gate_id);
CREATE INDEX IF NOT EXISTS idx_quarantined_records_priority ON quarantined_records(priority);
CREATE INDEX IF NOT EXISTS idx_quarantined_records_resolution ON quarantined_records(resolution);
CREATE INDEX IF NOT EXISTS idx_quarantined_records_quarantined_at ON quarantined_records(quarantined_at);

-- Enable RLS
ALTER TABLE quarantined_records ENABLE ROW LEVEL SECURITY;

-- Policies

-- Admins can view all records (or just their agency's if they are agency admins)
-- Assuming auth.is_admin() implies super-admin. 
-- If agency admin, they should use auth.belongs_to_agency(agency_id).

-- Policy: Users can view quarantined records for their agency
CREATE POLICY "Users can view agency quarantined records" ON quarantined_records
  FOR SELECT USING (
    auth.belongs_to_agency(agency_id) OR auth.is_admin()
  );

-- Policy: Authorized users (admins/managers) can update records
CREATE POLICY "Managers can update agency quarantined records" ON quarantined_records
  FOR UPDATE USING (
    (auth.belongs_to_agency(agency_id) AND (
      SELECT role IN ('admin', 'manager') FROM profiles WHERE id = auth.uid()
    )) OR auth.is_admin()
  );

-- Policy: System can insert records (usually via service role or triggers)
-- But if inserted by user action, they must belong to agency
CREATE POLICY "Users can insert agency quarantined records" ON quarantined_records
  FOR INSERT WITH CHECK (
    auth.belongs_to_agency(agency_id) OR auth.is_admin()
  );

-- Trigger for updated_at
CREATE TRIGGER update_quarantined_records_updated_at BEFORE UPDATE ON quarantined_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
