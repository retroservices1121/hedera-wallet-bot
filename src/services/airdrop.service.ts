```typescript
// src/services/airdrop.service.ts

import { Client, TransferTransaction, Hbar } from "@hashgraph/sdk";
import { Pool } from "pg";
import { logger } from "../utils/logger";
import { WalletTrackingService } from "./wallet-tracking.service";

export class AirdropService {
  constructor(
    private db: Pool,
    private client: Client,
    private walletTracker: WalletTrackingService
  ) {}

  async sendTokenAirdrop(
    tokenId: string,
    amountPerWallet: number,
    minimumBalance = 1
  ): Promise {
    try {
      logger.info("Starting token airdrop...");
      
      const fundedWallets = await this.walletTracker.getFundedWalletsForAirdrop(minimumBalance);
      
      if (fundedWallets.length === 0) {
        logger.info("No funded wallets found for airdrop");
        return { success: 0, failed: 0 };
      }

      logger.info(`Sending airdrop to ${fundedWallets.length} wallets`);
      
      let successCount = 0;
      let failedCount = 0;

      for (const wallet of fundedWallets) {
        try {
          const transaction = await new TransferTransaction()
            .addTokenTransfer(tokenId, this.client.operatorAccountId!, -amountPerWallet)
            .addTokenTransfer(tokenId, wallet.account_id, amountPerWallet)
            .execute(this.client);
          
          const receipt = await transaction.getReceipt(this.client);
          
          if (receipt.status.toString() === "SUCCESS") {
            await this.db.query(`
              UPDATE wallets 
              SET airdrop_sent = TRUE, airdrop_sent_at = NOW()
              WHERE account_id = $1
            `, [wallet.account_id]);
            
            logger.info(`✅ Airdrop sent to @${wallet.twitter_username}`);
            successCount++;
          }
        } catch (error) {
          logger.error(`Failed to airdrop to ${wallet.account_id}:`, error);
          failedCount++;
        }
      }

      logger.info(`Airdrop complete: ${successCount} success, ${failedCount} failed`);
      return { success: successCount, failed: failedCount };
    } catch (error) {
      logger.error("Error in sendTokenAirdrop:", error);
      throw error;
    }
  }
}
```
