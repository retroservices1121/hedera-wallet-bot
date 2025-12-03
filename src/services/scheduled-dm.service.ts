// ============================================
// src/services/scheduled-dm.service.ts
// Scheduled DM Campaigns
// ============================================

import { Pool } from "pg";
import cron from "node-cron";
import { TwitterService } from "./twitter.service";
import { WalletService } from "./wallet.service";
import { dmTemplates } from "../utils/dm-templates";
import { logger } from "../utils/logger";

export class ScheduledDMService {
  private twitterService: TwitterService;
  private walletService: WalletService;
  private pool: Pool;

  constructor(twitterService: TwitterService, walletService: WalletService, pool: Pool) {
    this.twitterService = twitterService;
    this.walletService = walletService;
    this.pool = pool;
  }

  /**
   * Send pre-launch reminder to all users
   * Call this 7 days before launch
   */
  async sendPreLaunchReminders(launchDate: string): Promise<void> {
    logger.info("Starting pre-launch DM campaign");

    try {
      // Get all users who have wallets but haven't received pre-launch DM
      const result = await this.pool.query(`
        SELECT twitter_user_id, twitter_username
        FROM wallets
        WHERE activated = false
        AND pre_launch_dm_sent_at IS NULL
        ORDER BY created_at ASC
      `);

      const users = result.rows;
      logger.info({ count: users.length }, "Found users for pre-launch DMs");

      // Send in batches to avoid rate limits
      const batchSize = 50;
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);

        for (const user of batch) {
          const message = dmTemplates.preLaunchReminder(
            user.twitter_username,
            launchDate
          );

          try {
            await this.twitterService.sendDM(user.twitter_user_id, message);
            await this.walletService.markPreLaunchDMSent(user.twitter_user_id);
            logger.info({ userId: user.twitter_user_id }, "Pre-launch DM sent");

            // Rate limit: 1 DM per second
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (error) {
            logger.error({ error, userId: user.twitter_user_id }, "Failed to send pre-launch DM");
          }
        }

        // Longer delay between batches (30 seconds)
        if (i + batchSize < users.length) {
          logger.info("Pausing between batches (30 seconds)");
          await new Promise((resolve) => setTimeout(resolve, 30000));
        }
      }

      logger.info("Pre-launch DM campaign completed");
    } catch (error) {
      logger.error({ error }, "Pre-launch DM campaign failed");
      throw error;
    }
  }

  /**
   * Send launch day DMs with airdrop confirmation
   * Call this after airdrops are sent
   */
  async sendLaunchDayDMs(airdropAmount: number): Promise<void> {
    logger.info("Starting launch day DM campaign");

    try {
      // Get all users who received airdrop but haven't got launch DM
      const result = await this.pool.query(`
        SELECT 
          twitter_user_id, 
          twitter_username, 
          account_alias,
          activation_tx_id
        FROM wallets
        WHERE activated = true
        AND launch_dm_sent_at IS NULL
        ORDER BY created_at ASC
      `);

      const users = result.rows;
      logger.info({ count: users.length }, "Found users for launch DMs");

      for (const user of users) {
        // Extract account ID from activation or use placeholder
        const accountId = user.activation_tx_id
          ? user.activation_tx_id
          : "Check HashPack";

        const message = dmTemplates.launchDay(
          user.twitter_username,
          airdropAmount,
          accountId
        );

        try {
          await this.twitterService.sendDM(user.twitter_user_id, message);
          await this.walletService.markLaunchDMSent(user.twitter_user_id);
          logger.info({ userId: user.twitter_user_id }, "Launch DM sent");

          // Rate limit: 1 DM per second
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          logger.error({ error, userId: user.twitter_user_id }, "Failed to send launch DM");
        }
      }

      logger.info("Launch day DM campaign completed");
    } catch (error) {
      logger.error({ error }, "Launch day DM campaign failed");
      throw error;
    }
  }

  /**
   * Set up automated cron jobs for recurring DMs
   * Runs daily at 10 AM and checks if conditions are met
   */
  setupCronJobs(launchDate: Date): void {
    logger.info("Setting up cron jobs for scheduled DMs");

    // Job 1: Check daily if it's 7 days before launch
    cron.schedule("0 10 * * *", async () => {
      // Runs daily at 10 AM
      const now = new Date();
      const daysUntilLaunch = Math.ceil(
        (launchDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilLaunch === 7) {
        logger.info("Triggering pre-launch DM campaign (7 days before)");
        try {
          await this.sendPreLaunchReminders(launchDate.toLocaleDateString());
        } catch (error) {
          logger.error({ error }, "Cron job failed: pre-launch reminders");
        }
      }

      // Also check for 3 days before
      if (daysUntilLaunch === 3) {
        logger.info("Triggering 3-day reminder");
        try {
          await this.sendPreLaunchReminders(
            `${launchDate.toLocaleDateString()} - ONLY 3 DAYS!`
          );
        } catch (error) {
          logger.error({ error }, "Cron job failed: 3-day reminder");
        }
      }
    });

    logger.info("Cron jobs configured successfully");
  }

  /**
   * Schedule a custom DM to be sent at a specific time
   */
  async scheduleDM(
    userId: string,
    username: string,
    message: string,
    sendAt: Date
  ): Promise<void> {
    const delay = sendAt.getTime() - Date.now();

    if (delay <= 0) {
      // Send immediately if time has passed
      await this.twitterService.sendDM(userId, message);
      return;
    }

    // Schedule for future
    setTimeout(async () => {
      try {
        await this.twitterService.sendDM(userId, message);
        logger.info({ userId, username }, "Scheduled DM sent successfully");

        // Log to database
        await this.pool.query(
          `INSERT INTO scheduled_dms_log (user_id, username, sent_at, type)
           VALUES ($1, $2, NOW(), $3)`,
          [userId, username, "scheduled"]
        );
      } catch (error) {
        logger.error({ error, userId }, "Failed to send scheduled DM");
      }
    }, delay);

    logger.info({ userId, username, sendAt }, "DM scheduled");
  }
}

export default ScheduledDMService;
