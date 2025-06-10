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

  const record = await env.DOUBLY_KV.get(code);
  if (!record) return null;

  let data;
  try {
    data = JSON.parse(record);
  } catch (error) {
    data = null;
  }

  const validated = CacheSchema.safeParse(data);
  if (!validated.success) return null;

  return validated.data;
}

export async function writeKV({ code, originalUrl, linkId }: CacheProps, env: Env) {
  const key = code;
  const payload = JSON.stringify({ originalUrl, linkId });
  await env.DOUBLY_KV.put(key, payload);
}
