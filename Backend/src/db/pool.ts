import mysql, { type PoolOptions } from "mysql2/promise";

import { env } from "../config/env";

export function getConnectionOptions(includeDatabase = true): PoolOptions {
  const ssl = env.dbSsl
    ? {
        rejectUnauthorized: env.dbSslRejectUnauthorized,
      }
    : undefined;

  if (env.databaseUrl) {
    return {
      uri: env.databaseUrl,
      waitForConnections: true,
      connectionLimit: 8,
      maxIdle: 4,
      idleTimeout: 60_000,
      enableKeepAlive: true,
      decimalNumbers: true,
      ssl,
    };
  }

  return {
    host: env.dbHost,
    port: env.dbPort,
    user: env.dbUser,
    password: env.dbPassword,
    database: includeDatabase ? env.dbName : undefined,
    waitForConnections: true,
    connectionLimit: 8,
    maxIdle: 4,
    idleTimeout: 60_000,
    enableKeepAlive: true,
    decimalNumbers: true,
    dateStrings: true,
    ssl,
  };
}

export const pool = mysql.createPool(getConnectionOptions(true));

export async function pingDatabase(): Promise<void> {
  await pool.query("SELECT 1 AS ok");
}
