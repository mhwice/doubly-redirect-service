import { Redis } from "@upstash/redis/cloudflare";
import { z } from "zod";
import { Env } from ".";

function shortCodeKey(code: string) {
  return `short:${code}`;
}

const CacheSchema = z.object({
  originalUrl: z.string(),
  linkId: z.coerce.number()
})

export async function getRedisLink(code: string, env: Env): Promise<{ originalUrl: string; linkId: number } | null> {
  try {
    const redis = Redis.fromEnv(env);
    const data = await redis.hgetall(shortCodeKey(code));
    if (!data) return null;
    return CacheSchema.parse(data);
  } catch (error) {
    console.log("failed to read from redis", error);
    return null;
  }
}

export interface PayloadProps {
  linkId: number,
  createdAt: Date,
  source: string;
  city: string;
  continent: string;
  country: string;
  latitude: number | undefined;
  longitude: number | undefined;
  region: string;
  browser: string;
  os: string;
  device: string;
}

export async function writeToStream(payload: PayloadProps, env: Env) {
  try {
    const redis = Redis.fromEnv(env);

    const events: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (v === undefined) continue;
      if (v instanceof Date) {
        events[k] = v.toISOString();
      } else {
        events[k] = String(v);
      }
    }

    await redis.xadd('click_events', '*', events);
  } catch (error) {
    console.log("failed to write to stream", error);
  }
}

export interface CacheProps {
  code: string,
  originalUrl: string,
  linkId: number
}

export async function updateRedisCache({ code, originalUrl, linkId }: CacheProps, env: Env) {
  try {
    const redis = Redis.fromEnv(env);
    await redis.hset(shortCodeKey(code), { originalUrl, linkId });
  } catch (error) {
    console.log("failed to write to cache", error);
  }
}
