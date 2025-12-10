// ============================================
// UPDATED: src/services/twitter.service.ts
// Database-backed mention tracking with time-based filtering
// ============================================

import { TwitterApi } from "@virtuals-protocol/game-twitter-node";
import { config } from "../config";
import { logger } from "../utils/logger";
import { WalletService } from "./wallet.service";
import { MentionTrackingService } from "./mention-tracking.service";
import { pool } from "../database";
import { dmTemplates } from "../utils/dm-templates";
import crypto from "crypto";

export class TwitterService {
  private twitter!: TwitterApi;
  private walletService: WalletService;
  private mentionTracker: MentionTrackingService;
  private isMonitoring: boolean = false;

  constructor() {
    this.walletService = new WalletService();
    this.mentionTracker = new MentionTrackingService(pool);
  }

  async initialize(): Promise<void> {
    logger.info("Initializing Twitter service with game-twitter-node...");

    this.twitter = new TwitterApi({
      gameTwitterAccessToken: config.gameTwitterToken,
    });

    logger.info("✅ Twitter client initialized successfully");
  }

  async start(): Promise<void> {
    logger.info("Starting Twitter mention monitoring...");
    this.isMonitoring = true;
    
    // Start monitoring loop
    this.monitorMentions();
    
    // Start periodic cleanup (every 24 hours)
    this.scheduleCleanup();
  }

  private async monitorMentions(): Promise<void> {
    while (this.isMonitoring) {
      try {
        const mentions = await this.twitter.v2.userMentionTimeline(
          await this.getOwnUserId(),
          {
            max_results: 20, // Get more mentions to catch up
            expansions: ['author_id'],
            'tweet.fields': ['created_at', 'conversation_id'],
            'user.fields': ['username'],
          }
        );

        const now = Date.now();
        const tenMinutesAgo = now - (10 * 60 * 1000); // Only process last 10 minutes
        let processedCount = 0;
        let skippedOld = 0;
        let skippedDuplicate = 0;

        for (const tweet of mentions.data?.data || []) {
          // Check if tweet is too old (more than 10 minutes)
          const tweetTime = new Date(tweet.created_at).getTime();
          if (tweetTime < tenMinutesAgo) {
            skippedOld++;
            continue;
          }

          // Check if already processed in database
          const alreadyProcessed = await this.mentionTracker.isProcessed(tweet.id);
          if (alreadyProcessed) {
            skippedDuplicate++;
            continue;
          }

          const author = mentions.includes?.users?.find(
            (u: any) => u.id === tweet.author_id
          );

          if (!author) {
            await this.mentionTracker.markAsProcessed(
              tweet.id,
              tweet.author_id,
              'unknown',
              'no_author_data',
              tweet.text
            );
            continue;
          }

          // Check for trigger words
          const triggerWords = ['wallet', 'create wallet', 'sign up', 'hedera', 'following'];
          const tweetText = tweet.text.toLowerCase();

          if (!triggerWords.some(word => tweetText.includes(word))) {
            await this.mentionTracker.markAsProcessed(
              tweet.id,
              author.id,
              author.username,
              'no_trigger_word',
              tweet.text
            );
            continue;
          }

          logger.info(
            { 
              userId: author.id, 
              username: author.username, 
              tweetId: tweet.id,
              age: Math.round((now - tweetTime) / 1000) + 's'
            },
            "Processing wallet request"
          );

          processedCount++;

          // Process the request (async, don't wait)
          this.handleWalletRequest(author.id, author.username, tweet.id, tweet.text).catch(error => {
            logger.error({ error, tweetId: tweet.id }, "Unhandled error in wallet request");
          });
        }

        if (processedCount > 0 || skippedOld > 0 || skippedDuplicate > 0) {
          logger.info(
            { processedCount, skippedOld, skippedDuplicate },
            "Mention processing summary"
          );
        }

        // Wait 30 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 30000));
      } catch (error: any) {
        logger.error({ 
          error,
          errorMessage: error?.message,
          errorCode: error?.code 
        }, "Error monitoring mentions - will retry in 2 minutes");
        await new Promise(resolve => setTimeout(resolve, 120000));
      }
    }
  }

