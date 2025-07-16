import { neon } from '@neondatabase/serverless';
import { PayloadSchema } from "./schema";

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
  DATABASE_URL: string;
}

export default {
  async queue(batch, env): Promise<void> {

    try {
      const sql = neon(env.DATABASE_URL);

      // validate messages, discard bad ones
      const seen = new Set();
      const validatedMessages = [];
      for (const message of batch.messages) {
        const payload = message.body;
        const validated = PayloadSchema.safeParse(payload);
        if (!validated.success) continue;
        if (seen.has(validated.data.event_id)) continue;
        seen.add(validated.data.event_id);
        validatedMessages.push(validated.data);
      }

      if (validatedMessages.length === 0) {
        console.log(`Received: ${batch.messages.length}, Wrote: 0, Skipped: ${seen.size}`);
        return;
      }

      const keys = ["link_id","created_at","event_id","source","latitude","longitude","city","region","country","continent","browser","os","device"];
      const perRow = keys.length;
      const placeholders = validatedMessages.map((_, rowIdx) => {
        const start = rowIdx * perRow + 1;
        const placeholders = Array(perRow).fill(null).map((_, i) => `$${start + i}`)
        return `(${placeholders.join(', ')})`;
      }).join(', ');

      const columnList = keys.join(', ');
      const query = `
        INSERT INTO click_events (${columnList})
        VALUES ${placeholders}
        ON CONFLICT (created_at, event_id) DO NOTHING
        RETURNING *;
      `;

      const values = validatedMessages.flatMap((msg) =>
        keys.map((key) => (msg as Record<string, unknown>)[key])
      );

      const response = await sql(query, values);
      console.log(`Received: ${batch.messages.length}, Wrote: ${response.length}, Skipped: ${seen.size}`);
    } catch (error) {
      console.error("failed to write clicks to neon", error);
    }
  },
} satisfies ExportedHandler<Env>;



      // const keys = ["link_id","created_at","event_id","source","latitude","longitude","city","region","country","continent","browser","os","device"];
      // const keys = [
      //   "link_id", "created_at", "event_id", "source",
      //   "latitude", "longitude", "city", "region",
      //   "country", "continent", "browser", "os", "device"
      // ];
      // const casts = [
      //   "::int", "::timestamptz", "::text", "::source_type",
      //   "::real", "::real", "::varchar(63)", "::varchar(63)",
      //   "::varchar(63)", "::varchar(63)", "::varchar(63)", "::varchar(63)", "::varchar(63)"
      // ];
      // const perRow = keys.length;

      // const placeholders = validatedMessages.map((_, rowIdx) => {
      //   const start = rowIdx * perRow + 1;
      //   const placeholders = Array(perRow).fill(null).map((_, i) => `$${start + i}`)
      //   return `(${placeholders.join(', ')})`;
      // }).join(', ');

      // const placeholders = validatedMessages.map((_, rowIdx) => {
      //   const start = rowIdx * perRow + 1;
      //   const params = Array.from({ length: perRow }, (_, i) => {
      //     return `$${start + i}${casts[i]}`;
      //   });
      //   return `(${params.join(', ')})`;
      // }).join(',\n        ');

      // const query = `
      //   WITH to_insert AS (
      //     SELECT * FROM (
      //       VALUES ${placeholders}
      //     ) AS batch(${keys.join(', ')})
      //     WHERE NOT EXISTS (
      //       SELECT 1 FROM click_events ce
      //       WHERE ce.event_id = batch.event_id
      //     )
      //   )
      //   INSERT INTO click_events(${keys.join(', ')})
      //   SELECT ${keys.join(', ')} FROM to_insert
      //   ON CONFLICT (created_at, event_id) DO NOTHING
      //   RETURNING *;
      // `;


      // const values = [];
      // for (const msg of validatedMessages) {
      //   values.push(msg.link_id);
      //   values.push(msg.created_at);
      //   values.push(msg.event_id);
      //   values.push(msg.source);
      //   values.push(msg.latitude);
      //   values.push(msg.longitude);
      //   values.push(msg.city);
      //   values.push(msg.region);
      //   values.push(msg.country);
      //   values.push(msg.continent);
      //   values.push(msg.browser);
      //   values.push(msg.os);
      //   values.push(msg.device);
      // }

      // console.log(`About to run CTE‐filtered insert with ${validatedMessages.length} rows`);
      // console.log(`values: ${values}`);
      // console.log(`placeholders: ${placeholders}`);
      // console.log(`keys: ${keys}`);
      // console.log(`query: ${query}`);
