
import dotenv from 'dotenv';
dotenv.config();

async function testSearch() {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.error('❌ SERPER_API_KEY not found in env');
    return;
  }

  console.log('🔍 Testing Serper API with key:', apiKey.substring(0, 5) + '...');

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: 'конкуренты wildberries держатель для полотенец',
        gl: 'ru',
        hl: 'ru',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Search success!');
      console.log('Results found:', data.organic?.length || 0);
      if (data.organic && data.organic.length > 0) {
        console.log('Top result:', data.organic[0].title);
        console.log('Link:', data.organic[0].link);
      }
    } else {
      console.error('❌ Search failed:', response.status, response.statusText);
      const text = await response.text();
      console.error('Body:', text);
    }
  } catch (e) {
    console.error('❌ Exception:', e);
  }
}

testSearch();
