#!/usr/bin/env node
/**
 * Apply Dynaxis platform SQL migrations to PostgreSQL.
 * Usage: DATABASE_URL=postgres://... npm run db:migrate
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      '[dynaxis-db-migrate] DATABASE_URL is required. Example:\n' +
        '  DATABASE_URL=postgresql://user:pass@localhost:5432/dynaxis npm run db:migrate'
    );
    process.exit(1);
  }

  const drizzleDir = path.join(__dirname, '..', 'drizzle');
  const files = fs
    .readdirSync(drizzleDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.error('[dynaxis-db-migrate] No .sql files in drizzle/');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS dynaxis_schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    for (const file of files) {
      const rows = await sql`
        SELECT count(*)::int AS count FROM dynaxis_schema_migrations WHERE filename = ${file}
      `;
      if (rows[0].count > 0) {
        console.log(`[dynaxis-db-migrate] skip ${file} (already applied)`);
        continue;
      }
      const body = fs.readFileSync(path.join(drizzleDir, file), 'utf8');
      console.log(`[dynaxis-db-migrate] applying ${file}...`);
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`INSERT INTO dynaxis_schema_migrations (filename) VALUES (${file})`;
      });
      console.log(`[dynaxis-db-migrate] applied ${file}`);
    }
    console.log('[dynaxis-db-migrate] done');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('[dynaxis-db-migrate] failed:', err.message || err);
  process.exit(1);
});
