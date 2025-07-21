# Architecture

This document dives into the internal design of the standalone Doubly redirect service.

## 1. Glossary & Terms

- **Happy Path**: The steps a user’s request takes before returning a redirect response.
- **Cold Start**: The first invocation of a component, when caches are empty and latency may be higher.
- **Queue Shard**: One instance of a Cloudflare Queue, used to distribute load across many queues.
- **Hypertable**: A TimescaleDB abstraction that partitions a table by time (e.g., daily chunks).
- **RPS (requests per second)**: The number of requests made by users to `https://doubly.dev/{shortCode}` each second.

## 2. High‑Level Overview

- **Domain**: Short‑link redirect + collect click‑event analytics
- **Scale Target**: ≥ 1 billion requests/day, median latency < 40 ms
- **Primary Goals**:
  1. **Edge speed**: Handle redirects via Cloudflare Workers.
  2. **Minimal happy‑path work**: Redirect immediately; batch events asynchronously. 
  3. **Burst resilience**: Absorb sudden traffic spikes without overwhelming Postgres.

## 3. Core Components

| Component       | Responsibility                                               |
| --------------- | ------------------------------------------------------------ |
| **Producer**    | Edge Worker that resolves short codes and enqueues metadata. |
| **Queue Shard** | Cloudflare Queue instances that buffer click‑event payloads. |
| **Consumer**    | Worker that dequeues batches and writes events to Postgres.  |
| **KV Store**    | Cloudflare KV for fast short‑code → URL lookups.             |
| **Database**    | Neon Postgres + TimescaleDB hypertables for time‑series data. |

## 4. Request Flow (Simplified)

<img src="./README.assets/doubly-architecture.png" style="zoom:20%;" alt="Simplified request flow" />

1. **Incoming Request**
   `GET https://doubly.dev/{shortCode}`
2. **Producer Worker**
   - Parse `shortCode`
   - Check **local in‑memory cache**
   - Fallback to **Cloudflare KV**
   - Fallback to **Postgres** (not shown in diagram)
3. **Enqueue Click Metadata**
   - Collect device, geo, timestamp, referrer, etc.
   - `enqueue()` to one of the **Queue Shards** (fire-and-forget)
4. **Redirect**
   - Return `301 Location: <original URL>`

## 5. Scaled Deployment & Sharding

<img src="./README.assets/doubly-architecture-full.png" style="zoom:20%;" alt="Full architecture flow" />

> We are not showing the *fallback to Postgres* path in the above diagram as this is uncommon.

In production, Cloudflare automatically shards and scales each layer to meet traffic demands:

- **Multi‑Region Producers**
  Cloudflare routes users to the nearest Worker instance.
- **Queue Shards**
  Create N queues (≈ 500 RPS each). Hash on a unique request ID to distribute evenly.
- **Consumer Pool**
  Deploy a pool of Consumer Workers, each bound to one shard. Scale out Consumers based on queue depth.

## 6. Caching Strategy

1. **Local Cache** (per Worker instance)
   - Sub-millisecond, ephemeral.
2. **Cloudflare KV**
   - Warm-key lookups: ~ 4 ms globally
   - Cold-key lookups: < 200 ms
   - Populates Local Cache
3. **Postgres Fallback**
   - Ultra‑rare; on miss, Producer populates KV.

This three-tier cache minimizes latency and avoids unnecessary DB hits.

## 7. Queue Sharding & Batching

- **Why Queues?**
  Batching writes to TimescaleDB hypertables boosts write throughput, reduces per-event overhead, and prevents sudden traffic spikes.
- **Shard Strategy**
  - Cloudflare Queues have per-queue limits.
  - We spin up N identical queues and hash events by request ID.
- **Consumer Behavior**
  - Trigger on **either** “100 events enqueued” **or** “5 s elapsed.”
  - Dequeue up to 100 events, validate, batch‑insert into Postgres.

## 8. Retry Mechanisms

To guarantee high reliability, both KV reads and queue enqueues employ retries with exponential backoff:

```ts
async function withRetry<T>(action: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 1; i <= retries; i++) {
    try {
      return await action();
    } catch (err) {
      if (i === retries) throw err;
      const backoffMs = 50 * 2 ** (i - 1);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
}
```

- Producer wraps `kv.get()` and `queue.enqueue()` calls with `withRetry()`.
- Consumer wraps batch-DB writes similarly to avoid partial failures.

## 9. Data Storage & TimescaleDB

- **Neon Postgres**: Serverless, autoscaling Postgres.
- **TimescaleDB Hypertables**:
  - Partition `click_events` by time (daily chunks).
  - Extremely fast writes when batched.
  - Support trillions of rows without manual sharding.
- **Schema Highlights**:

```sql
CREATE TABLE click_events (
  id         SERIAL        NOT NULL,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  short_code TEXT          NOT NULL,
  url        TEXT          NOT NULL,
  country    VARCHAR(63),
  city       VARCHAR(63),
  browser    VARCHAR(63),
  os         VARCHAR(63),
  ...
  PRIMARY KEY (id, created_at)
);

SELECT create_hypertable(
  'click_events',
  'created_at',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists       => TRUE,
  migrate_data        => TRUE
);
```

For full migration files, see the [migrations folder](https://github.com/mhwice/doubly/tree/main/migrations).

## 10. Upstash Redis vs. Cloudflare KV

Before settling on KV, we compared both services across multiple regions:

| Read Type | Redis (ms) | KV (ms)   |
| --------- | ---------- | --------- |
| **Cold**  | 63 – 81    | 174 – 178 |
| **Warm**  | 33 – 61    | 3 – 5     |

- **Redis** wins cold reads; **KV** wins warm reads by a large margin.
- Since most traffic hits hot keys, **Cloudflare KV** is the optimal choice.
