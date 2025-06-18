import { getKVLink, writeKV } from "./kv";
import { getLinkFromDB } from "./neon";
import { enqueueWithRetry, extractCodeFast, makePayload, makeResponse, pickQueue, populateWorkerCache } from "./utils";
import { Link, LinkSchema } from "./schemas";

export interface Env {
  QUEUE1: Queue<any>;
  QUEUE2: Queue<any>;
  QUEUE3: Queue<any>;
  QUEUE4: Queue<any>;
  QUEUE5: Queue<any>;
  DOUBLY_KV: KVNamespace;
  DATABASE_URL: string;
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url  = new URL(request.url);
      const code = extractCodeFast(url.pathname);
      if (!code) return makeResponse();

      // 1. Try in-memory Worker cache
      const cacheKey = new Request(`https://doubly.dev/${code}`);
      let link: Link | null = null;

      const cachedResp = await caches.default.match(cacheKey);
      if (cachedResp) {
        const validated = LinkSchema.safeParse(await cachedResp.json());
        if (validated.success) link = validated.data;
      }

      // 2. Fallback to KV
      if (!link) {
        const kv = await getKVLink(code, env);
        if (kv) {
          link = kv;
          populateWorkerCache(cacheKey, link, ctx);
        }
      }

      if (!link) {
        // 3. Fallback to DB
        const dbLink = await getLinkFromDB(code, env);
        if (dbLink) {
          link = dbLink;
          ctx.waitUntil(writeKV({ code, ...dbLink }, env));
          populateWorkerCache(cacheKey, link, ctx);
        }
      }

      // No link at all
      if (!link) return makeResponse();

      // 4. Enqueue + redirect
      const payload = makePayload(link, request);
      const queue   = pickQueue(link.linkId, [env.QUEUE1, env.QUEUE2, env.QUEUE3, env.QUEUE4, env.QUEUE5]);
      ctx.waitUntil(enqueueWithRetry(queue, payload));

      return makeResponse(link.originalUrl);

    } catch (error) {
      console.error("unexpected error", error);
      return makeResponse();
    }
  },
} satisfies ExportedHandler<Env>;
