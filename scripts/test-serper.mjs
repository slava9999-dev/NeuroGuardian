// Test Serper API
import 'dotenv/config';

const apiKey = process.env.SERPER_API_KEY;
console.log('SERPER_API_KEY:', apiKey ? 'Found' : 'NOT FOUND');

if (!apiKey) {
  console.error('Add SERPER_API_KEY to .env.local');
  process.exit(1);
}

const query = 'wildberries панно деревянное цена';
console.log(`\n🔍 Testing search: "${query}"...\n`);

try {
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      gl: 'ru',
      hl: 'ru',
      num: 5,
    }),
  });

  console.log('Status:', response.status);

  if (response.ok) {
    const data = await response.json();
    console.log('✅ Search works!\n');
    
    console.log('Results:');
    if (data.organic) {
      for (let i = 0; i < Math.min(3, data.organic.length); i++) {
        const r = data.organic[i];
        console.log(`\n${i + 1}. ${r.title}`);
        console.log(`   ${r.link}`);
        console.log(`   ${r.snippet?.substring(0, 100)}...`);
      }
    }
    
    if (data.answerBox) {
      console.log('\n📊 Answer Box:', data.answerBox.snippet || data.answerBox.answer);
    }
  } else {
    console.log('❌ Error:', await response.text());
  }
} catch (e) {
  console.log('❌ Fetch error:', e.message);
}
