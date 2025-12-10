-- ============================================
-- Migration: 007_processed_mentions_tracking.sql
-- Tracks processed Twitter mentions to prevent duplicates
-- ============================================

-- Create table for tracking processed mentions
CREATE TABLE IF NOT EXISTS processed_mentions (
    tweet_id VARCHAR(50) PRIMARY KEY,
    author_id VARCHAR(50) NOT NULL,
    author_username VARCHAR(255) NOT NULL,
    tweet_text TEXT,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action_taken VARCHAR(50), -- 'wallet_created', 'already_has_wallet', 'not_following', 'rate_limited', 'error'
    INDEX idx_author_id (author_id),
    INDEX idx_processed_at (processed_at)
);

-- Create cleanup function to delete old processed mentions (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_processed_mentions()
RETURNS void AS $$
BEGIN
    DELETE FROM processed_mentions
    WHERE processed_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a view for monitoring mention processing stats
CREATE OR REPLACE VIEW mention_processing_stats AS
SELECT 
    DATE(processed_at) as date,
    action_taken,
    COUNT(*) as count
FROM processed_mentions
WHERE processed_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(processed_at), action_taken
ORDER BY date DESC, action_taken;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tweet_id_processed_at ON processed_mentions(tweet_id, processed_at);

COMMENT ON TABLE processed_mentions IS 'Tracks all processed Twitter mentions to prevent duplicate processing';
COMMENT ON COLUMN processed_mentions.action_taken IS 'What action was taken: wallet_created, already_has_wallet, not_following, rate_limited, error';
