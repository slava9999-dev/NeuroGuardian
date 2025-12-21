"""
NeuroAgent Core - LLM Router
Умная маршрутизация между быстрой и мощной моделью
"""

from enum import Enum
import re
from langchain_openai import ChatOpenAI
from .config import get_settings


class TaskComplexity(Enum):
    """Сложность задачи"""
    SIMPLE = "simple"   # Простые запросы — GPT-4o-mini
    COMPLEX = "complex" # Сложный анализ — GPT-4o


class LLMRouter:
    """
    Маршрутизатор LLM-запросов.
    
    80% запросов идут на быструю дешёвую модель (gpt-4o-mini)
    20% сложных запросов идут на мощную модель (gpt-4o)
    
    Это экономит деньги и ускоряет ответы!
    """
    
    # Паттерны для определения сложных запросов
    COMPLEX_PATTERNS = [
        r"оптимизируй",
        r"проанализируй",
        r"почему",
        r"стратегия",
        r"рекомендаци[иям]",
        r"если.*то",
        r"сравни",
        r"объясни",
        r"прогноз",
        r"тренд",
        r"конкурент",
    ]
    
    # Паттерны простых запросов
    SIMPLE_PATTERNS = [
        r"покажи",
        r"сколько",
        r"список",
        r"статус",
        r"остатки",
        r"цена на",
        r"продажи за",
        r"мои товары",
    ]
    
    def __init__(self):
        settings = get_settings()
        
        # Быстрая модель для простых задач
        self.fast_model = ChatOpenAI(
            model=settings.fast_model,
            temperature=0.1,
            max_tokens=1000,
            api_key=settings.openai_api_key,
        )
        
        # Мощная модель для сложных задач
        self.smart_model = ChatOpenAI(
            model=settings.smart_model,
            temperature=0.3,
            max_tokens=4000,
            api_key=settings.openai_api_key,
        )
    
    def classify_complexity(self, user_message: str) -> TaskComplexity:
        """
        Определяет сложность задачи по тексту сообщения.
        
        Args:
            user_message: Сообщение пользователя
            
        Returns:
            TaskComplexity: SIMPLE или COMPLEX
        """
        message_lower = user_message.lower()
        
        # Сначала проверяем сложные паттерны
        for pattern in self.COMPLEX_PATTERNS:
            if re.search(pattern, message_lower):
                return TaskComplexity.COMPLEX
        
        # По умолчанию — простой запрос
        return TaskComplexity.SIMPLE
    
    def get_model(self, complexity: TaskComplexity) -> ChatOpenAI:
        """
        Возвращает подходящую модель для задачи.
        
        Args:
            complexity: Сложность задачи
            
        Returns:
            ChatOpenAI: Модель для выполнения задачи
        """
        if complexity == TaskComplexity.COMPLEX:
            return self.smart_model
        return self.fast_model
    
    def get_model_for_message(self, message: str) -> tuple[ChatOpenAI, TaskComplexity]:
        """
        Удобный метод: определяет сложность и возвращает модель.
        
        Args:
            message: Сообщение пользователя
            
        Returns:
            tuple: (модель, сложность)
        """
        complexity = self.classify_complexity(message)
        model = self.get_model(complexity)
        return model, complexity
