import { browserEyes } from '../src/sentinel/BrowserEyes.js';
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function debugBrowserEyes() {
  console.log('--- Debugging BrowserEyes DOM Structure ---\n');

  const testUrl = 'https://www.wildberries.ru/catalog/153373282/detail.aspx';

  console.log(`🔗 URL: ${testUrl}\n`);

  const browser = await chromium.launch({ headless: false }); // headless: false to see what's happening
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });

  try {
    console.log('📡 Navigating to page...');
    await page.goto(testUrl, { waitUntil: 'networkidle', timeout: 30000 });

    console.log('⏳ Waiting 3 seconds for dynamic content...');
    await page.waitForTimeout(3000);

    // Save screenshot
    const screenshotPath = join(process.cwd(), 'debug-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);

    // Save HTML
    const html = await page.content();
    const htmlPath = join(process.cwd(), 'debug-page.html');
    writeFileSync(htmlPath, html, 'utf-8');
    console.log(`📄 HTML saved: ${htmlPath}`);

    // Extract all text content with price-like patterns
    const pricePatterns = await page.evaluate(() => {
      const results: string[] = [];

      // Find all elements containing numbers with ₽
      const allText = document.body.innerText;
      const priceMatches = allText.match(/\d[\d\s]*\s*₽/g);

      if (priceMatches) {
        results.push('=== Found Price Patterns ===');
        priceMatches.forEach(match => results.push(match));
      }

      // Find all elements with class containing 'price'
      results.push('\n=== Elements with "price" in class ===');
      document.querySelectorAll('[class*="price" i]').forEach(elem => {
        const className = elem.className;
        const text = elem.textContent?.trim().substring(0, 100);
        results.push(`Class: ${className} | Text: ${text}`);
      });

      // Find all elements with data attributes
      results.push('\n=== Elements with data-* attributes ===');
      document.querySelectorAll('[data-price], [data-nm-id]').forEach(elem => {
        const attrs = Array.from(elem.attributes)
          .map(a => `${a.name}="${a.value}"`)
          .join(' ');
        results.push(attrs);
      });

      return results;
    });

    console.log('\n📊 Analysis Results:\n');
    pricePatterns.forEach(line => console.log(line));

    console.log('\n✅ Debug complete. Check files for details.');
    console.log('Press Ctrl+C to close browser...');

    // Keep browser open for manual inspection
    await page.waitForTimeout(60000);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debugBrowserEyes().catch(console.error);
