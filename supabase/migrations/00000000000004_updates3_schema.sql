-- Migration 00000000000004_updates3_schema.sql
-- Implements Updates 3.0: 8-User Role Schema, NLP PR Tracking, Detailed Status History, Rejection Reasons, and Telematics

-- 1. Status History & State Machine Audit
CREATE TABLE IF NOT EXISTS status_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by VARCHAR(100),
    reason TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_status_history_entity ON status_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_status_history_timestamp ON status_history(timestamp DESC);

-- 2. Purchase Requisitions Enhancements
ALTER TABLE purchase_requisitions 
ADD COLUMN IF NOT EXISTS natural_language_prompt TEXT,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS rejected_by VARCHAR(100),
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS created_by_worker VARCHAR(100) DEFAULT 'Ramesh Patil';

-- 3. Purchase Orders Enhancements
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS rejected_by VARCHAR(100),
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS supplier_response_reason TEXT,
ADD COLUMN IF NOT EXISTS supplier_response_at TIMESTAMPTZ;

-- 4. Shipments & Telematics Enhancements
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS driver_rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS distance_travelled_km NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS distance_remaining_km NUMERIC DEFAULT 0;

-- 5. Quality Checks Enhancements
ALTER TABLE quality_checks
ADD COLUMN IF NOT EXISTS inspection_evidence_url TEXT,
ADD COLUMN IF NOT EXISTS failure_reason TEXT,
ADD COLUMN IF NOT EXISTS defect_classification VARCHAR(50);

-- Enable RLS and public access policies
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'status_history' AND policyname = 'Public status_history access') THEN
        CREATE POLICY "Public status_history access" ON status_history FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
