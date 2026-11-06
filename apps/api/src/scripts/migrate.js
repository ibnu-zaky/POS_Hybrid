"use strict";

require("dotenv").config();

const { Pool } = require("pg");

const ADMIN_DATABASE_URL = process.env.ADMIN_DATABASE_URL;
if (!ADMIN_DATABASE_URL) {
  console.error("ADMIN_DATABASE_URL environment variable is required for migrations.");
  console.error("Please set it to a PostgreSQL superuser connection string (e.g., postgresql://postgres:password@localhost:5432/pos_hybrid).");
  process.exit(1);
}
const pool = new Pool({
  connectionString: ADMIN_DATABASE_URL,
});

async function ensureSchemaMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedFilenames(client) {
  const result = await client.query(`SELECT filename FROM schema_migrations ORDER BY filename`);
  return result.rows.map((r) => r.filename);
}

async function applyMigration(client, filename) {
  const path = require("path");
  const migrationsDir = path.resolve(__dirname, "../../../..", "migrations");
  const fullPath = path.join(migrationsDir, filename);

  const sql = require("fs").readFileSync(fullPath, "utf8");

  await client.query(sql);
  console.log(`Applied migration: ${filename}`);
}

async function runMigrations() {
  console.log("Starting migrations...");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureSchemaMigrationsTable(client);
    const applied = await getAppliedFilenames(client);

    const migrationsDir = require("path").resolve(__dirname, "../../../..", "migrations");
    const files = require("fs")
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let appliedCount = 0;
    for (const filename of files) {
      if (applied.includes(filename)) {
        console.log(`Already applied: ${filename}`);
        continue;
      }
      await applyMigration(client, filename);
      await client.query(
        `INSERT INTO schema_migrations (filename) VALUES ($1)`, [filename],
      );
      appliedCount++;
    }

    await client.query("COMMIT");
    console.log(`Migrations done. Applied ${appliedCount} new migration(s).`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error.message);
    await pool.end();
    process.exit(1);
  } finally {
    client.release();
  }

  await pool.end();
}

runMigrations().catch((error) => {
  console.error("Fatal error running migrations:", error);
  process.exit(1);
});