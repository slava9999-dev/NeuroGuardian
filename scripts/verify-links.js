
import 'dotenv/config'; // Load env
import https from 'https';

// Helper to simulate extractOzonId (simple regex)
function extractOzonId(url) {
    // Standard pattern: ozon.ru/product/[slug]-[id]/
    // Or shortened: ozon.ru/product/[id]/
    const match = url.match(/ozon\.ru\/.*product\/.*?(\d{8,12})/i) || 
                  url.match(/ozon\.ru\/product\/(\d{8,12})/i);
    return match ? match[1] : null;
}

// Helper to simulate extractWbId
function extractWbId(url) {
    const match = url.match(/wildberries\.ru\/catalog\/(\d+)/i);
    return match ? match[1] : null;
}

async function searchAndVerify(query) {
    // Check various env sources
    const apiKey = process.env.SERPER_API_KEY || process.env.VITE_SERPER_API_KEY;
    
    if (!apiKey) {
        console.error("❌ No SERPER_API_KEY found in process.env");
        return;
    }

    console.log(`\n🔍 Searching for: "${query}"...`);

    const data = JSON.stringify({
        q: query,
        gl: 'ru',
        hl: 'ru',
        num: 5
    });

    const options = {
        hostname: 'google.serper.dev',
        path: '/search',
        method: 'POST',
        headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    console.error(`❌ API Error: ${res.statusCode} ${res.statusMessage}`);
                    console.error(body);
                    resolve(); 
                    return;
                }
                
                try {
                    const result = JSON.parse(body);
                    const organic = result.organic || [];
                    
                    console.log(`✅ Found ${organic.length} results.`);
                    
                    organic.forEach((item, index) => {
                        const link = item.link;
                        let id = null;
                        let type = '';
                        let cleanLink = '';

                        if (link.includes('ozon.ru')) {
                            type = 'Ozon';
                            id = extractOzonId(link);
                            if (id) cleanLink = `https://www.ozon.ru/product/${id}`;
                        } else if (link.includes('wildberries.ru')) {
                            type = 'WB';
                            id = extractWbId(link);
                            if (id) cleanLink = `https://www.wildberries.ru/catalog/${id}/detail.aspx`;
                        }

                        if (type) {
                            console.log(`   [${index+1}] ${type}`);
                            console.log(`      Original: ${link}`);
                            console.log(`      Extracted ID: ${id || '❌ FAILED'}`);
                            if (id) {
                                console.log(`      Generated: ${cleanLink}`);
                            }
                        }
                    });
                } catch (err) {
                    console.error("JSON Parse Error:", err);
                }
                resolve();
            });
        });

        req.on('error', (e) => {
            console.error(`❌ Request error: ${e.message}`);
            resolve();
        });

        req.write(data);
        req.end();
    });
}

// Run (top-level await is supported in modules)
// Strategy: use 'inurl' to filter for product pages
await searchAndVerify("умная колонка site:ozon.ru inurl:product");
await searchAndVerify("платье женское вечернее site:wildberries.ru/catalog inurl:detail");
