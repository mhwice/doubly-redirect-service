// import { Env } from ".";
// import { Redis } from "@upstash/redis/cloudflare";

// export async function redisFetch(code: string, env: Env) {
//   const redis = Redis.fromEnv(env);
//   const beforeRedis = performance.now();
//   await redis.get(code);
//   const redisLatency = performance.now() - beforeRedis;
//   return redisLatency;
// }

// export async function kvFetch(code: string, env: Env) {
//   const beforeKV = performance.now();
//   await env.DOUBLY_KV.get(code);
//   const kvLatency = performance.now() - beforeKV;
//   return kvLatency;
// }
