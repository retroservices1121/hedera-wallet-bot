import dotenv from "dotenv";
dotenv.config();

import { pool } from "../src/database";
import { runMigrations } from "../src/database/migrations";
import { logger } from "../src/utils/logger";

async function setupDatabase(): Promise<void> {
  logger.info("Starting database setup...");

  try {
    // Test connection
    logger.info("Testing database connection...");
    await pool.query("SELECT NOW()");
    logger.info("✅ Database connection successful");

    // Run migrations
    logger.info("Running migrations...");
    await runMigrations();
    logger.info("✅ Migrations completed");

    // Verify tables
    logger.info("Verifying tables...");
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    logger.info("Created tables:");
    tables.rows.forEach((row) => {
      logger.info(`  - ${row.table_name}`);
    });

    // Check table counts
    const walletCount = await pool.query("SELECT COUNT(*) FROM wallets");
    logger.info(`Current wallet count: ${walletCount.rows[0].count}`);

    logger.info("✅ Database setup completed successfully!");
  } catch (error) {
    logger.error({ error }, "Database setup failed");
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();
