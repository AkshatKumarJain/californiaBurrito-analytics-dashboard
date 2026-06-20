import crypto from "node:crypto";

import Redis from "ioredis";

import { env } from "../config/env";

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const CACHE_PREFIX = "analytics:v1";
const memoryCache = new Map<string, CacheEntry<unknown>>();
let redisClient: Redis | null = null;
let redisUnavailable = false;
let redisConnectPromise: Promise<Redis | null> | null = null;

function normalizeKey(key: string): string {
  const hash = crypto.createHash("sha1").update(key).digest("hex");
  return `${CACHE_PREFIX}:${hash}`;
}

function shouldUseRedis(): boolean {
  return Boolean(env.redisUrl) && env.cacheProvider !== "memory" && !redisUnavailable;
}

async function getRedisClient(): Promise<Redis | null> {
  if (!shouldUseRedis()) {
    return null;
  }

  if (redisClient?.status === "ready") {
    return redisClient;
  }

  if (!redisClient) {
    redisClient = new Redis(env.redisUrl!, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2500,
      enableReadyCheck: true,
    });

    redisClient.on("error", (error) => {
      redisUnavailable = true;
      console.warn(`Redis cache unavailable: ${error.message}`);
    });
  }

  if (redisConnectPromise) {
    return redisConnectPromise;
  }

  const status = redisClient.status as string;

  if (status === "ready") {
    return redisClient;
  }

  if (status === "connecting" || status === "connect") {
    redisConnectPromise = new Promise<Redis | null>((resolve) => {
      const finish = () => {
        redisConnectPromise = null;
        resolve((redisClient?.status as string) === "ready" ? redisClient : null);
      };

      redisClient!.once("ready", finish);
      redisClient!.once("end", finish);
      redisClient!.once("close", finish);
      redisClient!.once("error", finish);
    });

    return redisConnectPromise;
  }

  try {
    redisConnectPromise = redisClient.connect().then(() => redisClient);
    const result = await redisConnectPromise;
    redisConnectPromise = null;
    return result && (result.status as string) === "ready" ? result : null;
  } catch (error) {
    redisConnectPromise = null;
    redisUnavailable = true;
    console.warn(
      `Redis cache disabled, falling back to memory: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return (redisClient.status as string) === "ready" ? redisClient : null;
  }
}

export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  resolveValue: () => Promise<T>,
): Promise<T> {
  const normalizedKey = normalizeKey(key);
  const now = Date.now();
  const memoryHit = memoryCache.get(normalizedKey) as CacheEntry<T> | undefined;

  if (memoryHit && memoryHit.expiresAt > now) {
    return memoryHit.value;
  }

  const redis = await getRedisClient();
  if (redis) {
    const cachedJson = await redis.get(normalizedKey);
    if (cachedJson) {
      const value = JSON.parse(cachedJson) as T;
      memoryCache.set(normalizedKey, {
        value,
        expiresAt: now + Math.min(ttlSeconds, 10) * 1000,
      });
      return value;
    }
  }

  const value = await resolveValue();
  memoryCache.set(normalizedKey, {
    value,
    expiresAt: now + ttlSeconds * 1000,
  });

  if (redis) {
    await redis.set(normalizedKey, JSON.stringify(value), "EX", ttlSeconds);
  }

  return value;
}

export async function clearCache(): Promise<void> {
  memoryCache.clear();

  const redis = await getRedisClient();
  if (!redis) {
    return;
  }

  const keys = await redis.keys(`${CACHE_PREFIX}:*`);
  if (keys.length > 0) {
    await redis.del(keys);
  }
}

export async function getCacheStatus(): Promise<{
  provider: "redis" | "memory";
  status: "connected" | "fallback" | "disabled";
}> {
  if (!env.redisUrl || env.cacheProvider === "memory") {
    return { provider: "memory", status: "disabled" };
  }

  const redis = await getRedisClient();
  if ((redis?.status as string | undefined) === "ready") {
    return { provider: "redis", status: "connected" };
  }

  return { provider: "memory", status: "fallback" };
}
