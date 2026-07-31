import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  // drizzle-kit generate does not need a live DB; migrate does.
  console.warn('[drizzle] DATABASE_URL not set — generate still works; migrate requires it.');
}

export default defineConfig({
  schema: [
    './lib/dynaxis/db/schema.js',
    './lib/dynaxis/auth/schema.js',
    './lib/dynaxis/identity/schema.js',
    './lib/dynaxis/provider-connections/schema.js',
    './lib/dynaxis/secrets/schema.js',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/dynaxis',
  },
  strict: true,
  verbose: true,
});
