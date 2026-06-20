import fs from "node:fs/promises";
import path from "node:path";

import mysql from "mysql2/promise";

import { env } from "../config/env";
import { getConnectionOptions, pool } from "./pool";

function quoteIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function ensureDatabaseExists(): Promise<void> {
  if (env.databaseUrl) {
    return;
  }

  const connection = await mysql.createConnection(getConnectionOptions(false));
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(
        env.dbName,
      )} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }
}

export async function runMigrations(): Promise<void> {
  await ensureDatabaseExists();

  const schemaPath = path.resolve(process.cwd(), "database", "schema.sql");
  const schemaSql = await fs.readFile(schemaPath, "utf8");
  const statements = splitSqlStatements(schemaSql);

  for (const statement of statements) {
    await pool.query(statement);
  }
}
