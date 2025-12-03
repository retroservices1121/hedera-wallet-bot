// ============================================
// src/services/interactive-dm.handler.ts
// Interactive DM Auto-Responses
// ============================================

import { Pool } from "pg";
import { TwitterService } from "./twitter.service";
import { WalletService } from "./wallet.service";
import { dmTemplates } from "../utils/dm-templates";
import { logger } from "../utils/logger";

export class InteractiveDMHandler {
  private twitterService: TwitterService;
  private walletService: WalletService;
  private pool: Pool;

  constructor(twitterService: TwitterService, walletService: WalletService, pool: Pool) {
    this.twitterService = twitterService;
    this.walletService = walletService;
    this.pool = pool;
  }

  /**
   * Handle incoming DM from user
   * Detects keywords and sends appropriate response
   */
  async handleIncomingDM(dm: any): Promise<void> {
    const userId = dm.sender_id;
    const username = dm.sender.username;
    const messageText = dm.text.toLowerCase().trim();

    logger.info({ userId, username, messageText }, "Processing incoming DM");

    try {
      // Check for keyword matches and respond accordingly
      if (this.matchesKeyword(messageText, ["help", "menu", "options"])) {
        await this.sendResponse(userId, username, "helpMenu");
      } 
      else if (this.matchesKeyword(messageText, ["setup", "hashpack", "import", "1"])) {
        await this.sendResponse(userId, username, "setupHelp");
      } 
      else if (this.matchesKeyword(messageText, ["usdc", "buy", "get usdc", "2"])) {
        await this.sendResponse(userId, username, "usdcHelp");
      } 
      else if (this.matchesKeyword(messageText, ["lost key", "lost", "forgot", "4"])) {
        await this.sendResponse(userId, username, "lostKey");
      } 
      else if (this.matchesKeyword(messageText, ["human", "support", "help me", "8"])) {
        await this.sendResponse(userId, username, "humanSupport");
        await this.notifySupportTeam(userId, username, messageText);
      } 
      else if (this.matchesKeyword(messageText, ["new wallet"])) {
        await this.handleNewWalletRequest(userId, username);
      } 
      else {
        // Default: show help menu for unrecognized messages
        await this.sendResponse(userId, username, "helpMenu");
      }

      // Log interaction in database
      await this.pool.query(
        `INSERT INTO dm_interactions (user_id, username, message, response_type, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [userId, username, messageText, "auto_response"]
      );
    } catch (error) {
      logger.error({ error, userId }, "Error handling incoming DM");
    }
  }

  /**
   * Check if message contains any of the keywords
   */
  private matchesKeyword(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }

  /**
   * Send a response using a DM template
   */
  private async sendResponse(
    userId: string,
    username: string,
    templateName: keyof typeof dmTemplates
  ): Promise<void> {
    const message = dmTemplates[templateName](username);
    await this.twitterService.sendDM(userId, message);
    logger.info({ userId, templateName }, "Sent auto-response");
  }

  /**
   * Notify support team when user requests human help
   */
  private async notifySupportTeam(
    userId: string,
    username: string,
    message: string
  ): Promise<void> {
    // Log support request
    logger.info({ userId, username, message }, "Support ticket created");

    // TODO: Implement your notification system
    // Options:
    // - Send to Slack webhook
    // - Send to Discord webhook
    // - Send email alert
    // - Add to support ticket system

    // Example Slack notification:
    /*
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 Support Request from @${username}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*User:* @${username}\n*Message:* ${message}\n*User ID:* ${userId}`
            }
          }
        ]
      })
    });
    */
  }

  /**
   * Handle request for a new wallet
   * Implements rate limiting (once per 24 hours)
   */
  private async handleNewWalletRequest(userId: string, username: string): Promise<void> {
    try {
      // Check if user already requested new wallet recently
      const result = await this.pool.query(
        `SELECT created_at FROM wallets 
         WHERE twitter_user_id = $1 
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (result.rows.length > 0) {
        const lastWallet = new Date(result.rows[0].created_at);
        const hoursSince = (Date.now() - lastWallet.getTime()) / (1000 * 60 * 60);

        if (hoursSince < 24) {
          await this.twitterService.sendDM(
            userId,
            `Hey @${username}, you created a wallet ${Math.round(hoursSince)} hours ago! 

For security, we limit wallet creation to once per 24 hours.

Need help with your existing wallet? Reply "help"`
          );
          return;
        }
      }

      // Allow new wallet creation
      await this.twitterService.sendDM(
        userId,
        `Creating a new wallet for you, @${username}...

Give us 10 seconds! 🚀`
      );

      // Trigger wallet creation through the bot's normal flow
      // This would need to call the wallet creation logic
      logger.info({ userId, username }, "New wallet requested - manual follow-up needed");

      // Note: You might want to integrate this more deeply with your wallet service
      // For now, it just notifies the user and logs the request
    } catch (error) {
      logger.error({ error, userId }, "Error handling new wallet request");
    }
  }
}

export default InteractiveDMHandler;
