import 'dotenv/config';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

async function testProxy() {
  const proxyUrl = process.env.PROXY_URLS?.split(',')[0];
  if (!proxyUrl) {
    console.error('❌ No PROXY_URLS found in .env');
    return;
  }

  console.log(`📡 Testing proxy: ${proxyUrl}`);

  const agent = proxyUrl.startsWith('socks')
    ? new SocksProxyAgent(proxyUrl)
    : new HttpsProxyAgent(proxyUrl);

  try {
    const startTime = Date.now();
    const response = await fetch('https://www.google.com', {
      agent,
      timeout: 10000,
    });

    const duration = Date.now() - startTime;
    console.log(`✅ Connection successful!`);
    console.log(`Status: ${response.status}`);
    console.log(`Latency: ${duration}ms`);

    // Test WB if possible
    console.log(`🔍 Testing Wildberries catalog...`);
    const wbResponse = await fetch('https://www.wildberries.ru/catalog/215322964/detail.aspx', {
      agent,
      timeout: 15000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    });
    console.log(`WB Status: ${wbResponse.status}`);

    if (wbResponse.status === 200) {
      console.log('💎 Proxy works for Wildberries!');
    } else {
      console.log(`⚠️ Proxy connected but WB returned ${wbResponse.status}. Might be blocked.`);
    }

    console.log(`🔍 Testing Ozon...`);
    const ozonResponse = await fetch('https://www.ozon.ru/product/1704253139/', {
      agent,
      timeout: 15000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    });
    console.log(`Ozon Status: ${ozonResponse.status}`);
    if (ozonResponse.status === 200) {
      console.log('💎 Proxy works for Ozon!');
    } else {
      console.log(`⚠️ Proxy connected but Ozon returned ${ozonResponse.status}.`);
    }
  } catch (err: any) {
    console.error(`❌ Proxy Test Failed: ${err.message}`);
  }
}

testProxy();
