const autocannon = require('autocannon');
const path = require('path');

const TARGET_URL = process.env.BASE_URL || 'https://neuro-guardian.vercel.app';

async function runLoadTest() {
  console.log('🚀 Starting Load Test with Autocannon...');
  console.log(`📍 Target: ${TARGET_URL}`);

  // Scenario 1: Health Check (High throughput expected)
  console.log('\nTesting /api?action=health (Smoke Test)...');
  const healthTest = await autocannon({
    url: `${TARGET_URL}/api?action=health`,
    connections: 10, // 10 concurrent connections
    duration: 10,    // 10 seconds
    pipelining: 1,
  });

  console.log('Health Test Results:');
  console.log(autocannon.printResult(healthTest));

  // Scenario 2: Static Assets (Lower latency expected)
  console.log('\nTesting / (Static Assets)...');
  const staticTest = await autocannon({
    url: `${TARGET_URL}/`,
    connections: 10,
    duration: 10,
  });

  console.log('Static Assets Results:');
  console.log(autocannon.printResult(staticTest));

  // Scenario 3: API Stress (Moderate load)
  console.log('\nTesting /api with invalid payload (Error Handling Stress)...');
  const stressTest = await autocannon({
    url: `${TARGET_URL}/api`,
    method: 'POST',
    body: JSON.stringify({ action: 'invalid_action' }),
    headers: { 'original-content-type': 'application/json' },
    connections: 20,
    duration: 10,
  });

  console.log('Stress Test Results:');
  console.log(autocannon.printResult(stressTest));
}

runLoadTest().catch(console.error);
