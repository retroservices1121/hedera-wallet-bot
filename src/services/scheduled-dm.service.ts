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
   */
  async sendPreLaunchReminders(launchDate: string): Promise<void> {
    logger.info("Starting pre-launch DM campaign");

    try {
      const result = await this.pool.query(`
        SELECT twitter_user_id, twitter_username
        FROM wallets
        WHERE activated = false
        AND pre_launch_dm_sent_at IS NULL
        ORDER BY created_at ASC
      `);

      const users = result.rows;
      logger.info({ count: users.length }, "Found users for pre-launch DMs");

      for (const user of users) {
        const message = dmTemplates.preLaunchReminder(user.twitter_username, launchDate);

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

      logger.info("Pre-launch DM campaign completed");
    } catch (error) {
      logger.error({ error }, "Pre-launch DM campaign failed");
      throw error;
    }
  }

  /**
   * Send launch day DMs with airdrop confirmation
   */
  async sendLaunchDayDMs(airdropAmount: number): Promise<void> {
    logger.info("Starting launch day DM campaign");

    try {
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
        const accountId = user.activation_tx_id || "Check HashPack";
        const message = dmTemplates.launchDay(user.twitter_username, airdropAmount, accountId);

        try {
          await this.twitterService.sendDM(user.twitter_user_id, message);
          await this.walletService.markLaunchDMSent(user.twitter_user_id);
          logger.info({ userId: user.twitter_user_id }, "Launch DM sent");

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
   */
  setupCronJobs(launchDate: Date): void {
    logger.info("Setting up cron jobs for scheduled DMs");

    // Send pre-launch reminders 7 days before launch
    cron.schedule("0 10 * * *", async () => {
      const now = new Date();
      const daysUntilLaunch = Math.ceil(
        (launchDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilLaunch === 7) {
        logger.info("Triggering pre-launch DM campaign (7 days before)");
        await this.sendPreLaunchReminders(launchDate.toLocaleDateString());
      }
    });

    logger.info("Cron jobs configured successfully");
  }
}
