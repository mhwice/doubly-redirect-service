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
  QUEUE6: Queue<any>;
  QUEUE7: Queue<any>;
  QUEUE8: Queue<any>;
  QUEUE9: Queue<any>;
  QUEUE10: Queue<any>;
  QUEUE11: Queue<any>;
  QUEUE12: Queue<any>;
  QUEUE13: Queue<any>;
  QUEUE14: Queue<any>;
  QUEUE15: Queue<any>;
  QUEUE16: Queue<any>;
  QUEUE17: Queue<any>;
  QUEUE18: Queue<any>;
  QUEUE19: Queue<any>;
  QUEUE20: Queue<any>;
  QUEUE21: Queue<any>;
  QUEUE22: Queue<any>;
  QUEUE23: Queue<any>;
  QUEUE24: Queue<any>;
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
          populateWorkerCache(cacheKey, link, ctx, 180);
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
      const queue   = pickQueue(link.linkId, [
        env.QUEUE1,
        env.QUEUE2,
        env.QUEUE3,
        env.QUEUE4,
        env.QUEUE5,
        env.QUEUE6,
        env.QUEUE7,
        env.QUEUE8,
        env.QUEUE9,
        env.QUEUE10,
        env.QUEUE11,
        env.QUEUE12,
        env.QUEUE13,
        env.QUEUE14,
        env.QUEUE15,
        env.QUEUE16,
        env.QUEUE17,
        env.QUEUE18,
        env.QUEUE19,
        env.QUEUE20,
        env.QUEUE21,
        env.QUEUE22,
        env.QUEUE23,
        env.QUEUE24,
      ]);
      ctx.waitUntil(enqueueWithRetry(queue, payload));

      return makeResponse(link.originalUrl);

    } catch (error) {
      console.error("unexpected error", error);
      return makeResponse();
    }
  },
} satisfies ExportedHandler<Env>;
