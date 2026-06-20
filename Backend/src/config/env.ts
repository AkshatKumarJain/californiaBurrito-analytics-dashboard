import "dotenv/config";

function readNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function readList(name: string, fallback: string[]): string[] {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: readNumber("PORT", 4000),
  databaseUrl: process.env.DATABASE_URL,
  dbHost: process.env.DB_HOST ?? "127.0.0.1",
  dbPort: readNumber("DB_PORT", 3306),
  dbUser: process.env.DB_USER ?? "root",
  dbPassword: process.env.DB_PASSWORD ?? "",
  dbName: process.env.DB_NAME ?? "california_burrito_analytics",
  dbSsl: readBoolean("DB_SSL", false),
  dbSslRejectUnauthorized: readBoolean("DB_SSL_REJECT_UNAUTHORIZED", true),
  corsOrigins: readList("CORS_ORIGIN", ["http://localhost:5173"]),
  cacheTtlSeconds: readNumber("CACHE_TTL_SECONDS", 60),
  cacheProvider: process.env.CACHE_PROVIDER ?? "auto",
  redisUrl: process.env.REDIS_URL,
  authRequired: readBoolean("AUTH_REQUIRED", false),
  authAllowRegistration: readBoolean("AUTH_ALLOW_REGISTRATION", true),
  jwtSecret:
    process.env.JWT_SECRET ??
    "dev-only-secret-change-before-enabling-auth-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "1d",
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-5-mini",
  importBatchSize: readNumber("IMPORT_BATCH_SIZE", 1000),
  dataFile: process.env.DATA_FILE,
};

export type AppEnv = typeof env;
