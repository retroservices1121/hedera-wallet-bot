// Manual script to trigger launch DMs

import dotenv from "dotenv";
dotenv.config();

import { pool } from "../src/database";
import { TwitterService } from "../src/services/twitter.service";
import { WalletService } from "../src/services/wallet.service";
import { ScheduledDMService } from "../src/services/scheduled-dm.service";
import { logger } from "../src/utils/logger";

async function sendLaunchDMs(): Promise<void> {
  logger.info("Manual trigger: Launch Day DMs");

  try {
    const twitterService = new TwitterService();
    const walletService = new WalletService();
    const scheduledDMService = new ScheduledDMService(twitterService, walletService, pool);

    await twitterService.initialize();

    const airdropAmount = parseFloat(process.env.AIRDROP_AMOUNT || "5");
    
    logger.info({ airdropAmount }, "Starting launch DM campaign");
    await scheduledDMService.sendLaunchDayDMs(airdropAmount);
    
    logger.info("✅ Launch DMs sent successfully!");
  } catch (error) {
    logger.error({ error }, "Failed to send launch DMs");
    process.exit(1);
  } finally {
    await pool.end();
  }
}

sendLaunchDMs();
