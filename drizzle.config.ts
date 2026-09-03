import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle-postgres',
  schema: './db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://farmlog:farmlog@127.0.0.1:5432/farmlog',
  },
});
