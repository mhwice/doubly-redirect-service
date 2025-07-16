import { Link } from "./schemas";

const CODE_REGEX = /^[0-9A-Za-z]{12}$/;

export function extractCodeFast(pathname: string) {
  if (pathname.length !== 13 || pathname[0] !== "/") return null;
  const code = pathname.slice(1);
  return CODE_REGEX.test(code) ? code : null;
}

export function extractCode(request: Request<unknown, IncomingRequestCfProperties<unknown>>) {
  const url = new URL(request.url);
  const path = url.pathname;
  const chunks = path.split("/");
  if (chunks.length !== 2) return null;
  const code = chunks[1];
  if (!code || !isCode(code)) return null;
  return code;
}

function isCode(code: string) {
  const allowedChars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const allowedLen = 12;
  const regex = new RegExp(`^[${allowedChars}]{${allowedLen}}$`);
  return regex.test(code);
}

export function extractMetadata(request: Request) {
  try {
    return {
      url: request.url,
      continent: request.cf?.continent,
      country: request.cf?.country,
      region: request.cf?.regionCode,
      city: request.cf?.city,
      latitude: request.cf?.latitude,
      longitude: request.cf?.longitude,
      ua: request.headers.get("User-Agent")
    }
  } catch (error) {
    console.error("failed to extract metadata", error);
    throw new Error();
  }
}

export async function enqueueWithRetry<T>( queue: Queue<T>, payload: T, retries = 3): Promise<void> {
  for (let i = 1; i <= retries; i += 1) {
    try {
      await queue.send(payload);
      return;

    } catch (err) {
      console.error(`queue.send attempt #${i} failed:`, err);
      // back off a bit before retrying
      const backoffMs = 50 * 2 ** (i - 1);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
}

export async function populateWorkerCache(cacheKey: Request, link: Link, ctx: ExecutionContext, ttlSeconds = 60) {
  try {
    const body = JSON.stringify(link);
    const resp = new Response(body, {
      headers: { "Cache-Control": `max-age=${ttlSeconds}` }
    });
    // Kick off the put asynchronously
    ctx.waitUntil(caches.default.put(cacheKey, resp.clone()));
  } catch (error) {
    console.error("failed to write to cache", error);
  }
}

export function makePayload(link: Link, request: Request) {
  const eventId = request.headers.get("cf-ray")!;
  return {
    linkId:    link.linkId,
    createdAt: new Date().toISOString(),
    eventId,
    ...extractMetadata(request),
  };
}

export function pickQueue(linkId: number, queues: Queue<any>[]) {
  return queues[linkId % queues.length];
}

export function makeResponse(url: string = "https://doubly.dev") {
  return new Response(null, { status: 301, headers: {
    "Location": url,
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  }});
}
