```sql
-- Migration: Add account_id column for on-chain accounts

-- Add account_id column to wallets table
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS account_id VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_wallets_account_id ON wallets(account_id);
```
