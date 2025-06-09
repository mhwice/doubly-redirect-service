import { neon } from '@neondatabase/serverless';
import { PayloadSchema } from "./schema";

export interface Env {
  QUEUE: Queue<any>;
  DATABASE_URL: string;
}

export default {
  async queue(batch, env): Promise<void> {

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

    const keys = Array.from(Object.keys(validatedMessages[0]));
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
      // for each message, pull out its columns in the same order as `keys`
      keys.map(key => (msg as Record<string, unknown>)[key])
    );

    const response = await sql(query, values);
    console.log(`response: ${JSON.stringify(response)}`);
  },
} satisfies ExportedHandler<Env>;

/*

linkId:

123,
ua:

"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0",
longitude:

"-123.68596",
latitude:

"48.84133",
city:

"North Cowichan",
region:

"BC",
country:

"CA",
continent:

"NA",
url:

"https://doubly-queue-producer.redis-emphatic073.workers.dev/6iqHtcKDQZ3V",
createdAt:

"2025-06-09T21:31:19.743Z",



*/
