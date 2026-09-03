import { Pool, types, type PoolClient, type QueryResult } from 'pg';

types.setTypeParser(20, Number);
types.setTypeParser(1700, Number);

type QueryExecutor = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export type DatabaseRunResult = {
  success: boolean;
  meta: { changes: number };
  results: unknown[];
};

export type DatabaseAllResult<T> = {
  success: boolean;
  results: T[];
};

function poolOptions() {
  const connectionString = process.env.DATABASE_URL?.trim();
  const instanceConnectionName =
    process.env.INSTANCE_CONNECTION_NAME?.trim();
  const socketHost = instanceConnectionName
    ? `/cloudsql/${instanceConnectionName}`
    : undefined;

  if (!connectionString && !socketHost && !process.env.PGHOST) {
    throw new Error(
      'PostgreSQL 연결 정보가 없습니다. DATABASE_URL 또는 INSTANCE_CONNECTION_NAME과 PGUSER, PGPASSWORD, PGDATABASE를 설정해 주세요.',
    );
  }

  return {
    connectionString: connectionString || undefined,
    host: connectionString ? undefined : socketHost || process.env.PGHOST,
    port: connectionString
      ? undefined
      : Number(process.env.PGPORT || '5432'),
    user: connectionString ? undefined : process.env.PGUSER,
    password: connectionString ? undefined : process.env.PGPASSWORD,
    database: connectionString ? undefined : process.env.PGDATABASE,
    max: Number(process.env.DB_POOL_MAX || '5'),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl:
      connectionString && process.env.PGSSLMODE === 'require'
        ? { rejectUnauthorized: false }
        : undefined,
  };
}

declare global {
  var __farmlogPostgresPool: Pool | undefined;
}

function getPool() {
  globalThis.__farmlogPostgresPool ??= new Pool(poolOptions());
  return globalThis.__farmlogPostgresPool;
}

function normalizeSql(source: string) {
  const original = source.trim().replace(/;\s*$/, '');
  if (/^PRAGMA\b/i.test(original) || /^CREATE\s+TRIGGER\b/i.test(original)) {
    return { sql: '', noop: true };
  }

  const ignoreConflicts = /^INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(original);
  let sql = original.replace(
    /^INSERT\s+OR\s+IGNORE\s+INTO\b/i,
    'INSERT INTO',
  );
  let parameter = 0;
  sql = sql.replace(/\?/g, () => `$${++parameter}`);
  if (ignoreConflicts) sql += ' ON CONFLICT DO NOTHING';
  return { sql, noop: false };
}

function mapDatabaseError(error: unknown): never {
  if (error && typeof error === 'object') {
    const value = error as { code?: string; constraint?: string };
    if (
      value.code === '23505' &&
      value.constraint?.includes('farm_records_farm_project')
    ) {
      throw new Error('FARM_RECORD_PROJECT_EXISTS');
    }
  }
  throw error;
}

export class DatabasePreparedStatement {
  constructor(
    private readonly sourceSql: string,
    private readonly parameters: unknown[] = [],
  ) {}

  bind(...parameters: unknown[]) {
    return new DatabasePreparedStatement(this.sourceSql, parameters);
  }

  private async execute(executor: QueryExecutor = getPool()) {
    const normalized = normalizeSql(this.sourceSql);
    if (normalized.noop) {
      return { rows: [], rowCount: 0 } as Pick<QueryResult, 'rows' | 'rowCount'>;
    }
    try {
      return await executor.query(normalized.sql, this.parameters);
    } catch (error) {
      return mapDatabaseError(error);
    }
  }

  async all<T>(): Promise<DatabaseAllResult<T>> {
    const result = await this.execute();
    return { success: true, results: result.rows as T[] };
  }

  async first<T>(): Promise<T | null> {
    const result = await this.execute();
    return (result.rows[0] as T | undefined) ?? null;
  }

  async run(): Promise<DatabaseRunResult> {
    const result = await this.execute();
    return {
      success: true,
      meta: { changes: result.rowCount ?? 0 },
      results: result.rows,
    };
  }

  async executeWith(executor: QueryExecutor): Promise<DatabaseRunResult> {
    const result = await this.execute(executor);
    return {
      success: true,
      meta: { changes: result.rowCount ?? 0 },
      results: result.rows,
    };
  }
}

export class DatabaseClient {
  prepare(sql: string) {
    return new DatabasePreparedStatement(sql);
  }

  async batch(statements: DatabasePreparedStatement[]) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const results: DatabaseRunResult[] = [];
      for (const statement of statements) {
        results.push(await statement.executeWith(client));
      }
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

let database: DatabaseClient | undefined;

export function getDb() {
  return getPool();
}

export function getD1() {
  database ??= new DatabaseClient();
  return database;
}

export async function closeDatabase() {
  if (!globalThis.__farmlogPostgresPool) return;
  await globalThis.__farmlogPostgresPool.end();
  globalThis.__farmlogPostgresPool = undefined;
}
