// src/services/waitlist.service.ts
import { pool } from "../database";
import { logger } from "../utils/logger";

export class WaitlistService {
  /**
   * Add user to waitlist
   */
  async addToWaitlist(
    twitterUserId: string,
    twitterUsername: string,
    tweetId: string
  ): Promise<{ success: boolean; alreadyOnWaitlist: boolean }> {
    const client = await pool.connect();
    try {
      // Check if already on waitlist
      const existing = await client.query(
        'SELECT id FROM waitlist WHERE twitter_user_id = $1',
        [twitterUserId]
      );

      if (existing.rows.length > 0) {
        logger.info({ twitterUserId, twitterUsername }, "User already on waitlist");
        return { success: true, alreadyOnWaitlist: true };
      }

      // Add to waitlist
      await client.query(
        `INSERT INTO waitlist (twitter_user_id, twitter_username, twitter_handle, source_tweet_id)
         VALUES ($1, $2, $3, $4)`,
        [twitterUserId, twitterUsername, `@${twitterUsername}`, tweetId]
      );

      logger.info({ twitterUserId, twitterUsername }, "✅ Added to waitlist");
      return { success: true, alreadyOnWaitlist: false };
    } catch (error) {
      logger.error({ error, twitterUserId }, "Failed to add to waitlist");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if user is on waitlist
   */
  async isOnWaitlist(twitterUserId: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT id FROM waitlist WHERE twitter_user_id = $1',
        [twitterUserId]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error({ error, twitterUserId }, "Failed to check waitlist status");
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Get waitlist stats
   */
  async getStats(): Promise<any> {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM waitlist_stats');
      return result.rows[0];
    } catch (error) {
      logger.error({ error }, "Failed to get waitlist stats");
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Get all waitlist users (for notifying later)
   */
  async getAllPending(): Promise<any[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT twitter_user_id, twitter_username, twitter_handle, joined_at
         FROM waitlist
         WHERE notified = FALSE
         ORDER BY joined_at ASC`
      );
      return result.rows;
    } catch (error) {
      logger.error({ error }, "Failed to get pending waitlist");
      return [];
    } finally {
      client.release();
    }
  }

  /**
   * Mark user as notified
   */
  async markNotified(twitterUserId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE waitlist 
         SET notified = TRUE, notified_at = NOW()
         WHERE twitter_user_id = $1`,
        [twitterUserId]
      );
      logger.info({ twitterUserId }, "Marked waitlist user as notified");
    } catch (error) {
      logger.error({ error, twitterUserId }, "Failed to mark as notified");
    } finally {
      client.release();
    }
  }
}

export const waitlistService = new WaitlistService();
