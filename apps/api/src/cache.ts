import { Redis } from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3
});

export async function getJson<T>(key: string): Promise<T | null> {
    const value = await redis.get(key);

    if (!value) {
        return null;
    }

    return JSON.parse(value) as T;
}

export async function setJson(
    key: string,
    value: unknown,
    ttlSeconds: number
) {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}