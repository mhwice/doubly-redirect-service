import { z } from "zod";
import { Env } from ".";

const CacheSchema = z.object({
  originalUrl: z.string(),
  linkId: z.coerce.number()
})

interface CacheProps {
  code: string,
  originalUrl: string,
  linkId: number
}

// export async function getKVLink(code: string, env: Env) {
//   try {
//     const record = await env.DOUBLY_KV.get(code);
//     if (!record) return null;
//     let data = JSON.parse(record);
//     return CacheSchema.parse(data);
//   } catch (error) {
//     console.error("failed to read kv", error);
//     return null;
//   }
// }

export async function getKVLink(code: string, env: Env, retries: number = 3) {

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const record = await env.DOUBLY_KV.get(code);
      // Key not found → no need to retry
      if (record === null) return null;

      const data = JSON.parse(record);
      return CacheSchema.parse(data);
    } catch (error) {

      // On the last attempt, log and give up
      if (attempt === retries) {
        console.error(`getKVLink(${code}) failed after ${retries} attempts:`, error);
        return null;
      }

      const delay = 50 * 2 ** (attempt - 1);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}

export async function writeKV({ code, originalUrl, linkId }: CacheProps, env: Env) {
  try {
    const key = code;
    const payload = JSON.stringify({ originalUrl, linkId });
    await env.DOUBLY_KV.put(key, payload);
  } catch (error) {
    console.log("failed to write to kv", error);
  }
}
