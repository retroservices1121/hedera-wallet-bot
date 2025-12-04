// ============================================
// FIXED: src/services/wallet-tracking.service.ts
// Clean version without syntax errors
// ============================================

import { Pool } from "pg";
import { Client, AccountBalanceQuery } from "@hashgraph/sdk";
import { logger } from "../utils/logger";

export class WalletTrackingService {
  private pool: Pool;
  private client: Client;

  constructor(pool: Pool, hederaClient: Client) {
    this.pool = pool;
    this.client = hederaClient;
  }

  /**
   * Update balance for all unfunded wallets
   * Returns number of newly funded wallets
   */
  async updateWalletBalances(): Promise<number> {
    try {
      const result = await this.pool.query(
        `SELECT id, account_id, twitter_username 
         FROM wallets 
         WHERE account_id IS NOT NULL 
         AND is_funded = FALSE`
      );

      let newlyFundedCount = 0;

      for (const wallet of result.rows) {
        try {
          const balance = await this.checkBalance(wallet.account_id);
          
          await this.pool.query(
            `UPDATE wallets 
             SET current_balance = $1, 
                 last_balance_check = NOW(),
                 is_funded = $2
             WHERE id = $3`,
            [balance, balance > 0, wallet.id]
          );

          if (balance > 0) {
            newlyFundedCount++;
            logger.info(`Wallet ${wallet.account_id} (@${wallet.twitter_username}) funded with ${balance} HBAR`);
          }
        } catch (error) {
          logger.error(`Failed to check balance for ${wallet.account_id}:`, error);
        }
      }

      return newlyFundedCount;
    } catch (error) {
      logger.error("Failed to update wallet balances:", error);
      throw error;
    }
  }

  /**
   * Check balance of a Hedera account
   */
  async checkBalance(accountId: string): Promise<number> {
    try {
      const balance = await new AccountBalanceQuery()
        .setAccountId(accountId)
        .execute(this.client);

      return balance.hbars.toBigNumber().toNumber();
    } catch (error) {
      logger.error(`Failed to check balance for ${accountId}:`, error);
      return 0;
    }
  }

  /**
   * Get funded wallets ready for airdrop
   */
  async getFundedWalletsForAirdrop(minBalance: number = 1): Promise<any[]> {
    try {
      const result = await this.pool.query(
        `SELECT id, account_id, twitter_user_id, twitter_username, current_balance
         FROM wallets 
         WHERE is_funded = TRUE 
         AND airdrop_sent = FALSE
         AND current_balance >= $1`,
        [minBalance]
      );

      return result.rows;
    } catch (error) {
      logger.error("Failed to get funded wallets:", error);
      throw error;
    }
  }

  /**
   * Get wallet statistics
   */
  async getWalletStats(): Promise<any> {
    try {
      const result = await this.pool.query(`
        SELECT 
          COUNT(*) as total_wallets,
          COUNT(*) FILTER (WHERE is_funded = TRUE) as funded_wallets,
          COUNT(*) FILTER (WHERE is_funded = FALSE) as unfunded_wallets,
          COUNT(*) FILTER (WHERE airdrop_sent = TRUE) as airdropped_wallets,
          COALESCE(SUM(current_balance), 0) as total_balance_hbar
        FROM wallets
      `);

      return result.rows[0];
    } catch (error) {
      logger.error("Failed to get wallet stats:", error);
      throw error;
    }
  }
}
