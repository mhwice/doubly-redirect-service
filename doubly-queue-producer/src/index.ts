import { getKVLink, writeKV } from "./kv";
import { getLinkFromDB } from "./neon";
import { getRedisLink, updateRedisCache } from "./redis";

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

const USE_REDIS_CACHE = false; // if false, uses Cloudflare KV

export default {
	async fetch(request, env, ctx): Promise<Response> {

    // Parse code
    const code = extractCode(request);
    if (!code) return makeResponse();

    // Check cache for url
    const cachedLink = USE_REDIS_CACHE ? await getRedisLink(code, env) : await getKVLink(code, env);

    // If we have a cached link, write metadata, and redirect
    if (cachedLink) {
      const payload = {
        linkId: cachedLink.linkId,
        createdAt: new Date(),
        ...extractMetadata(request)
      };
      await env.QUEUE.send(payload);
      return makeResponse(cachedLink.originalUrl);
    }

    // If we do not have a cached link, hit the db
    const dbLink = await getLinkFromDB(code, env);
    if (!dbLink) return makeResponse();

    // Link exists in DB, but not in Cache, so we want to update the cache
    if (USE_REDIS_CACHE) {
      await updateRedisCache({ code, ...dbLink }, env);
    } else {
      await writeKV({ code, ...dbLink }, env);
    }

    const payload = {
      linkId: dbLink.linkId,
      createdAt: new Date(),
      ...extractMetadata(request)
    };

    await env.QUEUE.send(payload);

    return makeResponse(dbLink.originalUrl);
	},
} satisfies ExportedHandler<Env>;
