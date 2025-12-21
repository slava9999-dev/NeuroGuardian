import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем .env
dotenv.config({ path: path.join(__dirname, '../.env') });

// Импортируем функцию выполнения инструментов
import { executeAgentTool } from '../api/index';

async function runDirectTests() {
  console.log('🚀 STARTING DIRECT TOOL TESTS (Bypassing OpenAI)\n');

  const MOCK_USER_ID = 123; // ID пользователя для теста (если есть в БД)
  const MOCK_CONTEXT = {
    wbApiKey: process.env.TEST_WB_API_KEY, // Добавь это в .env если хочешь реальный тест WB
    ozonApiKey: undefined,
  };

  console.log("🧪 Testing 'get_products'...");
  try {
    const res = await executeAgentTool('get_products', { limit: 2 }, MOCK_USER_ID, MOCK_CONTEXT);
    console.log('✅ get_products Result:', JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.error('❌ get_products Failed:', e);
  }

  console.log("\n🧪 Testing 'calculate_unit_economics'...");
  try {
    const res = await executeAgentTool(
      'calculate_unit_economics',
      { price: 1500, marketplace: 'WB' },
      MOCK_USER_ID,
      MOCK_CONTEXT
    );
    console.log('✅ Unit Economics Result:', JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.error('❌ Unit Economics Failed:', e);
  }

  console.log("\n🧪 Testing 'get_stock_forecast'...");
  try {
    const res = await executeAgentTool('get_stock_forecast', {}, MOCK_USER_ID, MOCK_CONTEXT);
    console.log('✅ Stock Forecast Result:', JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.error('❌ Stock Forecast Failed:', e);
  }
}

runDirectTests();
