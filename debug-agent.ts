import 'dotenv/config';
import { orchestrateV4 } from './src/api-lib/agent/orchestrator-v4.js';

async function debugCalculations() {
  const TEST_CONTEXT = {
    userId: 123456789,
    userName: 'MockTestUser',
    marketplace: 'all' as const,
    productsCount: 4,
    onboardingMode: false,
    isFirstContact: false,
  };

  const history = [
    { role: 'user', content: 'Посчитай прибыль на органайзер' },
    { role: 'assistant', content: 'Какая себестоимость органайзера?' },
  ];

  console.log('--- Debugging Agent Response for "450" ---');
  try {
    const result = await orchestrateV4('450', TEST_CONTEXT, history);
    console.log('Response content:', result.message);
    console.log('Tools called:', result.toolsCalled);
  } catch (error) {
    console.error('Error:', error);
  }
}

debugCalculations();
