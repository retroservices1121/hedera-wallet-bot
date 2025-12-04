// ============================================
// ✅ UPDATED: src/services/twitter.service.ts
// Added duplicate prevention and better error handling
// ============================================

import { TwitterApi } from "@virtuals-protocol/game-twitter-node";
import { config } from "../config";
import { logger } from "../utils/logger";
import { WalletService } from "./wallet.service";
import { dmTemplates } from "../utils/dm-templates";

export class TwitterService {
  private twitter!: TwitterApi;
  private walletService: WalletService;
  private isMonitoring: boolean = false;
  private processedTweets: Set<string> = new Set(); // Track processed tweets

  constructor() {
    this.walletService = new WalletService();
  }

  async initialize(): Promise<void> {
    logger.info("Initializing Twitter service with game-twitter-node...");

    // Initialize Twitter client with GAME token (gets enterprise rate limits!)
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
  }

  /**
   * Monitor mentions in a loop
   */
  private async monitorMentions(): Promise<void> {
    let lastCheckedId: string | undefined;

    while (this.isMonitoring) {
      try {
        // Get mentions (using Twitter API v2)
        const mentions = await this.twitter.v2.userMentionTimeline(
          await this.getOwnUserId(),
          {
            max_results: 10,
            since_id: lastCheckedId,
            expansions: ['author_id'],
            'tweet.fields': ['created_at', 'conversation_id'],
            'user.fields': ['username'],
          }
        );

        // Process each mention
        for (const tweet of mentions.data?.data || []) {
          // Skip if already processed
          if (this.processedTweets.has(tweet.id)) {
            continue;
          }

          // Update last checked ID
          if (!lastCheckedId || tweet.id > lastCheckedId) {
            lastCheckedId = tweet.id;
          }

          // Get author info
          const author = mentions.includes?.users?.find(
            (u: any) => u.id === tweet.author_id
          );

          if (!author) continue;

          // Check if tweet contains trigger words
          const triggerWords = ['wallet', 'create wallet', 'sign up', 'hedera'];
          const tweetText = tweet.text.toLowerCase();

          if (!triggerWords.some(word => tweetText.includes(word))) {
            continue;
          }

          // Mark as processed BEFORE handling to prevent duplicate processing
          this.processedTweets.add(tweet.id);

          logger.info(
            { userId: author.id, username: author.username, tweetId: tweet.id },
            "Processing wallet request"
          );

          // Handle wallet creation (don't await to process multiple mentions in parallel)
          this.handleWalletRequest(author.id, author.username, tweet.id).catch(error => {
            logger.error({ error, tweetId: tweet.id }, "Unhandled error in wallet request");
          });
        }

        // Clean up old processed tweets (keep only last 1000)
        if (this.processedTweets.size > 1000) {
          const tweetsArray = Array.from(this.processedTweets);
          this.processedTweets = new Set(tweetsArray.slice(-1000));
        }

        // Wait 30 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 30000));
      } catch (error) {
        logger.error({ error }, "Error monitoring mentions");
        
        // Wait longer on error
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }
  }

  /**
   * Handle wallet creation request
   */
  private async handleWalletRequest(
    userId: string,
    username: string,
    tweetId: string
  ): Promise<void> {
    try {
      // CHECK 1: Does user already have a wallet?
      const hasWallet = await this.walletService.hasWallet(userId);
      
      if (hasWallet) {
        await this.replyToTweet(
          tweetId,
          `@${username} You already have a wallet! Check your DMs for your credentials. 

If you didn't receive them, please contact support.`
        );
        logger.info({ userId, username }, "User already has wallet - skipping creation");
        return; // EXIT - Don't create another wallet
      }

      // CHECK 2: Rate limiting
      const canCreate = await this.walletService.checkRateLimit(
        userId,
        "CREATE_WALLET",
        config.maxWalletsPerUser
      );

      if (!canCreate) {
        await this.replyToTweet(
          tweetId,
          `@${username} You've reached the wallet creation limit. Please try again tomorrow.`
        );
        logger.warn({ userId, username }, "Rate limit exceeded");
        return;
      }

      // CHECK 3: Daily limit
      const todayCount = await this.walletService.getTodayWalletCount();
      
      if (todayCount >= config.maxWalletsPerDay) {
        await this.replyToTweet(
          tweetId,
          `@${username} We've reached our daily wallet limit! Please try again tomorrow. 🙏`
        );
        logger.warn({ todayCount }, "Daily limit reached");
        return;
      }

      // CREATE WALLET
      logger.info({ userId, username }, "Creating wallet");
      
      const { wallet, password } = await this.walletService.createWallet(userId, username);
      
      await this.walletService.recordRateLimit(userId, "CREATE_WALLET");

      const walletCount = await this.walletService.getWalletCount();
      const walletAddress = wallet.account_id || wallet.account_alias;

      // Prepare DM messages
      const dmMessage1 = dmTemplates.walletCredentials(
        username,
        wallet,
        password,
        wallet.private_key_encrypted,
        walletCount
      );

      const dmMessage2 = dmTemplates.setupGuide(username);

      // Send DM #1 immediately
      await this.sendDM(userId, dmMessage1);
      await this.walletService.updateDMSentTime(userId);

      logger.info({ userId, username }, "Sent DM #1");

      // Schedule DM #2 for 5 minutes later
      setTimeout(async () => {
        try {
          await this.sendDM(userId, dmMessage2);
          logger.info({ userId, username }, "Sent DM #2");
        } catch (error) {
          logger.error({ error, userId }, "Failed to send DM #2");
        }
      }, 5 * 60 * 1000);

      // Reply publicly with success message
      await this.replyToTweet(
        tweetId,
        `@${username} Your Hedera wallet is ready! 🎉 

📍 Address: ${walletAddress}
Check your DMs for secure access credentials.

💡 You're user #${walletCount}! Early users get bonus rewards at launch! 🚀`
      );

      logger.info({ userId, username, walletCount, walletAddress }, "✅ Wallet created successfully");

    } catch (error: any) {
      logger.error({ error, userId, username }, "Error handling wallet request");
      
      // Determine error type and send appropriate message
      let errorMessage = `@${username} ❌ Something went wrong creating your wallet. `;

      if (error.message?.includes("WALLET_ALREADY_EXISTS")) {
        errorMessage = `@${username} You already have a wallet! Check your DMs for your credentials.`;
      } else if (error.message?.includes("INSUFFICIENT_PAYER_BALANCE")) {
        errorMessage = `@${username} Our system is temporarily low on funds. Please try again in a few minutes. 🙏`;
      } else if (error.message?.includes("INVALID_SIGNATURE")) {
        errorMessage = `@${username} System configuration error. Please contact support.`;
      } else if (error.message?.includes("Operator account not configured")) {
        errorMessage = `@${username} Wallet service is temporarily unavailable. Please try again later.`;
      } else if (error.code === "23505") { // Duplicate key violation
        errorMessage = `@${username} You already have a wallet! Check your DMs for your credentials.`;
      } else {
        errorMessage += "Please mention us again to retry.";
      }
      
      // Try to send error reply
      try {
        await this.replyToTweet(tweetId, errorMessage);
      } catch (replyError) {
        logger.error({ error: replyError, userId }, "Failed to send error reply");
      }

      // DO NOT retry automatically - user must mention again
      // Remove from processed tweets so they CAN mention again if they want
      this.processedTweets.delete(tweetId);
    }
  }

  /**
   * Send a direct message
   */
  async sendDM(recipientId: string, text: string): Promise<void> {
    try {
      await this.twitter.v2.sendDmToParticipant(recipientId, { text });
      logger.debug({ recipientId }, "DM sent successfully");
    } catch (error) {
      logger.error({ error, recipientId }, "Failed to send DM");
      throw error;
    }
  }

  /**
   * Reply to a tweet
   */
  private async replyToTweet(tweetId: string, text: string): Promise<void> {
    try {
      await this.twitter.v2.reply(text, tweetId);
      logger.debug({ tweetId }, "Reply sent successfully");
    } catch (error) {
      logger.error({ error, tweetId }, "Failed to reply to tweet");
      throw error;
    }
  }

  /**
   * Get own user ID (cached)
   */
  private ownUserId?: string;
  private async getOwnUserId(): Promise<string> {
    if (this.ownUserId) return this.ownUserId;

    try {
      const me = await this.twitter.v2.me();
      this.ownUserId = me.data.id;
      logger.info({ userId: this.ownUserId }, "Retrieved own user ID");
      return this.ownUserId;
    } catch (error) {
      logger.error({ error }, "Failed to get own user ID");
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.isMonitoring = false;
    logger.info("Twitter monitoring stopped");
  }

  /**
   * Check if monitoring is active
   */
  isActive(): boolean {
    return this.isMonitoring;
  }
}

export default TwitterService;
