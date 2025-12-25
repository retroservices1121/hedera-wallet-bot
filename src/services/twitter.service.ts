// ============================================
// UPDATED: src/services/twitter.service.ts
// Database-backed mention tracking with time-based filtering
// ============================================

import { TwitterApi } from "@virtuals-protocol/game-twitter-node";
import { config } from "../config";
import { logger } from "../utils/logger";
import { WalletService } from "./wallet.service";
import { MentionTrackingService } from "./mention-tracking.service";
import { waitlistService } from "./waitlist.service";
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
          // Skip if no created_at timestamp
          if (!tweet.created_at) {
            continue;
          }

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

          if (!author || !tweet.author_id) {
            if (tweet.author_id) {
              await this.mentionTracker.markAsProcessed(
                tweet.id,
                tweet.author_id,
                'unknown',
                'no_author_data',
                tweet.text || ''
              );
            }
            continue;
          }

          // Check for wallet creation or waitlist trigger phrases
          const tweetText = (tweet.text || '').toLowerCase();
          
          // Remove mentions and extra spaces for cleaner matching
          const cleanText = tweetText
            .replace(/@\w+/g, '') // Remove all @mentions
            .replace(/\s+/g, ' ')  // Normalize whitespace
            .trim();
          
          // Check for WAITLIST request
          const hasWaitlist = cleanText.includes('waitlist');
          const hasAdd = cleanText.includes('add');
          
          if (hasWaitlist && hasAdd) {
            // Handle waitlist signup
            await this.handleWaitlistSignup(author.id, author.username, tweet.id, tweetText);
            processedCount++;
            continue;
          }
          
          // Check for WALLET CREATION request
          const hasCreate = cleanText.includes('create');
          const hasWallet = cleanText.includes('wallet');
          
          if (!hasCreate || !hasWallet) {
            // Not a wallet creation request - ignore silently
            await this.mentionTracker.markAsProcessed(
              tweet.id,
              author.id,
              author.username,
              'ignored_not_wallet_request',
              tweet.text || ''
            );
            logger.debug({ 
              userId: author.id, 
              username: author.username,
              text: cleanText 
            }, "Ignored mention - not a wallet creation request");
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
          this.handleWalletRequest(author.id, author.username, tweet.id, tweet.text || '').catch(error => {
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

      // CHECK 2: Rate limiting
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

      const claimLink = `https://claim.spredd.markets/claim/${claimToken}`;

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
   * Handle waitlist signup request
   */
  private async handleWaitlistSignup(
    userId: string,
    username: string,
    tweetId: string,
    tweetText: string
  ): Promise<void> {
    try {
      logger.info({ userId, username }, "Processing waitlist signup");

      // Add to waitlist
      const result = await waitlistService.addToWaitlist(userId, username, tweetId);

      // Mark as processed
      await this.mentionTracker.markAsProcessed(
        tweetId,
        userId,
        username,
        result.alreadyOnWaitlist ? 'waitlist_already_added' : 'waitlist_added',
        tweetText
      );

      // Send confirmation reply
      const replyMessage = result.alreadyOnWaitlist
        ? `@${username} You're already on the waitlist! We'll DM you when private beta is available. 🚀`
        : `@${username} ✅ You're now on the waitlist! We'll DM you when private beta is available. 🚀`;

      try {
        await this.replyToTweet(tweetId, replyMessage);
        logger.info({ userId, username }, "✅ Waitlist confirmation reply sent");
      } catch (replyError) {
        logger.debug({ replyError }, "Waitlist reply failed (not critical)");
        
        // Send DM as fallback
        try {
          await this.sendDM(userId, replyMessage.replace(`@${username} `, ''));
          logger.info({ userId, username }, "✅ Waitlist confirmation sent via DM");
        } catch (dmError) {
          logger.error({ dmError, userId }, "Failed to send waitlist confirmation DM");
        }
      }

      logger.info({ userId, username, alreadyOnWaitlist: result.alreadyOnWaitlist }, "✅ Waitlist signup completed");

    } catch (error) {
      logger.error({ error, userId, username }, "Error handling waitlist signup");
      
      // Mark as error
      await this.mentionTracker.markAsProcessed(
        tweetId,
        userId,
        username,
        'waitlist_error',
        tweetText
      );
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
