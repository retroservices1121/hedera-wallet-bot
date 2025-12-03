import { Pool, PoolClient } from "pg";
import { config } from "../config";
import { logger } from "../utils/logger";

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: config.environment === "production" ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err: Error) => {
  logger.error({ err }, "Unexpected database error");
  process.exit(1);
});

pool.on("connect", () => {
  logger.info("Database connection established");
});

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export async function closePool(): Promise<void> {
  await pool.end();
  logger.info("Database pool closed");
}
