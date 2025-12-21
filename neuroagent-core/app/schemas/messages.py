"""
NeuroAgent Core - Message Schemas
Pydantic модели для API запросов и ответов
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
from enum import Enum


class ResponseType(str, Enum):
    """Тип ответа агента"""
    TEXT = "text"                        # Обычный текстовый ответ
    CONFIRMATION = "confirmation"        # Требуется подтверждение
    DATA = "data"                        # Данные (таблица, список)
    ERROR = "error"                      # Ошибка


# === REQUEST MODELS ===

class ChatRequest(BaseModel):
    """Запрос к агенту"""
    message: str = Field(..., min_length=1, max_length=4000, description="Сообщение пользователя")
    user_id: str = Field(..., description="Telegram ID пользователя")
    
    # Опциональный контекст
    wb_api_key: Optional[str] = Field(None, description="Зашифрованный WB API ключ")
    ozon_api_key: Optional[str] = Field(None, description="Зашифрованный Ozon API ключ")
    
    # Для подтверждения операций
    confirmation_id: Optional[str] = Field(None, description="ID операции для подтверждения")
    confirmed: Optional[bool] = Field(None, description="Подтверждение операции")


class ConfirmationRequest(BaseModel):
    """Подтверждение/отмена операции"""
    confirmation_id: str = Field(..., description="ID операции")
    confirmed: bool = Field(..., description="True = подтвердить, False = отменить")
    user_id: str = Field(..., description="Telegram ID пользователя")


# === RESPONSE MODELS ===

class ConfirmationDetails(BaseModel):
    """Детали операции для подтверждения"""
    confirmation_id: str
    operation: str
    description: str
    affected_items: int = 0
    risk_level: Literal["low", "medium", "high"] = "low"


class ChatResponse(BaseModel):
    """Ответ агента"""
    type: ResponseType = ResponseType.TEXT
    content: str = Field(..., description="Текст ответа")
    
    # Метаданные
    model_used: str = Field("gpt-4o-mini", description="Какая модель использована")
    tokens_used: int = Field(0, description="Сколько токенов потрачено")
    execution_time_ms: int = Field(0, description="Время выполнения в мс")
    
    # Для подтверждений
    confirmation: Optional[ConfirmationDetails] = None
    
    # Для данных
    data: Optional[dict] = None
    
    # Timestamp
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ErrorResponse(BaseModel):
    """Ответ с ошибкой"""
    error: str
    detail: Optional[str] = None
    code: str = "UNKNOWN_ERROR"


# === USER CONTEXT ===

class UserContext(BaseModel):
    """Контекст пользователя для агента"""
    user_id: str
    user_name: str = "Продавец"
    
    # Подключенные маркетплейсы
    has_wb: bool = False
    has_ozon: bool = False
    
    # Подписка
    subscription_plan: Literal["free", "pro", "business"] = "free"
    
    # Статистика (передаётся агенту для контекста)
    products_count: int = 0
    total_revenue_month: float = 0.0
