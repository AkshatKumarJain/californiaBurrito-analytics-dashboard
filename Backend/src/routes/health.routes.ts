import { Router } from "express";

import { pingDatabase } from "../db/pool";
import { getCacheStatus } from "../utils/cache";
import { asyncHandler } from "../utils/async-handler";

export const healthRouter = Router();

healthRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const startedAt = Date.now();
    let database: "connected" | "unavailable" = "connected";

    try {
      await pingDatabase();
    } catch {
      database = "unavailable";
    }

    const cache = await getCacheStatus();

    res.json({
      status: database === "connected" ? "ok" : "degraded",
      database,
      cache,
      uptimeSeconds: Math.round(process.uptime()),
      latencyMs: Date.now() - startedAt,
    });
  }),
);
