// ============================================
// NeuroGUARDIAN — Load Testing with k6
// Performance & Stress Testing Suite
// ============================================

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ============================================
// CONFIGURATION
// ============================================

const BASE_URL = __ENV.BASE_URL || 'https://neuro-guardian.vercel.app';
const ADMIN_KEY = __ENV.ADMIN_API_KEY || '';

// Custom metrics
const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');
const successfulRequests = new Counter('successful_requests');

// ============================================
// TEST SCENARIOS
// ============================================

export const options = {
  scenarios: {
    // Smoke Test: Quick health check
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '10s',
      startTime: '0s',
      tags: { scenario: 'smoke' },
    },
    
    // Load Test: Normal traffic simulation
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },  // Ramp up to 10 users
        { duration: '1m', target: 10 },   // Stay at 10 users
        { duration: '30s', target: 0 },   // Ramp down
      ],
      startTime: '15s',
      tags: { scenario: 'load' },
    },
    
    // Stress Test: Find breaking point
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },  // Ramp to 20
        { duration: '30s', target: 50 },  // Push to 50
        { duration: '30s', target: 100 }, // Push to 100
        { duration: '30s', target: 0 },   // Ramp down
      ],
      startTime: '3m',
      tags: { scenario: 'stress' },
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests < 2s
    http_req_failed: ['rate<0.05'],    // Error rate < 5%
    errors: ['rate<0.1'],              // Custom error rate < 10%
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getHeaders(includeAdmin = false) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  
  if (includeAdmin && ADMIN_KEY) {
    headers['x-admin-key'] = ADMIN_KEY;
  }
  
  return headers;
}

function checkResponse(res, name) {
  const success = check(res, {
    [`${name} status is 200-299`]: (r) => r.status >= 200 && r.status < 300,
    [`${name} response time < 2s`]: (r) => r.timings.duration < 2000,
    [`${name} has body`]: (r) => r.body && r.body.length > 0,
  });
  
  errorRate.add(!success);
  if (success) {
    successfulRequests.add(1);
  }
  apiDuration.add(res.timings.duration);
  
  return success;
}

// ============================================
// TEST SCENARIOS
// ============================================

export default function () {
  // 1. HEALTH CHECK
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/api?action=health`, {
      headers: getHeaders(),
      timeout: '10s',
    });
    
    checkResponse(res, 'Health');
    
    // Verify health response structure
    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body);
        check(body, {
          'health has status': (b) => b.status !== undefined,
          'health status is healthy': (b) => b.status === 'healthy',
        });
      } catch (e) {
        // JSON parse failed
      }
    }
  });

  sleep(0.5);

  // 2. PRODUCTS LIST (requires auth)
  group('Products API', () => {
    const testUserId = 12345;
    
    const res = http.get(
      `${BASE_URL}/api?action=products&telegramId=${testUserId}`,
      {
        headers: getHeaders(true),
        timeout: '15s',
      }
    );
    
    checkResponse(res, 'Products');
  });

  sleep(0.5);

  // 3. AGENT CHAT (lightweight test)
  group('Agent API', () => {
    const testUserId = 12345;
    const payload = JSON.stringify({
      action: 'agent',
      message: 'Привет',
      telegramId: testUserId,
    });
    
    const res = http.post(`${BASE_URL}/api`, payload, {
      headers: getHeaders(true),
      timeout: '30s', // Agent can be slow
    });
    
    // Agent might return 401 without proper auth, that's expected
    check(res, {
      'Agent responds': (r) => r.status !== 0,
      'Agent not error 500': (r) => r.status !== 500,
    });
  });

  sleep(0.5);

  // 4. STATIC ASSETS
  group('Static Assets', () => {
    const res = http.get(`${BASE_URL}/`, {
      timeout: '10s',
    });
    
    check(res, {
      'Landing page loads': (r) => r.status === 200,
      'Landing has content': (r) => r.body && r.body.length > 1000,
    });
  });

  sleep(1);
}

// ============================================
// LIFECYCLE HOOKS
// ============================================

export function setup() {
  console.log(`🚀 Load Test Starting`);
  console.log(`📍 Target: ${BASE_URL}`);
  console.log(`🔑 Admin Key: ${ADMIN_KEY ? 'Provided' : 'Not provided'}`);
  
  // Verify target is reachable
  const res = http.get(`${BASE_URL}/api?action=health`);
  if (res.status !== 200) {
    console.warn(`⚠️ Health check failed: ${res.status}`);
  } else {
    console.log(`✅ Target is reachable`);
  }
  
  return { startTime: new Date().toISOString() };
}

export function teardown(data) {
  console.log(`\n🏁 Load Test Complete`);
  console.log(`⏱️ Started: ${data.startTime}`);
  console.log(`⏱️ Ended: ${new Date().toISOString()}`);
}

// ============================================
// NOTES
// ============================================

/*
 * USAGE:
 * 
 * 1. Install k6: https://k6.io/docs/getting-started/installation/
 *    - Windows: choco install k6
 *    - Mac: brew install k6
 * 
 * 2. Run smoke test only:
 *    k6 run --env BASE_URL=https://neuro-guardian.vercel.app tests/load/load.test.js
 * 
 * 3. Run with admin key:
 *    k6 run --env BASE_URL=https://neuro-guardian.vercel.app --env ADMIN_API_KEY=your_key tests/load/load.test.js
 * 
 * 4. Run specific scenario:
 *    k6 run --env SCENARIO=smoke tests/load/load.test.js
 * 
 * 5. Output to JSON:
 *    k6 run --out json=results.json tests/load/load.test.js
 * 
 * METRICS:
 * - http_req_duration: Request latency
 * - http_req_failed: Failed request rate
 * - errors: Custom error rate
 * - successful_requests: Total successful requests
 * - api_duration: API-specific latency trend
 */
