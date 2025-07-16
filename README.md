#### Tests

##### Test #1
Duration: 10s
Request/s: 10
Total Requests: 100
Daily Rate: 864K requests/day

> Completed successfully. Redirect time dropped to around 25ms after being fully warmed. 100/100 events successfully inserted into the database.

##### Test #2
Duration: 30s
Request/s: 100
Total Requests: 3000
Daily Rate: 8.64M requests/day

> Completed successfully. P95 response time was 58ms, but I noticed that after the system had been running for 10-15s the response time seemed to drop to around 42ms, so there still might have been some cold-start influence. 3001/3001 events successfully inserted into the database.

##### Test #3

Duration: 60s
Request/s: 500
Total Requests: 30,000
Daily Rate: 43.2M requests/day

> Completed successfully. P95 response time was 61ms. Interestingly, the response time stayed around 35ms for most of the test, but jumped to 70ms at the end (last 10 seconds). I am unsure why this is. 30,001/30,001 events successfully inserted into the database.

##### Test #4

Duration: 30s
Request/s: 1000
Total Requests: 30,000
Daily Rate: 86.4M requests/day

> Completed successfully. P95 response time of 71ms. This is higher, but I suspect its because of my new logic and round robin queueing. 29,996/30,001 events were inserted into the database. Of those 5 events, 2 redirected properly but their event data failed to enter the queue, and for the other 3 they failed both redirection and db insertion.

##### Test #5

Duration: 20s
Request/s: 3000
Total Requests: 60,000
Daily Rate: 259.2M requests/day

> Completed successfully. P95 response time of 71ms, but this was a short test and it was trending down to ~60ms at the end. 60,002/60,002 events were inserted into the database. 

##### Test #6

Duration: 60s
Request/s: 3000
Total Requests: 180,000
Daily Rate: 259.2M requests/day
Monthly Rate: 7.7B requests/month

> Completed successfully. P95 response time of 57ms. 180,000/180,001 events were inserted into the database. I think this response time more accurately reflects reality since we have 20k links and we need a while to warm them up.

##### Test #7

Duration: 20s
Request/s: 12,000
Total Requests: 240,000
Daily Rate: 1.03B requests/day
Monthly Rate: 31B requests/month

> Failed. 165k / 244k requests failed with status 403. Further investigation discovered that requests were being blocked by Coudflares DDoS firewall. Need to figure out how to get around that.


##### Test #8

Duration: 20s
Request/s: 12,000
Total Requests: 240,000
Daily Rate: 1.03B requests/day
Monthly Rate: 31B requests/month

> Failed, but better. Only 4/241763 requests failed, but somehow 270k events were inserted into the database. I suspect this is due to the queues "at least once" behaviour. Solution is to add a unique id to each event. Also interesting to note that the request time got down to 45ms at the end of the test - showing the caching taking effect. Also interesting is the spike in response time when the test started. My thinking is that this was from many cold keys being hit. Perhaps these should be hit during setup as well as the hot links to prevent the spike. Also had a single request take 2s which is interesting. Perhaps many retries.

##### Test #9

Duration: 20s
Request/s: 6,000
Total Requests: 123,319
Daily Rate: 518M requests/day
Monthly Rate: 15.5B requests/month

> Success! P95 response time of 132ms. 123,319/123,319 events were inserted into the database. Very happy with the request success rate, but the response time is much worse. Not sure what happened there - warrants investigation.

##### Test #10

Duration: 20s
Request/s: 12,000
Total Requests: 241,600
Daily Rate: 1.03B requests/day
Monthly Rate: 31B requests/month

> Success! P95 response time of 90ms. A median response time of under 40ms once the test was underway! 241,596/241,600 events were inserted into the database - 99.998%. 

##### Test #11

Duration: 60s (with 20s ramp-up)
Request/s: 12,000
Total Requests: 839,879
Daily Rate: 1.03B requests/day
Monthly Rate: 31B requests/month

> Success! P95 response time of 66ms. A median response time of under 40ms once the test was underway! 839,879/839,879 events were inserted into the database (100%)! 


------

#### Upstash Redis VS Cloudflare KV.

Before doing any load testing, I wanted to check to see whether Upstash Redis or Cloudflare KV would be a better option for caching short links. As both services are offered globally, and can allow for a virtually unlimited number of reads/writes, my main focus was which service was faster. I did several quick tests from multiple regions and found that Upstash was consitently faster for cold-key lookups, but slower for warm-key lookups. This was true across all regions. 

Cold reads, time in ms.
```
{"redisLatency":63,"kvLatency":174}
{"redisLatency":81,"kvLatency":178}
```

Warm reads, time in ms.
```
{"redisLatency":61,"kvLatency":4}
{"redisLatency":54,"kvLatency":5}
{"redisLatency":33,"kvLatency":3}
{"redisLatency":57,"kvLatency":4}
```

Seeing as though a link redirect service is likely to be handling a lot of traffic, it seems that KV is the better option.

> With that said, I could also do some fancy



```
 npx wrangler kv bulk put kv.json --namespace-id=7fdaccaf9072443db29e72b452dd8254 --remote
```



-----



### Architecture

This service is standalone - it does not reach out to any other service. I decided to use Cloudflare KV instead of Upstash Redis as after testing, KV outperformed Redis significantly. 

![](./README.assets/doubly-architecture.png)

### Full

<img src="./README.assets/doubly-architecture-full.png" style="zoom:20%;" />



How to get it working

Images from Grafana











