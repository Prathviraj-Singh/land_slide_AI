import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

// Ensure .env is loaded in all runtime contexts
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { loadEnvConfig } = require("@next/env");
  loadEnvConfig(process.cwd());
} catch {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const host = process.env.DATABASE_HOST || "localhost";
const port = parseInt(process.env.DATABASE_PORT || "3306", 10);
const user = process.env.DATABASE_USER || "root";
const password = process.env.DATABASE_PASSWORD || "";
const database = process.env.DATABASE_NAME || "landslideshield";

export const pool = mysql.createPool({
  host,
  port,
  user,
  password,
  database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "+00:00",
});

/**
 * Execute parameterized SQL query against the MySQL pool.
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T> {
  try {
    const [results] = await pool.execute(sql, params);
    return results as T;
  } catch (error: any) {
    console.error(`[DB Error] Query failed: ${sql}`, error.message);
    throw error;
  }
}
