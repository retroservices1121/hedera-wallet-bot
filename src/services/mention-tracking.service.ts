// ============================================
// NEW FILE: src/services/mention-tracking.service.ts
// Database-backed tracking of processed Twitter mentions
// ============================================

import { Pool } from "pg";
import { logger } from "../utils/logger";

export interface ProcessedMention {
  tweet_id: string;
  author_id: string;
  author_username: string;
  tweet_text?: string;
  processed_at: Date;
  action_taken: string;
}

export class MentionTrackingService {
  constructor(private pool: Pool) {}

  /**
   * Check if a tweet has already been processed
   */
  async isProcessed(tweetId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        "SELECT tweet_id FROM processed_mentions WHERE tweet_id = $1",
        [tweetId]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error({ error, tweetId }, "Failed to check if mention is processed");
      // On error, assume not processed to avoid missing mentions
      return false;
    }
  }

  /**
   * Mark a tweet as processed
   */
  async markAsProcessed(
    tweetId: string,
    authorId: string,
    authorUsername: string,
    actionTaken: string,
    tweetText?: string
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO processed_mentions 
         (tweet_id, author_id, author_username, tweet_text, action_taken, processed_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (tweet_id) DO UPDATE
         SET action_taken = EXCLUDED.action_taken,
             processed_at = NOW()`,
        [tweetId, authorId, authorUsername, tweetText, actionTaken]
      );
      
      logger.debug({ tweetId, authorId, actionTaken }, "Marked mention as processed");
    } catch (error) {
      logger.error({ error, tweetId, authorId }, "Failed to mark mention as processed");
      // Don't throw - this shouldn't block the main flow
    }
  }

  /**
   * Get recent processed mentions for a user
   */
  async getUserRecentMentions(
    authorId: string,
    hoursBack: number = 24
  ): Promise<ProcessedMention[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM processed_mentions
         WHERE author_id = $1
         AND processed_at > NOW() - INTERVAL '${hoursBack} hours'
         ORDER BY processed_at DESC`,
        [authorId]
      );
      return result.rows;
    } catch (error) {
      logger.error({ error, authorId }, "Failed to get user recent mentions");
      return [];
    }
  }

  /**
   * Cleanup old processed mentions (older than 7 days)
   * Should be called periodically
   */
  async cleanup(): Promise<number> {
    try {
      const result = await this.pool.query(
        `DELETE FROM processed_mentions
         WHERE processed_at < NOW() - INTERVAL '7 days'`
      );
      
      const deletedCount = result.rowCount || 0;
      logger.info({ deletedCount }, "Cleaned up old processed mentions");
      return deletedCount;
    } catch (error) {
      logger.error({ error }, "Failed to cleanup old processed mentions");
      return 0;
    }
  }

  /**
   * Get processing stats for monitoring
   */
  async getStats(daysBack: number = 7): Promise<any> {
    try {
      const result = await this.pool.query(
        `SELECT 
          DATE(processed_at) as date,
          action_taken,
          COUNT(*) as count
         FROM processed_mentions
         WHERE processed_at > NOW() - INTERVAL '${daysBack} days'
         GROUP BY DATE(processed_at), action_taken
         ORDER BY date DESC, action_taken`
      );
      return result.rows;
    } catch (error) {
      logger.error({ error }, "Failed to get mention processing stats");
      return [];
    }
  }
}
