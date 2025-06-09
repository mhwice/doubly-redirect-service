import { UAParser } from "ua-parser-js";
import { z } from "zod";
import iso3166 from "iso-3166-2";

export const PayloadSchema = z.object({
  linkId: z.number(),
  createdAt: z.coerce.date(),
  ua: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  continent: z.string().optional(),
  url: z.string(),
}).transform((obj) => {

  const { linkId, createdAt, ua, latitude, longitude, city, region, country, continent, url } = obj;

  // extract from ua
  let browser, os, device;
  try {
    const parser = new UAParser(ua);
    const uaResult = parser.getResult();
    browser = uaResult.browser.name;
    os = uaResult.os.name;
    device = uaResult.device.type;
  } catch (error) {

  }

  const parsedUrl = new URL(url);
  const source = parsedUrl.searchParams.get("source");

  let parsedRegion = undefined;
    if (country && region) {
      // converts 'BC' to 'British Columbia'
      parsedRegion = iso3166.subdivision(country, region)?.name;
    }

    let parsedCountry = undefined;
    if (country) {
      // converts 'CA' to 'Canada'
      parsedCountry = iso3166.country(country)?.name;
    }

    let parsedContinent = undefined;
    if (continent) {
      switch (continent) {
        case 'NA':
          parsedContinent = 'North America';
          break;
        case 'EU':
          parsedContinent = 'Europe';
          break;
        case 'AF':
          parsedContinent = 'Africa';
          break;
        case 'AS':
          parsedContinent = 'Asia';
          break;
        case 'SA':
          parsedContinent = 'South America';
          break;
        case 'OC':
          parsedContinent = 'Oceania';
          break;
        case 'AN':
          parsedContinent = 'Antarctica';
          break;
        default:
          break;
      }
    }

  return {
    link_id: linkId,
    created_at: createdAt,
    source: source === "qr" ? "qr" : "link",
    latitude: latitude === undefined ? undefined : parseFloat(latitude),
    longitude: longitude === undefined ? undefined : parseFloat(longitude),
    city: city || "unknown",
    region: parsedRegion || "unknown",
    country: parsedCountry || "unknown",
    continent: parsedContinent || "unknown",
    browser: browser || "unknown",
    os: os || "unknown",
    device: device || "unknown"
  }
});
