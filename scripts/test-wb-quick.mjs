// Quick WB API test
const nmId = 314337853;
const url = `https://card.wb.ru/cards/v2/detail?appType=1&curr=rub&dest=-1255987&nm=${nmId}`;

console.log('Testing WB API...');
console.log('URL:', url);

try {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    }
  });
  
  console.log('Status:', res.status);
  
  if (res.ok) {
    const data = await res.json();
    console.log('Success! Products:', data?.data?.products?.length);
    if (data?.data?.products?.[0]) {
      const p = data.data.products[0];
      console.log('Name:', p.name);
      console.log('Price:', (p.salePriceU || p.priceU) / 100, 'RUB');
    }
  } else {
    console.log('Error status:', res.status);
    console.log('Body:', await res.text().catch(() => '(empty)'));
  }
} catch (e) {
  console.log('Fetch error:', e.message);
}