  private async handleWalletRequest(
    userId: string,
    username: string,
    tweetId: string,
    tweetText: string
  ): Promise<void> {
    try {
      // CHECK 1: Does user already have a wallet?
      const hasWallet = await this.walletService.hasWallet(userId);
      
      if (hasWallet) {
        await this.mentionTracker.markAsProcessed(
          tweetId,
          userId,
          username,
          'already_has_wallet',
          tweetText
        );
        
        // Try to reply (but don't fail if it doesn't work)
        try {
          await this.replyToTweet(
            tweetId,
            `@${username} You already have a wallet! 

If you need help accessing it, please DM us. 💬`
          );
        } catch (replyError) {
          logger.debug({ replyError }, "Reply failed (not critical)");
        }
        
        logger.info({ userId, username }, "User already has wallet");
        return;
      }

      // CHECK 2: Is user following the bot?
      const isFollowing = await this.checkIfUserFollows(userId);
      
      if (!isFollowing) {
        await this.mentionTracker.markAsProcessed(
          tweetId,
          userId,
          username,
          'not_following',
          tweetText
        );
        
        // Try to reply
        try {
          await this.replyToTweet(
            tweetId,
            `@${username} To receive your wallet securely via DM:

1️⃣ Follow @${await this.getBotUsername()}
2️⃣ Reply to this tweet with "following"

We'll create your wallet immediately! 🔐`
          );
        } catch (replyError) {
          logger.debug({ replyError }, "Reply failed (not critical)");
        }
        
        logger.info({ userId, username }, "User not following - asked to follow");
        return;
      }

      // CHECK 3: Rate limiting
      const canCreate = await this.walletService.checkRateLimit(
        userId,
        "CREATE_WALLET",
        config.maxWalletsPerUser
      );

      if (!canCreate) {
        await this.mentionTracker.markAsProcessed(
          tweetId,
          userId,
          username,
          'rate_limited',
          tweetText
        );
        
        try {
          await this.replyToTweet(
            tweetId,
            `@${username} You've reached the wallet creation limit. Please try again tomorrow.`
          );
        } catch (replyError) {
          logger.debug({ replyError }, "Reply failed (not critical)");
        }
        
        logger.warn({ userId, username }, "Rate limit exceeded");
        return;
      }

      // CHECK 4: Daily limit
      const todayCount = await this.walletService.getTodayWalletCount();
      
      if (todayCount >= config.maxWalletsPerDay) {
        await this.mentionTracker.markAsProcessed(
          tweetId,
          userId,
          username,
          'daily_limit',
          tweetText
        );
        
        try {
          await this.replyToTweet(
            tweetId,
            `@${username} We've reached our daily wallet limit! Please try again tomorrow. 🙏`
          );
        } catch (replyError) {
          logger.debug({ replyError }, "Reply failed (not critical)");
        }
        
        logger.warn({ todayCount }, "Daily limit reached");
        return;
      }

      // CREATE WALLET
      logger.info({ userId, username }, "Creating wallet");
      
      const { wallet, password, rawPrivateKey } = await this.walletService.createWallet(userId, username);
      
      await this.walletService.recordRateLimit(userId, "CREATE_WALLET");

      const walletCount = await this.walletService.getWalletCount();
      const walletAddress = wallet.account_id || wallet.account_alias;

      // Generate encrypted claim link (expires in 1 HOUR)
      const claimToken = this.generateClaimToken({
        privateKey: rawPrivateKey,
        password: password,
        accountId: wallet.account_id,
        accountAlias: wallet.account_alias,
        userId: userId,
        username: username,
        expiresAt: Date.now() + (60 * 60 * 1000)
      });

      const claimLink = `https://claim.spredd.markets/${claimToken}`;

      // Prepare DM messages
      const dmMessage1 = `🎉 Your Hedera Wallet is Ready!

📍 Account: ${walletAddress}

🔐 Get your private key (expires in 1 hour):
${claimLink}

⚠️ CRITICAL:
• Link expires in 1 HOUR
• We do NOT store your private key
• Save it immediately after claiming
• If link expires, create a new wallet

💡 You're user #${walletCount}! 🚀`;

      const dmMessage2 = dmTemplates.setupGuide(username);

      // SEND DMs
      let dm1Sent = false;
      
      await this.walletService.markClaimLinkGenerated(userId);
      
      try {
        await this.sendDM(userId, dmMessage1);
        await this.walletService.markDM1Sent(userId);
        logger.info({ userId, username, claimLink }, "✅ DM #1 sent with claim link");
        dm1Sent = true;

        // Schedule DM #2 for 5 minutes later
        setTimeout(async () => {
          try {
            await this.sendDM(userId, dmMessage2);
            await this.walletService.markDM2Sent(userId);
            logger.info({ userId, username }, "✅ DM #2 sent");
          } catch (error) {
            logger.error({ error, userId }, "❌ Failed to send DM #2 (not critical)");
          }
        }, 5 * 60 * 1000);

      } catch (dmError) {
        await this.walletService.markDM1Failed(userId);
        logger.error({ userId, username, error: dmError }, "❌ CRITICAL: DM #1 failed");
        dm1Sent = false;
      }

      // Mark as processed with appropriate action
      await this.mentionTracker.markAsProcessed(
        tweetId,
        userId,
        username,
        dm1Sent ? 'wallet_created' : 'wallet_created_dm_failed',
        tweetText
      );

      // PUBLIC REPLY (optional - will fail with GAME but that's okay)
      if (dm1Sent) {
        try {
          await this.replyToTweet(
            tweetId,
            `@${username} ✅ Your Hedera wallet is ready!

📍 Address: ${walletAddress}

🔐 Check your DMs for secure access!

💡 You're user #${walletCount}! Early users get bonus rewards! 🚀`
          );
        } catch (replyError) {
          logger.debug({ replyError }, "Public reply failed (expected with GAME)");
        }
      }

      logger.info({ 
        userId, 
        username, 
        walletCount, 
        walletAddress, 
        dm1Sent 
      }, "✅ Wallet creation completed");

    } catch (error: any) {
      logger.error({ error, userId, username }, "Error handling wallet request");
      
      // Mark as error in tracking
      await this.mentionTracker.markAsProcessed(
        tweetId,
        userId,
        username,
        'error',
        tweetText
      );
      
      // Try to send error reply
      let errorMessage = `@${username} ❌ Something went wrong creating your wallet. `;

      if (error.message?.includes("WALLET_ALREADY_EXISTS")) {
        errorMessage = `@${username} You already have a wallet! Check your DMs.`;
      } else if (error.message?.includes("INSUFFICIENT_PAYER_BALANCE")) {
        errorMessage = `@${username} Our system is temporarily low on funds. Please try again in a few minutes. 🙏`;
      } else if (error.code === "23505") {
        errorMessage = `@${username} You already have a wallet! Check your DMs for your credentials.`;
      } else {
        errorMessage += "Please mention us again to retry.";
      }
      
      try {
        await this.replyToTweet(tweetId, errorMessage);
      } catch (replyError) {
        logger.debug({ replyError }, "Error reply failed");
      }
    }
  }

