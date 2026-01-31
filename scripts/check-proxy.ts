import chalk from 'chalk';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';

const TARGET_URL = 'http://eth0.me'; // Simple IP echo service
// const PROXY_URL = 'http://WAPRqS:JX9aDn@217.29.62.211:12861';
const PROXY_URL = process.env.PROXY_URLS || 'http://WAPRqS:JX9aDn@217.29.62.211:12861';

async function checkProxy() {
  console.log(chalk.blue('🌐 PROXY CONNECTIVITY CHECK'));
  console.log(chalk.gray('--------------------------------'));
  console.log(`Target: ${TARGET_URL}`);
  console.log(`Proxy:  ${PROXY_URL.replace(/:[^:]*@/, ':***@')}`); // Hide pass
  console.log(chalk.gray('--------------------------------'));

  try {
    const agent = new HttpsProxyAgent(PROXY_URL);
    const start = Date.now();

    const response = await fetch(TARGET_URL, {
      agent,
      timeout: 10000,
    });

    const duration = Date.now() - start;
    const ip = await response.text();

    if (response.ok) {
      console.log(chalk.green('✅ SUCCESS! Proxy is ALIVE.'));
      console.log(`⏱️ Latency: ${duration}ms`);
      console.log(`📍 External IP: ${ip.trim()}`);
    } else {
      console.log(chalk.red(`❌ FAILURE: HTTP ${response.status}`));
    }
  } catch (error: any) {
    console.log(chalk.red('❌ FATAL ERROR: Proxy is DEAD.'));
    console.log(chalk.yellow(`   Reason: ${error.message}`));

    if (error.code === 'ECONNREFUSED') {
      console.log(chalk.gray('   (The proxy server refused the connection. Check IP/Port)'));
    } else if (error.code === 'ETIMEDOUT') {
      console.log(chalk.gray('   (Connection timed out. Proxy is too slow or down)'));
    }
  }
}

checkProxy();
