import { getKVLink, writeKV } from "./kv";
import { getLinkFromDB } from "./neon";
import { extractCodeFast, extractMetadata } from "./utils";

export interface Env {
  QUEUE1: Queue<any>;
  QUEUE2: Queue<any>;
  QUEUE3: Queue<any>;
  QUEUE4: Queue<any>;
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

// FNV-1a 32-bit hash
// function fnv1a(str: string): number {
//   let hash = 0x811c9dc5;
//   for (let i = 0; i < str.length; i++) {
//     hash ^= str.charCodeAt(i);
//     hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
//   }
//   return hash >>> 0;
// }

export default {
	async fetch(request, env, ctx): Promise<Response> {

    try {
      // Parse code
      const { pathname } = new URL(request.url);
      const code = extractCodeFast(pathname);
      if (!code) return makeResponse();

      // Check cache for url
      const cachedLink = await getKVLink(code, env);

      // Define queues
      const queues = [env.QUEUE1, env.QUEUE2, env.QUEUE3, env.QUEUE4];

      // If we have a cached link, write metadata, and redirect
      if (cachedLink) {
        const payload = {
          linkId: cachedLink.linkId,
          createdAt: new Date().toISOString(),
          ...extractMetadata(request)
        };

        // Get random queue
        // const hash = fnv1a(String(cachedLink.linkId));
        // const idx = hash % queues.length;
        const idx = cachedLink.linkId % queues.length;
        const queue = queues[idx];

        ctx.waitUntil(queue.send(payload).catch((error) => {
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
        createdAt: new Date().toISOString(),
        ...extractMetadata(request)
      };

      // Get random queue
      // const hash = fnv1a(String(dbLink.linkId));
      // const idx = hash % queues.length;
      const idx = dbLink.linkId % queues.length;
      const queue = queues[idx];

      ctx.waitUntil(queue.send(payload).catch((error) => {
        console.error("queue send failed", error);
      }));

      return makeResponse(dbLink.originalUrl);
    } catch (error) {
      console.error("unexpected error", error);
      return makeResponse();
    }

	},
} satisfies ExportedHandler<Env>;

/*

I am using Grafana K6 to test my Cloudflare-based app. My app is a url-shortener. For my tests, I want to see if my app can sustain a constant load of 10,000 requests/s for a few minutes.
Currently, Cloudflare queues have a max ops/s of 5000. For this reason, I have decided to use multiple queues in a round-robin fashion. That is, I have my 'producer' worker that takes in a request which has a query parameter called 'iter'.
In my worker, I map this 'iter' to a queue and then send the event to that queue. Notice that my events created_at field is set here in the producer.

producers index.ts:

import { getKVLink, writeKV } from "./kv";
import { getLinkFromDB } from "./neon";
import { extractCodeFast, extractMetadata } from "./utils";

export interface Env {
  QUEUE1: Queue<any>;
  QUEUE2: Queue<any>;
  QUEUE3: Queue<any>;
  QUEUE4: Queue<any>;
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
    if (!code) return makeResponse();

    // Parse iteration
    const iter = new URL(request.url).searchParams.get("iter");
    if (!iter) return makeResponse();

    // Get random queue
    const queues = [env.QUEUE1, env.QUEUE2, env.QUEUE3, env.QUEUE4];
    const NUM_QUEUES = queues.length;
    let idx = parseInt(iter) % NUM_QUEUES;
    const queue = queues[idx];

    // Check cache for url
    const cachedLink = await getKVLink(code, env);

    // If we have a cached link, write metadata, and redirect
    if (cachedLink) {
      const payload = {
        linkId: cachedLink.linkId,
        createdAt: new Date(),
        ...extractMetadata(request)
      };

      ctx.waitUntil(queue.send(payload).catch((error) => {
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

    ctx.waitUntil(queue.send(payload).catch((error) => {
      console.error("queue send failed", error);
    }));

    return makeResponse(dbLink.originalUrl);
	},
} satisfies ExportedHandler<Env>;

Then, inside my consumer worker I read events in batches, and write them to my Neon hosted TimescaleDB Hypertable.

consumers index.ts

import { neon } from '@neondatabase/serverless';
import { PayloadSchema } from "./schema";

export interface Env {
  QUEUE: Queue<any>;
  DATABASE_URL: string;
}

export default {
  async queue(batch, env): Promise<void> {

    try {
      const sql = neon(env.DATABASE_URL);

      // validate messages, discard bad ones
      const validatedMessages = [];
      for (const message of batch.messages) {
        const payload = message.body;
        const validated = PayloadSchema.safeParse(payload);
        if (!validated.success) continue;
        validatedMessages.push(validated.data);
      }

      if (validatedMessages.length === 0) return;

      const keys = ["link_id","created_at","source","latitude","longitude","city","region","country","continent","browser","os","device"];
      const perRow = keys.length;
      const placeholders = validatedMessages.map((_, rowIdx) => {
        const start = rowIdx * perRow + 1;
        const placeholders = Array(perRow).fill(null).map((_, i) => `$${start + i}`)
        return `(${placeholders.join(', ')})`;
      }).join(', ');

      const query = `
        INSERT INTO click_events (${keys})
        VALUES ${placeholders}
        RETURNING *;
      `;

      const values = validatedMessages.flatMap(msg =>
        keys.map(key => (msg as Record<string, unknown>)[key])
      );

      const response = await sql(query, values);
      console.log(`Successfully wrote ${response.length} events to DB`);
    } catch (error) {
      console.log("failed to write clicks to neon", error);
    }
  },
} satisfies ExportedHandler<Env>;

I have several questions about this entire process.
1. how do I configure my consumer to read batches from any of the queues?
2. can you forsee any problems I will have with this setup? in my grafana k6 test script I will increment the value
   of iter for every query.
3. each events created_at field is set inside the producer. this means that when a batch of events is read from one queue and inserted into the database,
  there will be events inside other queues with a slightly earlier created_at value (up to 5s earlier). Is this a problem?

*/
