// Test multiple WB API endpoints
const endpoints = [
  // v1 endpoint
  'https://card.wb.ru/cards/v1/detail?appType=1&curr=rub&dest=-1257786&spp=30&nm=',
  // v2 endpoint  
  'https://card.wb.ru/cards/v2/detail?appType=1&curr=rub&dest=-1255987&nm=',
  // Alternative v2
  'https://card.wb.ru/cards/v2/detail?appType=1&curr=rub&dest=-1257786&ab_testing=false&nm=',
];

// Popular product IDs to try
const nmIds = [
  '314337853',  // From search results
  '91024236',   // Another random
  '17408200',   // iPhone case (popular)
  '186725057',  // Random popular
];

console.log('🔍 Testing WB API endpoints...\n');

for (const nmId of nmIds) {
  console.log(`\n📦 Testing nm_id: ${nmId}`);
  
  for (let i = 0; i < endpoints.length; i++) {
    const url = endpoints[i] + nmId;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data?.data?.products?.length > 0) {
          const p = data.data.products[0];
          console.log(`  ✅ Endpoint ${i+1} WORKS!`);
          console.log(`     Name: ${p.name}`);
          console.log(`     Price: ${(p.salePriceU || p.priceU) / 100} RUB`);
          console.log(`     Working URL: ${url}`);
          process.exit(0);
        } else {
          console.log(`  ⚠️ Endpoint ${i+1}: OK but empty products`);
        }
      } else {
        console.log(`  ❌ Endpoint ${i+1}: ${res.status}`);
      }
    } catch (e) {
      console.log(`  ❌ Endpoint ${i+1}: ${e.message}`);
    }
  }
}

console.log('\n❌ All endpoints failed!');
console.log('WB may have changed their API or blocked non-browser requests.');
