// ============================================
// UPDATED: src/services/twitter.service.ts
// Fixed: Hardcoded bot user ID for @spreddterminal
// ============================================

import { TwitterApi } from "@virtuals-protocol/game-twitter-node";
import { config } from "../config";
import { logger } from "../utils/logger";
import { WalletService } from "./wallet.service";
import { dmTemplates } from "../utils/dm-templates";
import crypto from "crypto";

export class TwitterService {
  private twitter!: TwitterApi;
  private walletService: WalletService;
  private isMonitoring: boolean = false;
  private processedTweets: Set<string> = new Set();

  constructor() {
    this.walletService = new WalletService();
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
    this.monitorMentions();
  }

  private async monitorMentions(): Promise<void> {
    let lastCheckedId: string | undefined;

    while (this.isMonitoring) {
      try {
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

        for (const tweet of mentions.data?.data || []) {
          if (this.processedTweets.has(tweet.id)) continue;

          if (!lastCheckedId || tweet.id > lastCheckedId) {
            lastCheckedId = tweet.id;
          }

          const author = mentions.includes?.users?.find(
            (u: any) => u.id === tweet.author_id
          );

          if (!author) continue;

          const triggerWords = ['wallet', 'create wallet', 'sign up', 'hedera', 'following'];
          const tweetText = tweet.text.toLowerCase();

          if (!triggerWords.some(word => tweetText.includes(word))) {
            continue;
          }

          this.processedTweets.add(tweet.id);

          logger.info(
            { userId: author.id, username: author.username, tweetId: tweet.id },
            "Processing wallet request"
          );

          this.handleWalletRequest(author.id, author.username, tweet.id).catch(error => {
            logger.error({ error, tweetId: tweet.id }, "Unhandled error in wallet request");
          });
        }

        if (this.processedTweets.size > 1000) {
          const tweetsArray = Array.from(this.processedTweets);
          this.processedTweets = new Set(tweetsArray.slice(-1000));
        }

        await new Promise(resolve => setTimeout(resolve, 30000));
      } catch (error) {
        logger.error({ error }, "Error monitoring mentions");
        await new Promise(resolve => setTimeout(resolve, 120000));
      }
    }
  }

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
          `@${username} You already have a wallet! 

If you need help accessing it, please DM us. 💬`
        );
        logger.info({ userId, username }, "User already has wallet");
        return;
      }

      // CHECK 2: Is user following the bot?
      const isFollowing = await this.checkIfUserFollows(userId);
      
      if (!isFollowing) {
        await this.replyToTweet(
          tweetId,
          `@${username} To receive your wallet securely via DM:

1️⃣ Follow @${await this.getBotUsername()}
2️⃣ Reply to this tweet with "following"

We'll create your wallet immediately! 🔐`
        );
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
        await this.replyToTweet(
          tweetId,
          `@${username} You've reached the wallet creation limit. Please try again tomorrow.`
        );
        logger.warn({ userId, username }, "Rate limit exceeded");
        return;
      }

      // CHECK 4: Daily limit
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
      
      const { wallet, password, rawPrivateKey } = await this.walletService.createWallet(userId, username);
      
      await this.walletService.recordRateLimit(userId, "CREATE_WALLET");

      const walletCount = await this.walletService.getWalletCount();
      const walletAddress = wallet.account_id || wallet.account_alias;

      // Generate encrypted claim link (expires in 1 HOUR - strict security)
      const claimToken = this.generateClaimToken({
        privateKey: rawPrivateKey, // RAW private key (never stored in DB)
        password: password,
        accountId: wallet.account_id,
        accountAlias: wallet.account_alias,
        userId: userId,
        username: username,
        expiresAt: Date.now() + (60 * 60 * 1000) // 1 HOUR
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

      // SEND DMs (no fallback to public)
      let dm1Sent = false;
      let dm2Scheduled = false;
      
      // Always mark claim link as generated
      await this.walletService.markClaimLinkGenerated(userId);
      
      try {
        await this.sendDM(userId, dmMessage1);
        await this.walletService.markDM1Sent(userId);
        logger.info({ userId, username }, "✅ DM #1 sent with claim link");
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
        
        dm2Scheduled = true;

      } catch (dmError) {
        await this.walletService.markDM1Failed(userId);
        logger.error({ userId, username, error: dmError }, "❌ CRITICAL: DM #1 failed - user cannot access wallet");
        
        // If DM fails, we have a problem - they need to follow us
        // Don't send public reply with credentials for security
      }

      // PUBLIC REPLY - Never includes claim link (DM only)
      if (dm1Sent) {
        await this.replyToTweet(
          tweetId,
          `@${username} ✅ Your Hedera wallet is ready!

📍 Address: ${walletAddress}

🔐 Check your DMs for secure access!

💡 You're user #${walletCount}! Early users get bonus rewards! 🚀`
        );
      } else {
        // DM failed - ask them to follow and try again
        await this.replyToTweet(
          tweetId,
          `@${username} ⚠️ Wallet created but couldn't send DM!

Please make sure you're following @${await this.getBotUsername()} and mention us again.

Your wallet will be recreated with new credentials.`
        );
      }

      logger.info({ userId, username, walletCount, walletAddress, dm1Sent, dm2Scheduled }, "✅ Wallet process completed");

    } catch (error: any) {
      logger.error({ error, userId, username }, "Error handling wallet request");
      
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
        logger.error({ error: replyError, userId }, "Failed to send error reply");
      }

      this.processedTweets.delete(tweetId);
    }
  }

  /**
   * Check if user follows the bot
   */
  private async checkIfUserFollows(userId: string): Promise<boolean> {
    try {
      const ownUserId = await this.getOwnUserId();
      
      // Check if userId follows ownUserId
      const result = await this.twitter.v2.following(userId, {
        max_results: 1000,
      });

      const follows = result.data || []; // Fix: result.data is the array directly
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
      return "spreddterminal"; // Fallback to known username
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
      logger.error({ error, tweetId }, "Failed to reply to tweet");
      throw error;
    }
  }

  private ownUserId?: string;
  private async getOwnUserId(): Promise<string> {
    if (this.ownUserId) return this.ownUserId;

    // Hardcoded bot Twitter user ID for @spreddterminal
    // GAME framework v2.me() endpoint is unreliable, so we use the known ID
    this.ownUserId = "1553617361114017792";
    logger.info({ userId: this.ownUserId }, "Using bot user ID");
    return this.ownUserId;
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
