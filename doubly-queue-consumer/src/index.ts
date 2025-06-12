import { neon } from '@neondatabase/serverless';
import { PayloadSchema } from "./schema";

export interface Env {
  QUEUE1: Queue<any>;
  QUEUE2: Queue<any>;
  QUEUE3: Queue<any>;
  QUEUE4: Queue<any>;
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
      console.error("failed to write clicks to neon", error);
    }
  },
} satisfies ExportedHandler<Env>;
