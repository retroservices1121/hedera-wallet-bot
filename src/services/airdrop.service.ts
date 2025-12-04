// ============================================
// FIXED: src/services/airdrop.service.ts
// Clean version without syntax errors
// ============================================

import { Pool } from "pg";
import { Client, TransferTransaction, TokenId, AccountId } from "@hashgraph/sdk";
import { logger } from "../utils/logger";
import { WalletTrackingService } from "./wallet-tracking.service";

export class AirdropService {
  private pool: Pool;
  private client: Client;
  private tracker: WalletTrackingService;

  constructor(pool: Pool, hederaClient: Client, tracker: WalletTrackingService) {
    this.pool = pool;
    this.client = hederaClient;
    this.tracker = tracker;
  }

  /**
   * Send token airdrop to funded wallets
   */
  async sendTokenAirdrop(
    tokenId: string,
    amountPerWallet: number,
    minBalance: number = 1
  ): Promise<number> {
    try {
      const wallets = await this.tracker.getFundedWalletsForAirdrop(minBalance);
      
      if (wallets.length === 0) {
        logger.info("No wallets ready for airdrop");
        return 0;
      }

      logger.info(`Sending airdrop to ${wallets.length} wallets`);

      let successCount = 0;

      for (const wallet of wallets) {
        try {
          await this.sendTokens(tokenId, wallet.account_id, amountPerWallet);
          
          await this.pool.query(
            `UPDATE wallets 
             SET airdrop_sent = TRUE, 
                 airdrop_sent_at = NOW() 
             WHERE id = $1`,
            [wallet.id]
          );

          successCount++;
          logger.info(`Airdrop sent to ${wallet.twitter_username} (${wallet.account_id})`);
        } catch (error) {
          logger.error(`Failed to airdrop to ${wallet.account_id}:`, error);
        }
      }

      return successCount;
    } catch (error) {
      logger.error("Failed to send token airdrop:", error);
      throw error;
    }
  }

  /**
   * Send tokens to an account
   */
  private async sendTokens(
    tokenId: string,
    recipientAccountId: string,
    amount: number
  ): Promise<void> {
    const transaction = new TransferTransaction()
      .addTokenTransfer(TokenId.fromString(tokenId), this.client.operatorAccountId!, -amount)
      .addTokenTransfer(TokenId.fromString(tokenId), AccountId.fromString(recipientAccountId), amount)
      .freezeWith(this.client);

    const response = await transaction.execute(this.client);
    await response.getReceipt(this.client);
  }
}
