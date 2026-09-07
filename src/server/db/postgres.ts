import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

// Parse DATABASE_URL or build configuration
const connectionString = process.env.DATABASE_URL;

export interface DbStatus {
  isPostgresConnected: boolean;
  poolTotalCount: number;
  poolIdleCount: number;
  poolWaitingCount: number;
  error?: string;
}

let pool: pg.Pool | null = null;
let isConnected = false;
let lastError: string | null = null;

if (connectionString) {
  try {
    pool = new Pool({
      connectionString,
      max: 25, // Optimized connection pool for multi-instance scaling
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: process.env.DATABASE_SSL === 'true' || connectionString.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : false,
    });

    pool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]:', err.message);
      isConnected = false;
      lastError = err.message;
    });
  } catch (err: any) {
    console.error('[PostgreSQL Init Error]:', err.message);
    lastError = err.message;
  }
} else {
  console.info('[PostgreSQL]: DATABASE_URL not set in environment. Ready for connection when supplied.');
}

/**
 * Executes a parameterized SQL query against PostgreSQL with connection pooling.
 * Prevents SQL Injection through parameter binding ($1, $2, etc.)
 */
export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  if (!pool) {
    throw new Error('PostgreSQL pool is not initialized. Please configure DATABASE_URL.');
  }
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (duration > 500) {
      console.warn(`[Slow Query] ${duration}ms: ${text.substring(0, 100)}`);
    }
    isConnected = true;
    return res;
  } catch (err: any) {
    lastError = err.message;
    throw err;
  }
}

/**
 * Runs a transactional block with BEGIN, COMMIT, and automatic ROLLBACK on error.
 */
export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  if (!pool) {
    throw new Error('PostgreSQL pool is not initialized. Please configure DATABASE_URL.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Applies database schema on initialization
 */
export async function initPostgresSchema(): Promise<boolean> {
  if (!pool) return false;

  try {
    const schemaSqlPath = path.join(process.cwd(), 'src', 'server', 'db', 'schema.sql');
    if (!fs.existsSync(schemaSqlPath)) {
      console.error('[PostgreSQL]: schema.sql not found at', schemaSqlPath);
      return false;
    }
    const sql = fs.readFileSync(schemaSqlPath, 'utf8');
    await pool.query(sql);
    isConnected = true;
    console.log('[PostgreSQL]: Schema initialized successfully.');
    return true;
  } catch (err: any) {
    console.error('[PostgreSQL Init Schema Error]:', err.message);
    lastError = err.message;
    return false;
  }
}

/**
 * Checks PostgreSQL health status
 */
export async function checkPostgresHealth(): Promise<DbStatus> {
  if (!pool) {
    return {
      isPostgresConnected: false,
      poolTotalCount: 0,
      poolIdleCount: 0,
      poolWaitingCount: 0,
      error: 'DATABASE_URL not configured',
    };
  }

  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    isConnected = true;
    return {
      isPostgresConnected: true,
      poolTotalCount: pool.totalCount,
      poolIdleCount: pool.idleCount,
      poolWaitingCount: pool.waitingCount,
    };
  } catch (err: any) {
    isConnected = false;
    lastError = err.message;
    return {
      isPostgresConnected: false,
      poolTotalCount: pool.totalCount,
      poolIdleCount: pool.idleCount,
      poolWaitingCount: pool.waitingCount,
      error: err.message,
    };
  }
}

export const dbPool = pool;
