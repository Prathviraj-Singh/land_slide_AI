import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

/**
 * Execute parameterized SQL query against the PostgreSQL pool.
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T> {
  try {
    const res = await pool.query(sql, params);
    const rows: any = res.rows || [];
    if (rows && rows.length > 0 && rows[0].id !== undefined) {
      rows.insertId = rows[0].id;
    }
    rows.rowCount = res.rowCount;
    return rows as T;
  } catch (error: any) {
    console.error(`[DB Error] Query failed: ${sql}`, error.message);
    throw error;
  }
}
