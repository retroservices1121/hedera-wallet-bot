// ============================================
// UPDATED: src/index.ts
// Added wallet tracking and airdrop services
// ============================================
import express from "express";
import cron from "node-cron";
import { config } from "./config";
import { logger } from "./utils/logger";
import { runMigrations } from "./database/migrations";
import { closePool, pool } from "./database";
import { TwitterService } from "./services/twitter.service";
import { WalletService } from "./services/wallet.service";
import { ScheduledDMService } from "./services/scheduled-dm.service";
import { WalletTrackingService } from "./services/wallet-tracking.service";
import { AirdropService } from "./services/airdrop.service";

const app = express();
const walletService = new WalletService();
const twitterService = new TwitterService();
const scheduledDMService = new ScheduledDMService(twitterService, walletService, pool);

// Initialize wallet tracking and airdrop services
let walletTracker: WalletTrackingService | null = null;
let airdropService: AirdropService | null = null;

// Health check endpoint
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    const walletCount = await walletService.getWalletCount();
    
    // Add wallet tracking stats if available
    let trackingStats = null;
    if (walletTracker) {
      try {
        trackingStats = await walletTracker.getWalletStats();
      } catch (error) {
        logger.error({ error }, "Failed to get tracking stats");
      }
    }
    
    res.json({
      status: "healthy",
      environment: config.environment,
      walletCount,
      trackingStats,
      operatorConfigured: !!(config.operatorAccountId && config.operatorPrivateKey),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, "Health check failed");
    res.status(500).json({ status: "unhealthy" });
  }
});

// Metrics endpoint
app.get("/metrics", async (_req, res) => {
  try {
    const total = await walletService.getWalletCount();
    const today = await walletService.getTodayWalletCount();
    
    // Add tracking metrics if available
    let trackingMetrics = null;
    if (walletTracker) {
      try {
        trackingMetrics = await walletTracker.getWalletStats();
      } catch (error) {
        logger.error({ error }, "Failed to get tracking metrics");
      }
    }
    
    res.json({
      totalWallets: total,
      walletsToday: today,
      maxWalletsPerDay: config.maxWalletsPerDay,
      remainingToday: config.maxWalletsPerDay - today,
      trackingMetrics,
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
    
    // Initialize wallet tracking and airdrop services (if operator is configured)
    if (config.operatorAccountId && config.operatorPrivateKey) {
      try {
        // Get Hedera client from wallet service
        const hederaClient = walletService['client'];
        
        if (hederaClient) {
          walletTracker = new WalletTrackingService(pool, hederaClient);
          airdropService = new AirdropService(pool, hederaClient, walletTracker);
          logger.info("✅ Wallet tracking and airdrop services initialized");
          
          // Set up wallet balance checking cron job (every hour)
          cron.schedule('0 * * * *', async () => {
            logger.info('Running scheduled wallet balance check');
            try {
              const newlyFunded = await walletTracker!.updateWalletBalances();
              if (newlyFunded > 0) {
                logger.info(`🎉 ${newlyFunded} wallets were funded since last check`);
              }
            } catch (error) {
              logger.error('Error in wallet balance check cron:', error);
            }
          });
          
          // Set up daily wallet statistics (9 AM every day)
          cron.schedule('0 9 * * *', async () => {
            logger.info('Generating daily wallet summary');
            try {
              const stats = await walletTracker!.getWalletStats();
              logger.info('📊 Daily Wallet Statistics:');
              logger.info(`   Total Wallets: ${stats.total_wallets}`);
              logger.info(`   Funded: ${stats.funded_wallets}`);
              logger.info(`   Unfunded: ${stats.unfunded_wallets}`);
              logger.info(`   Airdropped: ${stats.airdropped_wallets}`);
              logger.info(`   Total Balance: ${stats.total_balance_hbar} HBAR`);
            } catch (error) {
              logger.error('Error generating wallet summary:', error);
            }
          });
          
          logger.info("✅ Wallet tracking cron jobs enabled");
        } else {
          logger.warn("⚠️ Hedera client not initialized - wallet tracking disabled");
        }
      } catch (error) {
        logger.error("Failed to initialize wallet tracking services:", error);
      }
    } else {
      logger.warn("⚠️ Operator credentials not set - wallet tracking and airdrops disabled");
    }
    
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

// Export for testing and external use
export { scheduledDMService, walletService, twitterService, walletTracker, airdropService };
