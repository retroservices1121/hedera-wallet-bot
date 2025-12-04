// ============================================
// FIXED: src/services/interactive-dm.handler.ts
// Fixed unused variable and function call errors
// ============================================

import { Pool } from "pg";
import { TwitterService } from "./twitter.service";
import { WalletService } from "./wallet.service";
import { dmTemplates } from "../utils/dm-templates";
import { logger } from "../utils/logger";

export class InteractiveDMHandler {
  private twitterService: TwitterService;
  private walletService: WalletService; // FIX: Keep this even if unused for now
  private pool: Pool;

  constructor(twitterService: TwitterService, walletService: WalletService, pool: Pool) {
    this.twitterService = twitterService;
    this.walletService = walletService;
    this.pool = pool;
  }

  async handleIncomingDM(dm: any): Promise<void> {
    const userId = dm.sender_id;
    const username = dm.sender.username;
    const messageText = dm.text.toLowerCase().trim();

    logger.info({ userId, username, messageText }, "Processing incoming DM");

    try {
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
        await this.sendResponse(userId, username, "helpMenu");
      }

      await this.pool.query(
        `INSERT INTO dm_interactions (user_id, username, message, response_type, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [userId, username, messageText, "auto_response"]
      );
    } catch (error) {
      logger.error({ error, userId }, "Error handling incoming DM");
    }
  }

  private matchesKeyword(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }

  private async sendResponse(
    userId: string,
    username: string,
    templateName: keyof typeof dmTemplates
  ): Promise<void> {
    // FIX: Call dmTemplates function with correct number of arguments
    let message: string;
    
    // Most templates only need username
    if (
      templateName === "helpMenu" ||
      templateName === "setupHelp" ||
      templateName === "usdcHelp" ||
      templateName === "lostKey" ||
      templateName === "humanSupport"
    ) {
      message = (dmTemplates[templateName] as (username: string) => string)(username);
    } else {
      // For other templates, we might need different arguments
      // For now, default to helpMenu if unknown
      message = dmTemplates.helpMenu(username);
    }
    
    await this.twitterService.sendDM(userId, message);
    logger.info({ userId, templateName }, "Sent auto-response");
  }

  private async notifySupportTeam(
    userId: string,
    username: string,
    message: string
  ): Promise<void> {
    logger.info({ userId, username, message }, "Support ticket created");
    
    // TODO: Implement your notification system
    // Example: Send to Slack, Discord, or email
  }

  private async handleNewWalletRequest(userId: string, username: string): Promise<void> {
    try {
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

      await this.twitterService.sendDM(
        userId,
        `Creating a new wallet for you, @${username}...

Give us 10 seconds! 🚀`
      );

      logger.info({ userId, username }, "New wallet requested - manual follow-up needed");
    } catch (error) {
      logger.error({ error, userId }, "Error handling new wallet request");
    }
  }
}

export default InteractiveDMHandler;
