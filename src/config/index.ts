import dotenv from "dotenv";
dotenv.config();

export interface Config {
  gameApiKey: string;
  gameTwitterToken: string;
  databaseUrl: string;
  operatorAccountId?: string;
  operatorPrivateKey?: string;
  usdcTokenId: string;
  encryptionKey: string;              // ADD THIS
  claimTokenSecret: string;            // ADD THIS
  environment: "development" | "staging" | "production";
  port: number;
  maxWalletsPerUser: number;
  maxWalletsPerDay: number;
  logLevel: string;
  launchDate?: Date;
}

function validateEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);  // FIX: Parentheses not backtick
  }
  return value;
}

function getOptionalEnv(key: string): string | undefined {  // ADD THIS HELPER
  return process.env[key];
}

export const config: Config = {
  gameApiKey: validateEnv("GAME_API_KEY"),
  gameTwitterToken: validateEnv("GAME_TWITTER_ACCESS_TOKEN"),
  databaseUrl: validateEnv("DATABASE_URL"),
  operatorAccountId: process.env.OPERATOR_ACCOUNT_ID,
  operatorPrivateKey: process.env.OPERATOR_PRIVATE_KEY,
  usdcTokenId: validateEnv("USDC_TOKEN_ID"),
  
  // ADD THESE TWO LINES:
  encryptionKey: validateEnv("ENCRYPTION_KEY"),
  claimTokenSecret: getOptionalEnv("CLAIM_TOKEN_SECRET") || validateEnv("ENCRYPTION_KEY"),
  
  environment: (process.env.NODE_ENV as any) || "development",
  port: parseInt(process.env.PORT || "3000"),
  maxWalletsPerUser: parseInt(process.env.MAX_WALLETS_PER_USER || "1"),
  maxWalletsPerDay: parseInt(process.env.MAX_WALLETS_PER_DAY || "1000"),
  logLevel: process.env.LOG_LEVEL || "info",
  launchDate: process.env.LAUNCH_DATE ? new Date(process.env.LAUNCH_DATE) : undefined,
};
