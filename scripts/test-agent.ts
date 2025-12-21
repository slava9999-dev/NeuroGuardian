import dotenv from 'dotenv';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем .env из корня
dotenv.config({ path: path.join(__dirname, '../.env') });

// Нужно замокать sql, так как мы запускаем скрипт вне Vercel окружения
// В api/index.ts sql импортируется из @vercel/postgres
// Придется немного схитрить и тестировать только callOpenAIWithTools с мокнутыми данными
// Но api/index.ts слишком большой и завязан на глобальные переменные и импорты

// ВМЕСТО ИМПОРТА (который сломается из-за зависимостей Vercel),
// я создам минимальную копию логики вызова агента для теста.
// Это ГАРАНТИРУЕТ, что мы тестируем именно логику OpenAI + Tools,
// а не боремся с настройкой окружения Vercel локально.

import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OY, где ключ? OPENAI_API_KEY не найден в .env');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Определения инструментов (копия из api/index.ts)
const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_sales_stats',
      description: 'Статистика продаж',
      parameters: {
        type: 'object',
        properties: { period: { type: 'string', enum: ['week', 'month'] } },
        required: ['period'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculate_unit_economics',
      description: 'Юнит-экономика',
      parameters: {
        type: 'object',
        properties: { product_id: { type: 'string' }, price: { type: 'number' } },
        required: ['price'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_abc_analysis',
      description: 'ABC анализ',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_stock_forecast',
      description: 'Прогноз остатков',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_orders',
      description: 'Список заказов',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_prices',
      description: 'Обновить цены',
      parameters: { type: 'object', properties: { price_change: { type: 'number' } } },
    },
  },
];

const SYSTEM_PROMPT = `
Ты - NeuroAgent, эксперт по маркетплейсам Wildberries и Ozon.
У тебя есть доступ к инструментам. Используй их!
`;

async function testAgent(userMessage: string) {
  console.log(`\n💬 USER: "${userMessage}"`);
  console.log('⏳ Thinking...');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      tools: AGENT_TOOLS,
      tool_choice: 'auto',
    });

    const msg = response.choices[0].message;

    if (msg.tool_calls) {
      console.log('🛠️  GPT decided to call tools:');
      msg.tool_calls.forEach(tool => {
        console.log(`   👉 Function: ${tool.function.name}`);
        console.log(`      Args: ${tool.function.arguments}`);
      });
      return { success: true, tools: msg.tool_calls.map(t => t.function.name) };
    } else {
      console.log(`🤖 Answer: ${msg.content}`);
      return { success: true, tools: [] };
    }
  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, error };
  }
}

async function runTests() {
  console.log('🚀 STARTING AGENT TESTS\n');

  await testAgent('Покажи статистику продаж за неделю');
  await testAgent('Рассчитай юнит экономику для товара за 1500 рублей');
  await testAgent('Какие товары приносят 80% выручки? (ABC анализ)');
  await testAgent('Когда у меня закончатся товары? Сделай прогноз');
  console.log('\n✅ TESTS FINISHED');
}

runTests();
