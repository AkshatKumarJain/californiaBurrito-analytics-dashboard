import type { NextFunction, Request, RequestHandler, Response } from "express";

import { env } from "../config/env";
import { findUserById, verifyToken } from "../services/auth.service";

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim() || null;
}

async function attachUserInternal(req: Request): Promise<void> {
  const token = bearerToken(req.headers.authorization);
  if (!token) {
    return;
  }

  const tokenUser = verifyToken(token);
  if (!tokenUser) {
    return;
  }

  const user = await findUserById(tokenUser.id);
  if (user) {
    req.user = user;
  }
}

export const attachUser: RequestHandler = (req, _res, next) => {
  void attachUserInternal(req).then(() => next()).catch(next);
};

export const requireAuthIfEnabled: RequestHandler = (req, res, next) => {
  void attachUserInternal(req)
    .then(() => {
      if (!env.authRequired || req.user) {
        next();
        return;
      }

      res.status(401).json({
        message: "Authentication is required to access analytics.",
      });
    })
    .catch((error) => {
      next(error);
    });
};
