import { getKVLink, writeKV } from "./kv";
import { getLinkFromDB } from "./neon";
import { extractCodeFast, extractMetadata } from "./utils";

export interface Env {
  QUEUE: Queue<any>;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  DOUBLY_KV: KVNamespace;
  DATABASE_URL: string;
}

function makeResponse(url: string = "https://doubly.dev") {
  return new Response(null, { status: 301, headers: {
    "Location": url,
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  }});
}

export default {
	async fetch(request, env, ctx): Promise<Response> {

    // Parse code
    const { pathname } = new URL(request.url);
    const code = extractCodeFast(pathname);
    // const code = extractCode(request);
    if (!code) return makeResponse();

    // Check cache for url
    const cachedLink = await getKVLink(code, env);

    // If we have a cached link, write metadata, and redirect
    if (cachedLink) {
      const payload = {
        linkId: cachedLink.linkId,
        createdAt: new Date(),
        ...extractMetadata(request)
      };
      // await env.QUEUE.send(payload);
      ctx.waitUntil(env.QUEUE.send(payload).catch((error) => {
        console.error("queue send failed", error);
      }));

      return makeResponse(cachedLink.originalUrl);
    }

    // If we do not have a cached link, hit the db
    const dbLink = await getLinkFromDB(code, env);
    if (!dbLink) return makeResponse();

    // Link exists in DB, but not in Cache, so we want to update the cache
    await writeKV({ code, ...dbLink }, env);

    const payload = {
      linkId: dbLink.linkId,
      createdAt: new Date(),
      ...extractMetadata(request)
    };

    // await env.QUEUE.send(payload);
    ctx.waitUntil(env.QUEUE.send(payload).catch((error) => {
      console.error("queue send failed", error);
    }));

    return makeResponse(dbLink.originalUrl);
	},
} satisfies ExportedHandler<Env>;
