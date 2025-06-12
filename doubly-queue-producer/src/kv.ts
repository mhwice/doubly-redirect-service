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

export async function getKVLink(code: string, env: Env) {
  try {
    const record = await env.DOUBLY_KV.get(code);
    if (!record) return null;
    let data = JSON.parse(record);
    return CacheSchema.parse(data);
  } catch (error) {
    console.error("failed to read kv", error);
    return null;
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
