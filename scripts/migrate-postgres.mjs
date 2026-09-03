import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDirectory = join(projectRoot, 'drizzle-postgres');
const connectionString = process.env.DATABASE_URL?.trim();
const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME?.trim();

if (!connectionString && !instanceConnectionName && !process.env.PGHOST) {
  throw new Error(
    'DATABASE_URL 또는 INSTANCE_CONNECTION_NAME/PGHOST 데이터베이스 연결 정보가 필요합니다.',
  );
}

const pool = new Pool({
  connectionString: connectionString || undefined,
  host: connectionString
    ? undefined
    : instanceConnectionName
      ? `/cloudsql/${instanceConnectionName}`
      : process.env.PGHOST,
  port: connectionString ? undefined : Number(process.env.PGPORT || '5432'),
  user: connectionString ? undefined : process.env.PGUSER,
  password: connectionString ? undefined : process.env.PGPASSWORD,
  database: connectionString ? undefined : process.env.PGDATABASE,
  max: 1,
  ssl:
    connectionString && process.env.PGSSLMODE === 'require'
      ? { rejectUnauthorized: false }
      : undefined,
});

const client = await pool.connect();
try {
  await client.query('SELECT pg_advisory_lock(734091132)');
  await client.query(`
    CREATE TABLE IF NOT EXISTS _farmlog_migrations (
      name TEXT PRIMARY KEY,
      applied_at BIGINT NOT NULL
    )
  `);

  const files = (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const name of files) {
    const applied = await client.query(
      'SELECT 1 FROM _farmlog_migrations WHERE name = $1',
      [name],
    );
    if (applied.rowCount) continue;

    const source = await readFile(join(migrationsDirectory, name), 'utf8');
    const statements = source
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean);

    await client.query('BEGIN');
    try {
      for (const statement of statements) await client.query(statement);
      await client.query(
        'INSERT INTO _farmlog_migrations (name, applied_at) VALUES ($1, $2)',
        [name, Date.now()],
      );
      await client.query('COMMIT');
      console.log(`Applied ${name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client.query('SELECT pg_advisory_unlock(734091132)').catch(() => {});
  client.release();
  await pool.end();
}
