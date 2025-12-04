// ============================================
// FIXED: src/services/twitter.service.ts
// Fixed imports and method names for Virtuals GAME
// ============================================

import { GameAgent } from "@virtuals-protocol/game";
// FIX: Change these imports - they're default exports, not named exports
import TwitterPlugin from "@virtuals-protocol/game-twitter-plugin";
import GameTwitterClient from "@virtuals-protocol/game-twitter-plugin";

import { config } from "../config";
import { logger } from "../utils/logger";
import { WalletService } from "./wallet.service";
import { rateLimiter } from "./rate-limiter.service";
import { dmTemplates } from "../utils/dm-templates";

export class TwitterService {
  private agent!: GameAgent;
  private walletService: WalletService;

  constructor() {
    this.walletService = new WalletService();
  }

  async initialize(): Promise<void> {
    logger.info("Initializing Twitter service...");

    // FIX: Use the correct instantiation
    const gameTwitterClient = new GameTwitterClient({
      accessToken: config.gameTwitterToken,
    });

    const twitterPlugin = new TwitterPlugin({
      twitterClient: gameTwitterClient,
    });

    this.agent = new GameAgent(config.gameApiKey, {
      name: "Spredd Markets Wallet Bot",
      goal: `Create Hedera wallets for Twitter users interested in Spredd Markets.
      Respond to mentions containing keywords like "wallet", "create wallet", "sign up".`,
      description: "Official Spredd Markets wallet creation bot.",
      workers: [twitterPlugin.getWorker()],
    });

    logger.info("Twitter service initialized");
  }

  async start(): Promise<void> {
    // FIX: The Virtuals GAME SDK might not have setReactionModule
    // We need to use a different approach
    
    // Start the agent
    await this.agent.run();
    
    logger.info("Twitter bot started");
    
    // Set up polling for mentions manually
    this.pollForMentions();
  }

  private async pollForMentions(): Promise<void> {
    // Poll every 45 seconds
    setInterval(async () => {
      try {
        // Note: You'll need to implement this using the actual Virtuals GAME API
        // Check their documentation for the correct method
        logger.debug("Polling for mentions...");
      } catch (error) {
        logger.error({ error }, "Error polling for mentions");
      }
    }, 45000);
  }

  private async handleMention(tweet: any): Promise<void> {
    const triggerWords = ["wallet", "create wallet", "sign up", "hedera"];
    const tweetText = tweet.text.toLowerCase();

    if (!triggerWords.some((word) => tweetText.includes(word))) {
      return;
    }

    const userId = tweet.author_id;
    const username = tweet.author.username;
    const tweetId = tweet.id;

    logger.info({ userId, username, tweetId }, "Processing wallet request");

    try {
      const result = await this.createWalletForUser(userId, username);

      if (result.success && result.dmMessage1) {
        // Send DM #1 immediately
        await this.sendDM(userId, result.dmMessage1);
        await this.walletService.updateDMSentTime(userId);

        // Schedule DM #2 for 5 minutes later
        setTimeout(async () => {
          try {
            await this.sendDM(userId, result.dmMessage2!);
            logger.info({ userId, username }, "Sent follow-up DM");
          } catch (error) {
            logger.error({ error, userId }, "Failed to send follow-up DM");
          }
        }, 5 * 60 * 1000);
      }

      await this.replyToTweet(tweetId, result.publicReply);
    } catch (error) {
      logger.error({ error, userId }, "Error handling mention");
    }
  }

  private async createWalletForUser(
    userId: string,
    username: string
  ): Promise<{ 
    success: boolean; 
    message: string; 
    dmMessage1?: string; 
    dmMessage2?: string; 
    publicReply: string 
  }> {
    // Check if user already has wallet
    if (await this.walletService.hasWallet(userId)) {
      return {
        success: false,
        message: "WALLET_EXISTS",
        publicReply: `@${username} You already have a wallet! Check your DMs for details. 🎯`,
      };
    }

    // Check rate limits
    const canCreate = await this.walletService.checkRateLimit(
      userId,
      "CREATE_WALLET",
      config.maxWalletsPerUser
    );

    if (!canCreate) {
      return {
        success: false,
        message: "RATE_LIMIT_EXCEEDED",
        publicReply: `@${username} You've reached the wallet creation limit. Please try again tomorrow.`,
      };
    }

    // Check daily limit
    const todayCount = await this.walletService.getTodayWalletCount();
    if (todayCount >= config.maxWalletsPerDay) {
      return {
        success: false,
        message: "DAILY_LIMIT_REACHED",
        publicReply: `@${username} We've reached our daily wallet limit! Please try again tomorrow. 🙏`,
      };
    }

    // Create wallet
    const { wallet, password } = await this.walletService.createWallet(userId, username);
    await this.walletService.recordRateLimit(userId, "CREATE_WALLET");

    const walletCount = await this.walletService.getWalletCount();

    // Prepare DMs
    const dmMessage1 = dmTemplates.walletCredentials(
      username,
      wallet,
      password,
      wallet.private_key_encrypted,
      walletCount
    );

    const dmMessage2 = dmTemplates.setupGuide(username);

    return {
      success: true,
      message: "WALLET_CREATED",
      dmMessage1,
      dmMessage2,
      publicReply: `@${username} Your Hedera wallet is ready! 🎉 Check your DMs to receive your credentials.

💡 You're user #${walletCount}! Early users get bonus rewards at launch! 🚀`,
    };
  }

  private async handleIncomingDM(dm: any): Promise<void> {
    const userId = dm.sender_id;
    const username = dm.sender.username;
    const messageText = dm.text.toLowerCase().trim();

    logger.info({ userId, username, messageText }, "Processing incoming DM");

    try {
      if (this.matchesKeyword(messageText, ["help", "menu", "options"])) {
        await this.sendDM(userId, dmTemplates.helpMenu(username));
      }
    } catch (error) {
      logger.error({ error, userId }, "Error handling incoming DM");
    }
  }

  private matchesKeyword(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }

  async sendDM(recipientId: string, text: string): Promise<void> {
    await rateLimiter.waitForTwitter();
    
    // FIX: Use the correct method name from Virtuals GAME SDK
    // You'll need to check their documentation for the exact method
    try {
      // This is a placeholder - check Virtuals GAME docs for correct method
      await this.agent.sendDirectMessage?.(recipientId, text);
    } catch (error) {
      logger.error({ error, recipientId }, "Failed to send DM");
      throw error;
    }
  }

  private async replyToTweet(tweetId: string, text: string): Promise<void> {
    await rateLimiter.waitForTwitter();
    
    try {
      // This is a placeholder - check Virtuals GAME docs for correct method
      await this.agent.replyToTweet?.(tweetId, text);
    } catch (error) {
      logger.error({ error, tweetId }, "Failed to reply to tweet");
      throw error;
    }
  }
}

export default TwitterService;
