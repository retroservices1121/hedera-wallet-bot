import { pool } from "./index";
import { logger } from "../utils/logger";

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    logger.info("Running database migrations...");
    
    await client.query(`
      -- Main wallets table
      CREATE TABLE IF NOT EXISTS wallets (
        id SERIAL PRIMARY KEY,
        twitter_user_id VARCHAR(255) UNIQUE NOT NULL,
        twitter_username VARCHAR(255) NOT NULL,
        private_key_encrypted TEXT NOT NULL,
        public_key TEXT NOT NULL,
        account_alias TEXT NOT NULL,
        evm_address TEXT,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        activated BOOLEAN DEFAULT FALSE,
        activation_tx_id TEXT,
        last_dm_sent_at TIMESTAMP,
        pre_launch_dm_sent_at TIMESTAMP,
        launch_dm_sent_at TIMESTAMP,
        post_launch_dm_sent_at TIMESTAMP,
        CONSTRAINT unique_twitter_user UNIQUE(twitter_user_id)
      );

      -- Add new columns for wallet tracking and on-chain accounts
      ALTER TABLE wallets 
      ADD COLUMN IF NOT EXISTS account_id VARCHAR(50);
      
      ALTER TABLE wallets 
      ADD COLUMN IF NOT EXISTS last_balance_check TIMESTAMP;
      
      ALTER TABLE wallets 
      ADD COLUMN IF NOT EXISTS current_balance DECIMAL(20, 8) DEFAULT 0;
      
      ALTER TABLE wallets 
      ADD COLUMN IF NOT EXISTS is_funded BOOLEAN DEFAULT FALSE;
      
      ALTER TABLE wallets 
      ADD COLUMN IF NOT EXISTS airdrop_sent BOOLEAN DEFAULT FALSE;
      
      ALTER TABLE wallets 
      ADD COLUMN IF NOT EXISTS airdrop_sent_at TIMESTAMP;

      -- Indexes for wallets
      CREATE INDEX IF NOT EXISTS idx_twitter_user_id ON wallets(twitter_user_id);
      CREATE INDEX IF NOT EXISTS idx_created_at ON wallets(created_at);
      CREATE INDEX IF NOT EXISTS idx_activated ON wallets(activated);
      CREATE INDEX IF NOT EXISTS idx_account_alias ON wallets(account_alias);
      CREATE INDEX IF NOT EXISTS idx_account_id ON wallets(account_id);
      CREATE INDEX IF NOT EXISTS idx_is_funded ON wallets(is_funded);
      CREATE INDEX IF NOT EXISTS idx_airdrop_sent ON wallets(airdrop_sent);

      -- Rate limits table
      CREATE TABLE IF NOT EXISTS rate_limits (
        id SERIAL PRIMARY KEY,
        ip_address INET,
        twitter_user_id VARCHAR(255),
        action VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT rate_limit_check CHECK (ip_address IS NOT NULL OR twitter_user_id IS NOT NULL)
      );
      
      CREATE INDEX IF NOT EXISTS idx_rate_limits_user ON rate_limits(twitter_user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON rate_limits(ip_address, created_at);

      -- Audit log table
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        twitter_user_id VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        details JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(twitter_user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

      -- Scheduled DMs log
      CREATE TABLE IF NOT EXISTS scheduled_dms_log (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        username VARCHAR(255),
        sent_at TIMESTAMP,
        type VARCHAR(50),
        success BOOLEAN DEFAULT true
      );
      
      CREATE INDEX IF NOT EXISTS idx_scheduled_dms_user ON scheduled_dms_log(user_id);

      -- DM interactions
      CREATE TABLE IF NOT EXISTS dm_interactions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        username VARCHAR(255),
        message TEXT,
        response_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_dm_interactions_user ON dm_interactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_dm_interactions_created ON dm_interactions(created_at);

      -- Wallet statistics view
      CREATE OR REPLACE VIEW wallet_stats AS
      SELECT 
        COUNT(*) as total_wallets,
        COUNT(*) FILTER (WHERE is_funded = TRUE) as funded_wallets,
        COUNT(*) FILTER (WHERE is_funded = FALSE) as unfunded_wallets,
        COUNT(*) FILTER (WHERE airdrop_sent = TRUE) as airdropped_wallets,
        COUNT(*) FILTER (WHERE is_funded = TRUE AND airdrop_sent = FALSE) as ready_for_airdrop,
        COALESCE(SUM(current_balance), 0) as total_balance_hbar,
        MAX(last_balance_check) as last_check_time
      FROM wallets;
    `);

    logger.info("Database migrations completed successfully");
  } catch (error) {
    logger.error({ error }, "Failed to run migrations");
    throw error;
  } finally {
    client.release();
  }
}
