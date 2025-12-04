// ============================================
// ✅ SIMPLIFIED: src/services/twitter.service.ts
// Using game-twitter-node directly (no GAME Agent complexity)
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

          logger.info(
            { userId: author.id, username: author.username, tweetId: tweet.id },
            "Processing wallet request"
          );

          // Handle wallet creation
          await this.handleWalletRequest(author.id, author.username, tweet.id);
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
      // Check if user already has wallet
      if (await this.walletService.hasWallet(userId)) {
        await this.replyToTweet(
          tweetId,
          `@${username} You already have a wallet! Check your DMs for details. 🎯`
        );
        logger.info({ userId }, "User already has wallet");
        return;
      }

      // Check rate limits
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
        logger.warn({ userId }, "Rate limit exceeded");
        return;
      }

      // Check daily limit
      const todayCount = await this.walletService.getTodayWalletCount();
      if (todayCount >= config.maxWalletsPerDay) {
        await this.replyToTweet(
          tweetId,
          `@${username} We've reached our daily wallet limit! Please try again tomorrow. 🙏`
        );
        logger.warn({ todayCount }, "Daily limit reached");
        return;
      }

      // Create wallet
      logger.info({ userId, username }, "Creating wallet");
      const { wallet, password } = await this.walletService.createWallet(userId, username);
      await this.walletService.recordRateLimit(userId, "CREATE_WALLET");

      const walletCount = await this.walletService.getWalletCount();

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

      // Reply publicly
      await this.replyToTweet(
        tweetId,
        `@${username} Your Hedera wallet is ready! 🎉 Check your DMs to receive your credentials.

💡 You're user #${walletCount}! Early users get bonus rewards at launch! 🚀`
      );

      logger.info({ userId, username, walletCount }, "✅ Wallet created successfully");

    } catch (error) {
      logger.error({ error, userId }, "Error handling wallet request");
      
      // Try to send error reply
      try {
        await this.replyToTweet(
          tweetId,
          `@${username} Sorry, something went wrong! Please try again in a few minutes. 🙏`
        );
      } catch (replyError) {
        logger.error({ error: replyError }, "Failed to send error reply");
      }
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
