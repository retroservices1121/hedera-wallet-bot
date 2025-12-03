import { TwitterService } from "./twitter.service";
import { WalletService } from "./wallet.service";
import { dmTemplates } from "../utils/dm-templates";
import { logger } from "../utils/logger";

export class InteractiveDMHandler {
  private twitterService: TwitterService;
  private walletService: WalletService;

  constructor(twitterService: TwitterService, walletService: WalletService) {
    this.twitterService = twitterService;
    this.walletService = walletService;
  }

  async handleIncomingDM(dm: any): Promise<void> {
    const userId = dm.sender_id;
    const username = dm.sender.username;
    const messageText = dm.text.toLowerCase().trim();

    logger.info({ userId, username, messageText }, "Processing incoming DM");

    try {
      if (this.matchesKeyword(messageText, ["help", "menu", "options"])) {
        await this.twitterService.sendDM(userId, dmTemplates.helpMenu(username));
      }
      // Add more handlers as needed
    } catch (error) {
      logger.error({ error, userId }, "Error handling incoming DM");
    }
  }

  private matchesKeyword(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }
}
