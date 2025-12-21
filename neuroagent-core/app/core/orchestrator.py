"""
NeuroAgent Core - Orchestrator
Главный мозг системы — обрабатывает запросы и вызывает tools
"""

import time
import uuid
from typing import Optional
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain.memory import ConversationBufferWindowMemory

from .llm_router import LLMRouter, TaskComplexity
from ..schemas.messages import ChatResponse, ResponseType, ConfirmationDetails, UserContext


# Системный промпт для агента
SYSTEM_PROMPT = """Ты — NeuroAgent, AI-ассистент для продавцов на маркетплейсах Wildberries и Ozon.

🎯 ТВОЯ МИССИЯ:
Помочь продавцам автоматизировать рутину и принимать умные решения на основе данных.

💼 ТВОИ ВОЗМОЖНОСТИ:
- Поиск и анализ товаров продавца
- Получение статистики продаж
- Изменение цен (с подтверждением!)
- Анализ конкурентов
- Работа с отзывами
- Оптимизация карточек товаров

⚠️ ПРАВИЛА БЕЗОПАСНОСТИ:
1. Операции изменения (цены, остатки) ВСЕГДА требуют подтверждения пользователя
2. Никогда не выполняй массовые операции без явного согласия
3. При неясных командах — уточни детали
4. Показывай превью изменений перед применением

📊 ТВОЙ СТИЛЬ:
- Отвечай на русском языке
- Используй emoji для структурирования
- Форматируй числа: **123 456 ₽**
- Будь кратким и конкретным
- Давай actionable советы, не абстрактные

👤 ТЕКУЩИЙ ПОЛЬЗОВАТЕЛЬ:
- Имя: {user_name}
- Подключено WB: {has_wb}
- Подключено Ozon: {has_ozon}
- Товаров: {products_count}
- Выручка за месяц: {revenue}

Отвечай по делу!"""


class NeuroAgentOrchestrator:
    """
    Главный оркестратор агента.
    
    Отвечает за:
    - Маршрутизацию запросов к нужной LLM
    - Управление tools (инструментами)
    - Обработку подтверждений
    - Хранение истории диалога
    """
    
    def __init__(self, user_id: str, tools: list = None):
        """
        Инициализация оркестратора для конкретного пользователя.
        
        Args:
            user_id: Telegram ID пользователя
            tools: Список LangChain tools (пока пустой)
        """
        self.user_id = user_id
        self.llm_router = LLMRouter()
        self.tools = tools or []
        
        # Память диалога (последние 10 сообщений)
        self.memory = ConversationBufferWindowMemory(
            k=10,
            return_messages=True,
            memory_key="chat_history"
        )
        
        # Ожидающие подтверждения
        self.pending_confirmations: dict[str, dict] = {}
    
    async def process_message(
        self,
        message: str,
        user_context: UserContext
    ) -> ChatResponse:
        """
        Обработка сообщения пользователя.
        
        Args:
            message: Текст сообщения
            user_context: Контекст пользователя (подписка, маркетплейсы)
            
        Returns:
            ChatResponse: Ответ агента
        """
        start_time = time.time()
        
        # Проверяем, это подтверждение операции?
        if message.lower() in ["да", "подтверждаю", "выполни", "ок", "yes"]:
            return await self._handle_confirmation(True)
        
        if message.lower() in ["нет", "отмена", "отменить", "cancel", "no"]:
            return await self._handle_confirmation(False)
        
        # Определяем сложность и выбираем модель
        model, complexity = self.llm_router.get_model_for_message(message)
        
        # Формируем промпт
        prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
        ])
        
        # Если есть tools — создаём агента, иначе просто чат
        if self.tools:
            prompt_with_scratchpad = ChatPromptTemplate.from_messages([
                ("system", SYSTEM_PROMPT),
                MessagesPlaceholder(variable_name="chat_history"),
                ("human", "{input}"),
                MessagesPlaceholder(variable_name="agent_scratchpad"),
            ])
            agent = create_openai_tools_agent(model, self.tools, prompt_with_scratchpad)
            executor = AgentExecutor(
                agent=agent,
                tools=self.tools,
                memory=self.memory,
                verbose=True,
                max_iterations=5,
            )
            result = await executor.ainvoke({
                "input": message,
                "user_name": user_context.user_name,
                "has_wb": "✅ Да" if user_context.has_wb else "❌ Нет",
                "has_ozon": "✅ Да" if user_context.has_ozon else "❌ Нет",
                "products_count": user_context.products_count,
                "revenue": f"{user_context.total_revenue_month:,.0f} ₽",
            })
            content = result["output"]
            tokens_used = 0  # TODO: получить из response
        else:
            # Простой чат без tools
            chain = prompt | model
            result = await chain.ainvoke({
                "input": message,
                "chat_history": self.memory.buffer,
                "user_name": user_context.user_name,
                "has_wb": "✅ Да" if user_context.has_wb else "❌ Нет",
                "has_ozon": "✅ Да" if user_context.has_ozon else "❌ Нет",
                "products_count": user_context.products_count,
                "revenue": f"{user_context.total_revenue_month:,.0f} ₽",
            })
            content = result.content
            tokens_used = result.response_metadata.get("token_usage", {}).get("total_tokens", 0)
        
        # Сохраняем в память
        self.memory.save_context(
            {"input": message},
            {"output": content}
        )
        
        execution_time = int((time.time() - start_time) * 1000)
        
        return ChatResponse(
            type=ResponseType.TEXT,
            content=content,
            model_used=model.model_name,
            tokens_used=tokens_used,
            execution_time_ms=execution_time,
        )
    
    async def _handle_confirmation(self, confirmed: bool) -> ChatResponse:
        """Обработка подтверждения/отмены операции"""
        
        if not self.pending_confirmations:
            return ChatResponse(
                type=ResponseType.TEXT,
                content="❓ Нет операций, ожидающих подтверждения.",
            )
        
        # Берём последнюю операцию
        confirmation_id = list(self.pending_confirmations.keys())[-1]
        operation = self.pending_confirmations.pop(confirmation_id)
        
        if confirmed:
            # TODO: Выполнить операцию
            return ChatResponse(
                type=ResponseType.TEXT,
                content=f"✅ Операция выполнена: {operation.get('description', 'OK')}",
            )
        else:
            return ChatResponse(
                type=ResponseType.TEXT,
                content="❌ Операция отменена.",
            )
    
    def request_confirmation(
        self,
        operation: str,
        description: str,
        affected_items: int = 0,
        risk_level: str = "low",
        details: dict = None
    ) -> ConfirmationDetails:
        """
        Запрос подтверждения у пользователя.
        
        Используется tools когда нужно изменить данные.
        """
        confirmation_id = str(uuid.uuid4())[:8]
        
        self.pending_confirmations[confirmation_id] = {
            "operation": operation,
            "description": description,
            "details": details or {},
        }
        
        return ConfirmationDetails(
            confirmation_id=confirmation_id,
            operation=operation,
            description=description,
            affected_items=affected_items,
            risk_level=risk_level,
        )
