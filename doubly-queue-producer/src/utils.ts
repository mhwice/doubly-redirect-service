function extractCode(request: Request<unknown, IncomingRequestCfProperties<unknown>>) {
  const url = new URL(request.url);
  const path = url.pathname;
  const chunks = path.split("/");
  if (chunks.length !== 2) return null;
  const code = chunks.at(-1);
  if (!code || !isCode(code)) return null;
  return code;
}

function isCode(code: string) {
  const allowedChars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const allowedLen = 12;
  const regex = new RegExp(`^[${allowedChars}]{${allowedLen}}$`);
  return regex.test(code);
}

function extractMetadata(request: Request<unknown, IncomingRequestCfProperties<unknown>>) {
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
}
