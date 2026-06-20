import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { RowDataPacket } from "mysql2";

import { env } from "../config/env";
import { pool } from "../db/pool";
import type { AuthUser } from "../types/auth";

interface UserRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: "admin" | "analyst";
}

interface UserCountRow extends RowDataPacket {
  totalUsers: number;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
  };
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
    },
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as {
      sub?: string;
      email?: string;
      name?: string;
      role?: "admin" | "analyst";
    };

    if (!payload.sub || !payload.email || !payload.role) {
      return null;
    }

    return {
      id: Number(payload.sub),
      name: payload.name ?? payload.email,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function findUserById(id: number): Promise<AuthUser | null> {
  const [rows] = await pool.query<UserRow[]>(
    `
      SELECT id, name, email, password_hash, role
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return rows[0] ? toAuthUser(rows[0]) : null;
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 12);
  const [countRows] = await pool.query<UserCountRow[]>(
    `SELECT COUNT(*) AS totalUsers FROM users`,
  );
  const role = (countRows[0]?.totalUsers ?? 0) === 0 ? "admin" : "analyst";

  await pool.query(
    `
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `,
    [input.name.trim(), email, passwordHash, role],
  );

  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error("Unable to create user.");
  }

  return {
    user,
    token: signToken(user),
  };
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<AuthResult | null> {
  const [rows] = await pool.query<UserRow[]>(
    `
      SELECT id, name, email, password_hash, role
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [input.email.trim().toLowerCase()],
  );
  const row = rows[0];

  if (!row) {
    return null;
  }

  const ok = await bcrypt.compare(input.password, row.password_hash);
  if (!ok) {
    return null;
  }

  const user = toAuthUser(row);
  return {
    user,
    token: signToken(user),
  };
}

async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const [rows] = await pool.query<UserRow[]>(
    `
      SELECT id, name, email, password_hash, role
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [email.trim().toLowerCase()],
  );

  return rows[0] ? toAuthUser(rows[0]) : null;
}
