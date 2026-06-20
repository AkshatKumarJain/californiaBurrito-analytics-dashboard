import type { Request, Response } from "express";
import { z } from "zod";

import { env } from "../config/env";
import { loginUser, registerUser } from "../services/auth.service";

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(180),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email().max(180),
  password: z.string().min(1).max(128),
});

export async function registerController(req: Request, res: Response): Promise<void> {
  if (!env.authAllowRegistration) {
    res.status(403).json({
      message: "Registration is disabled.",
    });
    return;
  }

  const input = registerSchema.parse(req.body);

  try {
    res.status(201).json(await registerUser(input));
  } catch (error) {
    if (error instanceof Error && error.message.includes("Duplicate")) {
      res.status(409).json({
        message: "An account already exists for this email.",
      });
      return;
    }

    throw error;
  }
}

export async function loginController(req: Request, res: Response): Promise<void> {
  const input = loginSchema.parse(req.body);
  const result = await loginUser(input);

  if (!result) {
    res.status(401).json({
      message: "Invalid email or password.",
    });
    return;
  }

  res.json(result);
}

export async function meController(req: Request, res: Response): Promise<void> {
  res.json({
    user: req.user ?? null,
    authRequired: env.authRequired,
    authAllowRegistration: env.authAllowRegistration,
  });
}
