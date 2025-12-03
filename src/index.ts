import express from "express";
import { config } from "./config";
import { logger } from "./utils/logger";
import { runMigrations } from "./database/migrations";
import { closePool, pool } from "./database";
import { TwitterService } from "./services/twitter.service";
import { WalletService } from "./services/wallet.service";
import { ScheduledDMService } from "./services/scheduled-dm.service";

const app = express();
const walletService = new WalletService();
const twitterService = new TwitterService();
const scheduledDMService = new ScheduledDMService(twitterService, walletService, pool);

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    const walletCount = await walletService.getWalletCount();

    res.json({
      status: "healthy",
      environment: config.environment,
      walletCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, "Health check failed");
    res.status(500).json({ status: "unhealthy" });
  }
});

// Metrics endpoint
app.get("/metrics", async (req, res) => {
  try {
    const total = await walletService.getWalletCount();
    const today = await walletService.getTodayWalletCount();

    res.json({
      totalWallets: total,
      walletsToday: today,
      maxWalletsPerDay: config.maxWalletsPerDay,
      remainingToday: config.maxWalletsPerDay - today,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, "Metrics fetch failed");
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

// Graceful shutdown
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, "Received shutdown signal");

  try {
    await closePool();
    process.exit(0);
  } catch (error) {
    logger.error({ error }, "Error during shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start application
async function start(): Promise<void> {
  try {
    logger.info({ environment: config.environment }, "Starting Hedera Wallet Bot");

    // Run database migrations
    await runMigrations();

    // Initialize Twitter service
    await twitterService.initialize();

    // Set up scheduled DMs (if launch date is configured)
    if (config.launchDate) {
      scheduledDMService.setupCronJobs(config.launchDate);
      logger.info({ launchDate: config.launchDate }, "Scheduled DM cron jobs enabled");
    }

    // Start health check server
    app.listen(config.port, () => {
      logger.info({ port: config.port }, "Health check server started");
    });

    // Start Twitter bot
    await twitterService.start();

    logger.info("✅ Bot is running successfully");
  } catch (error) {
    logger.fatal({ error }, "Failed to start bot");
    process.exit(1);
  }
}

// Run
start();

// Export for testing
export { scheduledDMService, walletService, twitterService };
