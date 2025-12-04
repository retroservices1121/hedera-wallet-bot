```sql
-- Migration: Add wallet tracking columns for airdrops

ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS last_balance_check TIMESTAMP,
ADD COLUMN IF NOT EXISTS current_balance DECIMAL(20, 8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_funded BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS airdrop_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS airdrop_sent_at TIMESTAMP;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_wallets_is_funded ON wallets(is_funded);
CREATE INDEX IF NOT EXISTS idx_wallets_airdrop_sent ON wallets(airdrop_sent);

-- Create view for statistics
CREATE OR REPLACE VIEW wallet_stats AS
SELECT 
  COUNT(*) as total_wallets,
  COUNT(*) FILTER (WHERE is_funded = TRUE) as funded_wallets,
  COUNT(*) FILTER (WHERE is_funded = FALSE) as unfunded_wallets,
  COUNT(*) FILTER (WHERE airdrop_sent = TRUE) as airdropped_wallets,
  COALESCE(SUM(current_balance), 0) as total_balance_hbar
FROM wallets;
```