  /**
   * Check if user follows the bot
   */
  private async checkIfUserFollows(userId: string): Promise<boolean> {
    try {
      const ownUserId = await this.getOwnUserId();
      
      const result = await this.twitter.v2.following(userId, {
        max_results: 1000,
      });

      const follows = result.data || [];
      return follows.some((user: any) => user.id === ownUserId);
    } catch (error) {
      logger.error({ error, userId }, "Failed to check if user follows");
      // On error, assume they're following to avoid blocking wallet creation
      return true;
    }
  }

  /**
   * Get bot's username
   */
  private botUsername?: string;
  private async getBotUsername(): Promise<string> {
    if (this.botUsername) return this.botUsername;

    try {
      const me = await this.twitter.v2.me();
      this.botUsername = me.data.username;
      return this.botUsername;
    } catch (error) {
      logger.error({ error }, "Failed to get bot username");
      return "spreddterminal";
    }
  }

  /**
   * Generate encrypted claim token
   */
  private generateClaimToken(data: any): string {
    const secret = config.claimTokenSecret || config.encryptionKey;
    const payload = JSON.stringify(data);
    
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(secret.slice(0, 32)),
      Buffer.from(secret.slice(0, 12))
    );
    
    let encrypted = cipher.update(payload, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    return Buffer.from(`${encrypted}:${authTag}`).toString('base64url');
  }

  async sendDM(recipientId: string, text: string): Promise<void> {
    try {
      await this.twitter.v2.sendDmToParticipant(recipientId, { text });
      logger.debug({ recipientId }, "DM sent successfully");
    } catch (error) {
      logger.error({ error, recipientId }, "Failed to send DM");
      throw error;
    }
  }

  private async replyToTweet(tweetId: string, text: string): Promise<void> {
    try {
      await this.twitter.v2.reply(text, tweetId);
      logger.debug({ tweetId }, "Reply sent successfully");
    } catch (error) {
      // Don't log reply failures as errors - GAME often doesn't support replies
      throw error;
    }
  }

  private ownUserId?: string;
  private async getOwnUserId(): Promise<string> {
    if (this.ownUserId) return this.ownUserId;

    // Hardcoded bot Twitter user ID for @spreddterminal
    this.ownUserId = "1553617361114017792";
    logger.info({ userId: this.ownUserId }, "Using bot user ID");
    return this.ownUserId;
  }

  /**
   * Periodic cleanup of old processed mentions
   */
  private scheduleCleanup(): void {
    // Run cleanup every 24 hours
    setInterval(async () => {
      try {
        const deleted = await this.mentionTracker.cleanup();
        logger.info({ deleted }, "Completed periodic mention tracking cleanup");
      } catch (error) {
        logger.error({ error }, "Failed periodic cleanup");
      }
    }, 24 * 60 * 60 * 1000);
  }

  stop(): void {
    this.isMonitoring = false;
    logger.info("Twitter monitoring stopped");
  }

  isActive(): boolean {
    return this.isMonitoring;
  }
}

export default TwitterService;
