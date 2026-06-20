import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env";
import { requireAuthIfEnabled } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { authRouter } from "./routes/auth.routes";
import { analyticsRouter } from "./routes/analytics.routes";
import { healthRouter } from "./routes/health.routes";

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  return env.corsOrigins.includes("*") || env.corsOrigins.includes(origin);
}

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, isAllowedOrigin(origin));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_req, res) => {
    res.json({
      name: "California Burrito Analytics API",
      status: "running",
      docs: "/api/health",
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/health", healthRouter);
  app.use("/api/analytics", requireAuthIfEnabled, analyticsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
