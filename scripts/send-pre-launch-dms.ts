// Manual script to trigger pre-launch reminders

import dotenv from "dotenv";
dotenv.config();

import { pool } from "../src/database";
import { TwitterService } from "../src/services/twitter.service";
import { WalletService } from "../src/services/wallet.service";
import { ScheduledDMService } from "../src/services/scheduled-dm.service";
import { logger } from "../src/utils/logger";

async function sendPreLaunchDMs(): Promise<void> {
  logger.info("Manual trigger: Pre-Launch Reminders");

  try {
    const twitterService = new TwitterService();
    const walletService = new WalletService();
    const scheduledDMService = new ScheduledDMService(twitterService, walletService, pool);

    await twitterService.initialize();

    const launchDate = process.env.LAUNCH_DATE || "April 1, 2024";
    
    logger.info({ launchDate }, "Starting pre-launch DM campaign");
    await scheduledDMService.sendPreLaunchReminders(launchDate);
    
    logger.info("✅ Pre-launch DMs sent successfully!");
  } catch (error) {
    logger.error({ error }, "Failed to send pre-launch DMs");
    process.exit(1);
  } finally {
    await pool.end();
  }
}

sendPreLaunchDMs();
