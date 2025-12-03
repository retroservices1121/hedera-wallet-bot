import { PrivateKey } from "@hashgraph/sdk";
import { pool } from "../database";
import { logger } from "../utils/logger";
import { encryptPrivateKey, hashPassword, generatePassword } from "../utils/crypto.utils";

export interface HederaWallet {
  privateKey: string;
  publicKey: string;
  accountAlias: string;
  evmAddress: string;
}

export interface WalletRecord {
  id: number;
  twitter_user_id: string;
  twitter_username: string;
  private_key_encrypted: string;
  public_key: string;
  account_alias: string;
  evm_address: string;
  password_hash: string;
  created_at: Date;
  activated: boolean;
  activation_tx_id?: string;
}

export class WalletService {
  async generateWallet(): Promise<HederaWallet> {
    try {
      const privateKey = PrivateKey.generateED25519();
      const publicKey = privateKey.publicKey;

      return {
        privateKey: privateKey.toString(),
        publicKey: publicKey.toString(),
        accountAlias: `0.0.${publicKey.toString()}`,
        evmAddress: publicKey.toEvmAddress(),
      };
    } catch (error) {
      logger.error({ error }, "Failed to generate wallet");
      throw new Error("WALLET_GENERATION_FAILED");
    }
  }

  async hasWallet(userId: string): Promise<boolean> {
    const result = await pool.query(
      "SELECT EXISTS(SELECT 1 FROM wallets WHERE twitter_user_id = $1)",
      [userId]
    );
    return result.rows[0].exists;
  }

  async getWallet(userId: string): Promise<WalletRecord | null> {
    const result = await pool.query("SELECT * FROM wallets WHERE twitter_user_id = $1", [userId]);
    return result.rows[0] || null;
  }

  async createWallet(userId: string, username: string): Promise<{ wallet: WalletRecord; password: string }> {
    const wallet = await this.generateWallet();
    const password = generatePassword(12);
    const encryptedKey = encryptPrivateKey(wallet.privateKey, password);
    const passwordHash = hashPassword(password);

    try {
      const result = await pool.query(
        `INSERT INTO wallets (
          twitter_user_id, twitter_username, private_key_encrypted,
          public_key, account_alias, evm_address, password_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [userId, username, encryptedKey, wallet.publicKey, wallet.accountAlias, wallet.evmAddress, passwordHash]
      );

      await this.logAudit(userId, "WALLET_CREATED", {
        username,
        account_alias: wallet.accountAlias,
      });

      return {
        wallet: result.rows[0],
        password,
      };
    } catch (error: any) {
      if (error.code === "23505") {
        throw new Error("WALLET_ALREADY_EXISTS");
      }
      throw error;
    }
  }

  async getWalletCount(): Promise<number> {
    const result = await pool.query("SELECT COUNT(*) FROM wallets");
    return parseInt(result.rows[0].count);
  }

  async getTodayWalletCount(): Promise<number> {
    const result = await pool.query(
      "SELECT COUNT(*) FROM wallets WHERE created_at >= NOW() - INTERVAL '1 day'"
    );
    return parseInt(result.rows[0].count);
  }

  async getAllWallets(): Promise<WalletRecord[]> {
    const result = await pool.query("SELECT * FROM wallets ORDER BY created_at ASC");
    return result.rows;
  }

  async checkRateLimit(userId: string, action: string, limitPerDay: number): Promise<boolean> {
    const result = await pool.query(
      `SELECT COUNT(*) FROM rate_limits
       WHERE twitter_user_id = $1
       AND action = $2
       AND created_at >= NOW() - INTERVAL '1 day'`,
      [userId, action]
    );

    return parseInt(result.rows[0].count) < limitPerDay;
  }

  async recordRateLimit(userId: string, action: string): Promise<void> {
    await pool.query("INSERT INTO rate_limits (twitter_user_id, action) VALUES ($1, $2)", [userId, action]);
  }

  async logAudit(userId: string, action: string, details: any): Promise<void> {
    await pool.query("INSERT INTO audit_log (twitter_user_id, action, details) VALUES ($1, $2, $3)", [
      userId,
      action,
      details,
    ]);
  }

  async updateDMSentTime(userId: string): Promise<void> {
    await pool.query("UPDATE wallets SET last_dm_sent_at = NOW() WHERE twitter_user_id = $1", [userId]);
  }

  async markPreLaunchDMSent(userId: string): Promise<void> {
    await pool.query("UPDATE wallets SET pre_launch_dm_sent_at = NOW() WHERE twitter_user_id = $1", [userId]);
  }

  async markLaunchDMSent(userId: string): Promise<void> {
    await pool.query("UPDATE wallets SET launch_dm_sent_at = NOW() WHERE twitter_user_id = $1", [userId]);
  }
}
