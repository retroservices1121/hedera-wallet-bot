```typescript
// src/services/wallet-tracking.service.ts

import { Client, AccountBalanceQuery } from "@hashgraph/sdk";
import { Pool } from "pg";
import { logger } from "../utils/logger";

export class WalletTrackingService {
  constructor(
    private db: Pool,
    private client: Client
  ) {}

  async updateWalletBalances(): Promise {
    try {
      logger.info("Starting wallet balance check...");
      
      const unfundedWallets = await this.db.query(`
        SELECT account_id, account_alias, twitter_username 
        FROM wallets 
        WHERE is_funded = FALSE AND account_id IS NOT NULL
        ORDER BY created_at DESC
      `);

      let fundedCount = 0;

      for (const wallet of unfundedWallets.rows) {
        try {
          const balance = await this.getWalletBalance(wallet.account_id);
          
          if (balance > 0) {
            await this.db.query(`
              UPDATE wallets 
              SET is_funded = TRUE, 
                  current_balance = $1, 
                  last_balance_check = NOW()
              WHERE account_id = $2
            `, [balance, wallet.account_id]);
            
            logger.info(`✅ Wallet ${wallet.account_id} (@${wallet.twitter_username}) funded with ${balance} HBAR`);
            fundedCount++;
          }
        } catch (error) {
          logger.error(`Error checking wallet ${wallet.account_id}:`, error);
        }
      }

      logger.info(`Balance check complete: ${fundedCount} newly funded wallets`);
      return fundedCount;
    } catch (error) {
      logger.error("Error in updateWalletBalances:", error);
      throw error;
    }
  }

  async getWalletBalance(accountId: string): Promise {
    try {
      const balance = await new AccountBalanceQuery()
        .setAccountId(accountId)
        .execute(this.client);
      
      return balance.hbars.toBigNumber().toNumber();
    } catch (error) {
      logger.error(`Error getting balance for ${accountId}:`, error);
      return 0;
    }
  }

  async getWalletStats() {
    try {
      const result = await this.db.query(`SELECT * FROM wallet_stats`);
      return result.rows[0];
    } catch (error) {
      logger.error("Error getting wallet stats:", error);
      throw error;
    }
  }

  async getFundedWalletsForAirdrop(minimumBalance = 0): Promise {
    try {
      const result = await this.db.query(`
        SELECT 
          account_id, 
          twitter_username, 
          twitter_user_id,
          current_balance,
          created_at
        FROM wallets 
        WHERE is_funded = TRUE 
          AND airdrop_sent = FALSE
          AND current_balance >= $1
        ORDER BY created_at ASC
      `, [minimumBalance]);
      
      return result.rows;
    } catch (error) {
      logger.error("Error getting funded wallets:", error);
      throw error;
    }
  }
}
```
