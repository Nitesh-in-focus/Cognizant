-- Migration 00000000000003_updates2_schema.sql
-- Adds: auth_otp_codes, email_logs, and extends shipments & trucks for TMS/ASN/Driver workflows

-- 1. auth_otp_codes
CREATE TABLE IF NOT EXISTS auth_otp_codes (
    otp_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR NOT NULL,
    otp_code_hash VARCHAR NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempts INT DEFAULT 0,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_otp_email ON auth_otp_codes(email);

-- 2. email_logs
CREATE TABLE IF NOT EXISTS email_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_email VARCHAR NOT NULL,
    recipient_role VARCHAR,
    subject VARCHAR NOT NULL,
    template_name VARCHAR NOT NULL,
    severity VARCHAR DEFAULT 'INFO',
    status VARCHAR DEFAULT 'SENT', -- SENT, FAILED, RETRIED
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_logs_email ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);

-- 3. Extend shipments with ASN, location source, driver assignment & parking slot
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS asn_number VARCHAR;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS location_source VARCHAR DEFAULT 'GPS_TELEMATICS';
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS departure_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS driver_id UUID;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS driver_status VARCHAR DEFAULT 'ACCEPTED';
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS parking_slot VARCHAR;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS priority VARCHAR DEFAULT 'MEDIUM';

-- 4. Extend trucks with driver status & location timestamp
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS driver_status VARCHAR DEFAULT 'ACCEPTED';
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 5. Seed default ASN numbers and priority on existing shipments
UPDATE shipments 
SET asn_number = 'ASN-2026-' || SUBSTRING(shipment_number FROM 10 FOR 4),
    priority = CASE 
        WHEN status = 'DELAYED' THEN 'CRITICAL'
        WHEN status = 'IN_TRANSIT' THEN 'HIGH'
        ELSE 'MEDIUM'
    END,
    location_source = 'GPS_TELEMATICS'
WHERE asn_number IS NULL;
