// src/services/wallet.service.ts - COMPLETE REPLACEMENT

import { 
  PrivateKey, 
  Client, 
  AccountCreateTransaction, 
  Hbar,
  AccountId 
} from "@hashgraph/sdk";
import { pool } from "../database";
import { logger } from "../utils/logger";
import { encryptPrivateKey, hashPassword, generatePassword } from "../utils/crypto.utils";
import { config } from "../config";

export interface HederaWallet {
  privateKey: string;
  publicKey: string;
  accountId?: string;
  accountAlias: string;
  evmAddress: string;
}

export interface WalletRecord {
  id: number;
  twitter_user_id: string;
  twitter_username: string;
  private_key_encrypted: string;
  public_key: string;
  account_id?: string;
  account_alias: string;
  evm_address: string;
  password_hash: string;
  created_at: Date;
  activated: boolean;
  activation_tx_id?: string;
}

export class WalletService {
  private client: Client | null = null;

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    try {
      if (!config.operatorAccountId || !config.operatorPrivateKey) {
        logger.warn("⚠️ Hedera operator credentials not set - using key-only mode");
        logger.warn("Set OPERATOR_ACCOUNT_ID and OPERATOR_PRIVATE_KEY to enable on-chain account creation");
        return;
      }

      logger.info("Initializing Hedera client for mainnet...");
      
      this.client = Client.forMainnet();
      this.client.setOperator(
        AccountId.fromString(config.operatorAccountId),
        PrivateKey.fromString(config.operatorPrivateKey)
      );
      
      logger.info(`✅ Hedera client initialized with operator: ${config.operatorAccountId}`);
    } catch (error) {
      logger.error("Failed to initialize Hedera client:", error);
      this.client = null;
    }
  }

  async generateWalletWithAccount(): Promise<HederaWallet> {
    if (!this.client || !this.client.operatorAccountId) {
      throw new Error(
        "Operator account not configured. Set OPERATOR_ACCOUNT_ID and OPERATOR_PRIVATE_KEY environment variables."
      );
    }

    try {
      logger.info("Generating new Hedera wallet with on-chain account...");
      
      const privateKey = PrivateKey.generateED25519();
      const publicKey = privateKey.publicKey;
      
      const transaction = await new AccountCreateTransaction()
        .setKey(publicKey)
        .setInitialBalance(new Hbar(0))
        .setMaxTransactionFee(new Hbar(5))
        .execute(this.client);
      
      const receipt = await transaction.getReceipt(this.client);
      const accountId = receipt.accountId;
      
      if (!accountId) {
        throw new Error("Failed to get account ID from receipt");
      }
      
      logger.info(`✅ On-chain account created: ${accountId.toString()}`);
      
      return {
        privateKey: privateKey.toString(),
        publicKey: publicKey.toString(),
        accountId: accountId.toString(),
        accountAlias: `0.0.${publicKey.toString()}`,
        evmAddress: publicKey.toEvmAddress(),
      };
    } catch (error: any) {
      logger.error("Failed to create on-chain account:", error);
      
      if (error.message?.includes("INSUFFICIENT_PAYER_BALANCE")) {
        throw new Error(
          "Operator account has insufficient HBAR. Fund your operator account with at least 10 HBAR."
        );
      } else if (error.message?.includes("INVALID_SIGNATURE")) {
        throw new Error(
          "Invalid operator private key. Check OPERATOR_PRIVATE_KEY environment variable."
        );
      }
      
      throw new Error(`Account creation failed: ${error.message || "Unknown error"}`);
    }
  }

  async generateWalletKeysOnly(): Promise<HederaWallet> {
    try {
      logger.info("Generating wallet keys (no on-chain account)...");
      
      const privateKey = PrivateKey.generateED25519();
      const publicKey = privateKey.publicKey;

      return {
        privateKey: privateKey.toString(),
        publicKey: publicKey.toString(),
        accountAlias: `0.0.${publicKey.toString()}`,
        evmAddress: publicKey.toEvmAddress(),
      };
    } catch (error) {
      logger.error("Failed to generate wallet keys:", error);
      throw new Error("WALLET_GENERATION_FAILED");
    }
  }

  async generateWallet(): Promise<HederaWallet> {
    try {
      if (this.client && this.client.operatorAccountId) {
        logger.info("Attempting on-chain account creation...");
        return await this.generateWalletWithAccount();
      } else {
        logger.warn("No operator configured - generating keys only");
        return await this.generateWalletKeysOnly();
      }
    } catch (error) {
      logger.error("Wallet generation failed:", error);
      throw error;
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
    try {
      logger.info(`Creating wallet for user ${username} (${userId})`);
      
      const wallet = await this.generateWallet();
      const password = generatePassword(12);
      const encryptedKey = encryptPrivateKey(wallet.privateKey, password);
      const passwordHash = hashPassword(password);

      const result = await pool.query(
        `INSERT INTO wallets (
          twitter_user_id, twitter_username, private_key_encrypted,
          public_key, account_id, account_alias, evm_address, password_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          userId, 
          username, 
          encryptedKey, 
          wallet.publicKey, 
          wallet.accountId || null,
          wallet.accountAlias, 
          wallet.evmAddress, 
          passwordHash
        ]
      );

      await this.logAudit(userId, "WALLET_CREATED", {
        username,
        account_id: wallet.accountId || null,
        account_alias: wallet.accountAlias,
        on_chain: !!wallet.accountId,
      });

      logger.info(`✅ Wallet created for ${username}: ${wallet.accountId || wallet.accountAlias}`);

      return {
        wallet: result.rows[0],
        password,
      };
    } catch (error: any) {
      logger.error(`Failed to create wallet for ${username}:`, error);
      
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

  async getOperatorBalance(): Promise<number | null> {
    if (!this.client || !this.client.operatorAccountId) {
      return null;
    }

    try {
      const { AccountBalanceQuery } = await import("@hashgraph/sdk");
      const balance = await new AccountBalanceQuery()
        .setAccountId(this.client.operatorAccountId)
        .execute(this.client);
      
      return balance.hbars.toBigNumber().toNumber();
    } catch (error) {
      logger.error("Failed to check operator balance:", error);
      return null;
    }
  }
}
