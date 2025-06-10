This service both redirects users as well as records click metadata.

-- Test #1 --
Duration: 10s
Request/s: 10
Total Requests: 100

-- Test #2 --
Duration: 30s
Request/s: 100
Total Requests: 3000

-- Test #3 --
Duration: 180s
Request/s: 1000
Total Requests: 180,000

A few things to keep in mind.

Each producer has:
1 kv read + 1 queue write

Each consumer has:
1 queue read + 1 db write

So if I do test#3, I am processing 180k requests.
This means 180k kv reads, 360k queue ops, and 180k db rows.

Apparently I should be well within my limits to do all of this (neon is probably good till 3m rows).

Upstash Redis VS Cloudflare KV.

On cold starts, Upstash is consistenly much faster.
{"redisLatency":63,"kvLatency":174}
{"redisLatency":81,"kvLatency":178}

But after the first hit, kv is consistently faster.
{"redisLatency":61,"kvLatency":4}
{"redisLatency":54,"kvLatency":5}
{"redisLatency":33,"kvLatency":3}
{"redisLatency":57,"kvLatency":4}

I have done more tests in different regions, and the story is the same.
After the cold start, the kv is much faster.
From London and Sydney this difference was a p95 of 258ms for Upstash, and just 19ms for KV!
