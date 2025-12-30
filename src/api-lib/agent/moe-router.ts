import { StateGraph, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';

// 1. Определение состояния графа
export const MoEState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),
  intent: Annotation<string>(),
  confidence: Annotation<number>(),
  routeTo: Annotation<'local_stats' | 'local_chat' | 'cloud_complex'>(),
});

// 2. Инициализация локального роутера (Phi-3-mini через vLLM)
const routerModel = new ChatOpenAI({
  modelName: 'microsoft/Phi-3-mini-4k-instruct',
  temperature: 0,
  timeout: 60000, // Увеличиваем до 60с для первого "холодного" запуска vLLM
  configuration: {
    baseURL: process.env.LOCAL_LLM_URL || 'http://localhost:8000/v1',
    apiKey: 'not-needed',
  },
});

// 3. Узел классификации
const classifyIntent = async (state: typeof MoEState.State) => {
  const lastMessage = state.messages[state.messages.length - 1].content;

  const systemPrompt = `You are an intent classifier for NeuroGUARDIAN (multilingual Russian/English).
    Analyze user query and choose category:
    - STATS: Price check, stock (e.g., "какая цена", "сколько на складе", "check prices").
    - CHAT: Greetings, general help (e.g., "привет", "как дела", "who are you").
    - COMPLEX: Market analysis, strategy, mass updates (e.g., "сделай анализ прибыльности").

    EXAMPLES:
    User: "привет" -> {"intent": "CHAT", "confidence": 0.99}
    User: "чекни цены на вб" -> {"intent": "STATS", "confidence": 0.95}

    Output valid JSON only.`;

  try {
    const response = await routerModel.invoke([
      new HumanMessage({ content: `${systemPrompt}\n\nUser: "${lastMessage}"` }),
    ]);

    // Очистка от возможных markdown-тегов
    const content = (response.content as string).replace(/```json|```/g, '').trim();
    const data = JSON.parse(content);
    let route: any = 'cloud_complex';

    if (data.intent === 'STATS') route = 'local_stats';
    else if (data.intent === 'CHAT') route = 'local_chat';

    return {
      intent: data.intent,
      confidence: data.confidence,
      routeTo: route,
    };
  } catch (e) {
    return { intent: 'UNKNOWN', routeTo: 'cloud_complex' };
  }
};

// 4. Узлы экспертов (заглушки для интеграции)
const handleLocalStats = async (_state: typeof MoEState.State) => {
  return { messages: [new AIMessage('Local expert analyzing marketplace data...')] };
};

const handleLocalChat = async (_state: typeof MoEState.State) => {
  return { messages: [new AIMessage('Greetings from local AI specialist.')] };
};

const handleCloudComplex = async (_state: typeof MoEState.State) => {
  return {
    messages: [new AIMessage('Redirecting to Cloud Expert (Gemini) for complex analysis...')],
  };
};

// 5. Функция маршрутизации
const routeByIntent = (state: typeof MoEState.State) => {
  return state.routeTo || 'cloud_complex';
};

// 6. Построение графа
const workflow = new StateGraph(MoEState)
  .addNode('classify', classifyIntent)
  .addNode('local_stats', handleLocalStats)
  .addNode('local_chat', handleLocalChat)
  .addNode('cloud_complex', handleCloudComplex)
  .addEdge('__start__', 'classify')
  .addConditionalEdges('classify', routeByIntent);

export const moeRouter = workflow.compile();
