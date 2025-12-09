// src/config/index.ts
import dotenv from "dotenv";
dotenv.config();

function validateEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string): string | undefined {
  return process.env[key];
}

export interface Config {
  gameApiKey: string;
  gameTwitterToken: string;
  databaseUrl: string;
  usdcTokenId: string;
  operatorAccountId?: string;
  operatorPrivateKey?: string;
  encryptionKey: string;
  claimTokenSecret: string;
  environment: "development" | "production";
  port: number;
  maxWalletsPerUser: number;
  maxWalletsPerDay: number;
  logLevel: string;
  launchDate?: Date;
}

export const config: Config = {
  // Required
  gameApiKey: validateEnv("GAME_API_KEY"),
  gameTwitterToken: validateEnv("GAME_TWITTER_ACCESS_TOKEN"),
  databaseUrl: validateEnv("DATABASE_URL"),
  usdcTokenId: validateEnv("USDC_TOKEN_ID"),
  
  // Encryption keys
  encryptionKey: validateEnv("ENCRYPTION_KEY"),
  claimTokenSecret: getOptionalEnv("CLAIM_TOKEN_SECRET") || validateEnv("ENCRYPTION_KEY"),
  
  // Optional - Hedera operator
  operatorAccountId: getOptionalEnv("OPERATOR_ACCOUNT_ID"),
  operatorPrivateKey: getOptionalEnv("OPERATOR_PRIVATE_KEY"),
  
  // Other config
  environment: (process.env.NODE_ENV as any) || "development",
  port: parseInt(process.env.PORT || "3000"),
  maxWalletsPerUser: parseInt(process.env.MAX_WALLETS_PER_USER || "1"),
  maxWalletsPerDay: parseInt(process.env.MAX_WALLETS_PER_DAY || "1000"),
  logLevel: process.env.LOG_LEVEL || "info",
  launchDate: process.env.LAUNCH_DATE ? new Date(process.env.LAUNCH_DATE) : undefined,
};

// Warnings
if (!config.operatorAccountId || !config.operatorPrivateKey) {
  console.warn("\n⚠️  WARNING: Hedera operator credentials not configured");
  console.warn("Set OPERATOR_ACCOUNT_ID and OPERATOR_PRIVATE_KEY to enable on-chain wallet creation\n");
}
