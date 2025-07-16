import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';

const shortlinks = new SharedArray('shortlinks', function() {
  return JSON.parse(open('shortLinks.json'));
});

const n = shortlinks.length;
const twenty = Math.floor(0.2 * n);
const hotLinks = shortlinks.slice(0, twenty); // first 20% of links are hot
const coldLinks = shortlinks.slice(twenty); // last 80% of links are cold

const MAX_RPS = 12000;
const RAMP_TIME = "20s";
const STEADY_TIME = "60s";

export let options = {
  scenarios: {
    // 1) Ramp from 0 → 12 000 RPS over 20 s
    ramp_up: {
      executor:      'ramping-arrival-rate',
      exec:          'traffic',
      startRate:     0,
      timeUnit:      '1s',
      stages: [
        { target: MAX_RPS, duration: RAMP_TIME },
      ],
      preAllocatedVUs: 2000,
      maxVUs:          3000,
      tags: { phase: 'ramp' },
    },
    // 2) Hold at 12 000 RPS for 60 s, starting when ramp_up finishes
    steady: {
      executor:      'constant-arrival-rate',
      exec:          'traffic',
      rate:          MAX_RPS,
      timeUnit:      '1s',
      duration:      STEADY_TIME,
      preAllocatedVUs: 2000,
      maxVUs:          3000,
      startTime:     RAMP_TIME,       // kicks off right after ramp_up
      tags: { phase: 'steady' },
    },
  },
  thresholds: {
    // Optional: fail if more than 1% of requests fail
    'http_req_failed': ['rate<0.01'],
    // Optional: 95% of all requests should finish below 0.5s
    'http_req_duration': ['p(95)<500'],
  },
  cloud: {
    projectID: 3775219,
    name: 'Doubly Redirect',
    distribution: {
      distributionLabel1: { loadZone: 'amazon:us:columbus', percent: 100 },
    },
  }
};

export function traffic() {

  let code;
  if (Math.random() < 0.80) {
    code = hotLinks[Math.floor(Math.random() * hotLinks.length)];
  } else {
    code = coldLinks[Math.floor(Math.random() * coldLinks.length)];
  }

  const url = `https://mwice.xyz/${code}`;

  const reqName = "Shortlink Redirect";
  const res = http.get(url, { redirects: 0, tags: { name: reqName } });
  check(res, {
    'is status 301 or 302': (r) => r.status === 301 || r.status === 302,
    'location is correct': (r) => r.headers['Location'] === 'https://www.google.com',
  });
}
