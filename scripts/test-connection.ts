import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

async function testConnection(): Promise<void> {
  console.log("🔍 Testing database connection...");
  console.log("DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 40) + "...");
  console.log();

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

  try {
    // Test basic connection
    console.log("📡 Connecting to database...");
    const result = await pool.query("SELECT NOW() as time, version() as version");
    console.log("✅ Connection successful!");
    console.log();
    console.log("📊 Database Info:");
    console.log("  Time:", result.rows[0].time);
    console.log("  Version:", result.rows[0].version.split(",")[0]);
    console.log();

    // Test if tables exist
    console.log("📋 Checking tables...");
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    if (tables.rows.length === 0) {
      console.log("⚠️  No tables found.");
      console.log("   Run 'npm run setup-db' to create tables.");
    } else {
      console.log("✅ Found tables:");
      tables.rows.forEach((row) => {
        console.log(`   - ${row.table_name}`);
      });
    }
    console.log();

    // Test wallet count if table exists
    if (tables.rows.some((row) => row.table_name === "wallets")) {
      const count = await pool.query("SELECT COUNT(*) FROM wallets");
      const today = await pool.query(
        "SELECT COUNT(*) FROM wallets WHERE created_at >= NOW() - INTERVAL '1 day'"
      );
      console.log("📈 Statistics:");
      console.log(`   Total wallets: ${count.rows[0].count}`);
      console.log(`   Wallets today: ${today.rows[0].count}`);
    }

    console.log();
    console.log("✅ All checks passed!");
  } catch (error: any) {
    console.error("❌ Connection failed!");
    console.error("Error:", error.message);
    console.log();
    console.log("💡 Troubleshooting:");
    console.log("   1. Check DATABASE_URL in .env");
    console.log("   2. Verify database is running");
    console.log("   3. Check firewall/network settings");
    console.log("   4. Verify SSL settings");
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();
