-- Migration: Add unique constraint to prevent duplicate wallets
-- File: migrations/005_prevent_duplicate_wallets.sql

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'wallets_twitter_user_id_unique'
    ) THEN
        ALTER TABLE wallets 
        ADD CONSTRAINT wallets_twitter_user_id_unique UNIQUE (twitter_user_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wallets_twitter_user_id ON wallets(twitter_user_id);
