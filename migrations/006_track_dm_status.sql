-- Migration: Track DM delivery status
-- File: migrations/006_track_dm_status.sql

-- Add columns to track DM delivery
ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS dm1_sent BOOLEAN DEFAULT FALSE;

ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS dm2_sent BOOLEAN DEFAULT FALSE;

ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS dm1_failed_at TIMESTAMP;

ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS claim_link_generated BOOLEAN DEFAULT FALSE;

ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS claim_link_accessed_at TIMESTAMP;

-- Add index
CREATE INDEX IF NOT EXISTS idx_wallets_dm_status ON wallets(dm1_sent, dm2_sent);

-- View for DM delivery stats
CREATE OR REPLACE VIEW dm_delivery_stats AS
SELECT 
  COUNT(*) as total_wallets,
  COUNT(*) FILTER (WHERE dm1_sent = TRUE) as dm1_success,
  COUNT(*) FILTER (WHERE dm1_sent = FALSE) as dm1_failed,
  COUNT(*) FILTER (WHERE dm2_sent = TRUE) as dm2_success,
  COUNT(*) FILTER (WHERE claim_link_generated = TRUE) as claim_links_generated,
  COUNT(*) FILTER (WHERE claim_link_accessed_at IS NOT NULL) as claim_links_accessed,
  ROUND(COUNT(*) FILTER (WHERE dm1_sent = TRUE)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as dm1_success_rate,
  ROUND(COUNT(*) FILTER (WHERE claim_link_accessed_at IS NOT NULL)::numeric / NULLIF(COUNT(*) FILTER (WHERE claim_link_generated = TRUE), 0) * 100, 2) as claim_link_access_rate
FROM wallets;
