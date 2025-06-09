import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { Env } from ".";

const LinkSchema = z.object({
  id: z.number().nonnegative().lt(2_147_483_648),
  original_url: z.string().trim().min(1).max(255).url(),
});

export async function getLinkFromDB(code: string, env: Env) {
  const sql = neon(env.DATABASE_URL);

  const query = `
    SELECT *
    FROM links
    WHERE code = $1
  `;

  const response = await sql(query, [code]);
  if (!response) return null;
  if (response.length !== 1) return null;
  const validated = LinkSchema.safeParse(response[0]);
  if (!validated.success) return null;
  return { linkId: validated.data.id, originalUrl: validated.data.original_url };
}
