-- Migration 00000000000002_updates1_schema.sql
-- Adds: quality_checks, quality_check_items, supplier_performance, supplier_score_history, ai_recommendations, audit_logs

-- 1. quality_checks
CREATE TABLE IF NOT EXISTS quality_checks (
    quality_check_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
    po_id UUID NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    shipment_id UUID REFERENCES shipments(shipment_id) ON DELETE SET NULL,
    grn_id UUID REFERENCES goods_receipts(grn_id) ON DELETE SET NULL,
    warehouse_id UUID REFERENCES warehouses(warehouse_id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(product_id) ON DELETE SET NULL,
    inspector_id UUID,
    inspection_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expected_quantity DECIMAL(12,2) DEFAULT 0,
    received_quantity DECIMAL(12,2) DEFAULT 0,
    accepted_quantity DECIMAL(12,2) DEFAULT 0,
    rejected_quantity DECIMAL(12,2) DEFAULT 0,
    damaged_quantity DECIMAL(12,2) DEFAULT 0,
    product_quality_score DECIMAL(5,2) DEFAULT 40, -- Max 40
    quantity_accuracy_score DECIMAL(5,2) DEFAULT 20, -- Max 20
    packaging_score DECIMAL(5,2) DEFAULT 15, -- Max 15
    documentation_score DECIMAL(5,2) DEFAULT 10, -- Max 10
    delivery_condition_score DECIMAL(5,2) DEFAULT 15, -- Max 15
    overall_score DECIMAL(5,2) DEFAULT 100, -- 0-100
    defect_rate DECIMAL(5,2) DEFAULT 0,
    status VARCHAR DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, PASSED, PASSED_WITH_ISSUES, FAILED, FINALIZED
    remarks TEXT,
    evidence_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    finalized_at TIMESTAMP WITH TIME ZONE
);

-- 2. quality_check_items
CREATE TABLE IF NOT EXISTS quality_check_items (
    qc_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quality_check_id UUID NOT NULL REFERENCES quality_checks(quality_check_id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    inspected_quantity DECIMAL(12,2) DEFAULT 0,
    accepted_quantity DECIMAL(12,2) DEFAULT 0,
    rejected_quantity DECIMAL(12,2) DEFAULT 0,
    defect_category VARCHAR,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. supplier_performance
CREATE TABLE IF NOT EXISTS supplier_performance (
    supplier_performance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL UNIQUE REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
    quality_score DECIMAL(5,2) DEFAULT 90, -- 35%
    delivery_score DECIMAL(5,2) DEFAULT 90, -- 25%
    quantity_accuracy_score DECIMAL(5,2) DEFAULT 95, -- 15%
    invoice_accuracy_score DECIMAL(5,2) DEFAULT 95, -- 10%
    responsiveness_score DECIMAL(5,2) DEFAULT 90, -- 10%
    reliability_score DECIMAL(5,2) DEFAULT 95, -- 5%
    overall_score DECIMAL(5,2) DEFAULT 92, -- 100%
    sample_size INTEGER DEFAULT 1,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. supplier_score_history
CREATE TABLE IF NOT EXISTS supplier_score_history (
    history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
    previous_score DECIMAL(5,2) NOT NULL,
    new_score DECIMAL(5,2) NOT NULL,
    change DECIMAL(5,2) NOT NULL,
    reason TEXT NOT NULL,
    source_quality_check_id UUID REFERENCES quality_checks(quality_check_id) ON DELETE SET NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. ai_recommendations
CREATE TABLE IF NOT EXISTS ai_recommendations (
    ai_recommendation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recommendation_type VARCHAR NOT NULL, -- SUPPLIER_SELECTION, ETA, DOCK_ASSIGNMENT, SHIPMENT_PRIORITY, QUALITY_ANALYSIS
    entity_type VARCHAR NOT NULL,
    entity_id VARCHAR NOT NULL,
    model_name VARCHAR DEFAULT 'gemini-1.5-pro',
    recommendation JSONB NOT NULL,
    confidence DECIMAL(5,2) DEFAULT 85,
    reasoning_summary TEXT,
    input_snapshot JSONB,
    human_decision VARCHAR DEFAULT 'PENDING', -- ACCEPTED, OVERRIDDEN, REJECTED, PENDING
    decided_by UUID,
    decided_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    user_name VARCHAR,
    user_role VARCHAR NOT NULL,
    action VARCHAR NOT NULL,
    entity_type VARCHAR NOT NULL,
    entity_id VARCHAR NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    reason TEXT,
    is_emergency_override BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance & isolation
CREATE INDEX IF NOT EXISTS idx_qc_supplier ON quality_checks(supplier_id);
CREATE INDEX IF NOT EXISTS idx_qc_po ON quality_checks(po_id);
CREATE INDEX IF NOT EXISTS idx_qc_status ON quality_checks(status);
CREATE INDEX IF NOT EXISTS idx_sp_supplier ON supplier_performance(supplier_id);
CREATE INDEX IF NOT EXISTS idx_ssh_supplier ON supplier_score_history(supplier_id);
CREATE INDEX IF NOT EXISTS idx_ai_type ON ai_recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
