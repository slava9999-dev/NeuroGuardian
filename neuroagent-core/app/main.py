"""
NeuroAgent Core - FastAPI Main Application
Точка входа в приложение
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import logging

from .core.config import get_settings, Settings
from .core.orchestrator import NeuroAgentOrchestrator
from .schemas.messages import ChatRequest, ChatResponse, UserContext, ErrorResponse


# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("neuroagent")


# Хранилище сессий агентов (в памяти, для MVP)
agent_sessions: dict[str, NeuroAgentOrchestrator] = {}


def get_or_create_agent(user_id: str) -> NeuroAgentOrchestrator:
    """Получить или создать агента для пользователя"""
    if user_id not in agent_sessions:
        agent_sessions[user_id] = NeuroAgentOrchestrator(user_id=user_id)
        logger.info(f"Created new agent session for user {user_id}")
    return agent_sessions[user_id]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle hooks — запуск и остановка"""
    settings = get_settings()
    logger.info("🚀 NeuroAgent Core starting...")
    logger.info(f"   Debug mode: {settings.debug}")
    logger.info(f"   Fast model: {settings.fast_model}")
    logger.info(f"   Smart model: {settings.smart_model}")
    
    if not settings.openai_api_key:
        logger.warning("⚠️  OPENAI_API_KEY not set!")
    
    yield
    
    logger.info("👋 NeuroAgent Core shutting down...")
    agent_sessions.clear()


# Создание приложения
app = FastAPI(
    title="NeuroAgent Core",
    description="AI Agent для продавцов маркетплейсов WB/Ozon",
    version="0.1.0",
    lifespan=lifespan,
)


# CORS middleware
@app.on_event("startup")
async def setup_cors():
    settings = get_settings()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# ============================================
# ENDPOINTS
# ============================================

@app.get("/")
async def root():
    """Health check"""
    return {
        "service": "neuroagent-core",
        "status": "healthy",
        "version": "0.1.0",
    }


@app.get("/health")
async def health():
    """Детальный health check"""
    settings = get_settings()
    return {
        "status": "healthy",
        "openai_configured": bool(settings.openai_api_key),
        "active_sessions": len(agent_sessions),
    }


@app.post("/api/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    settings: Settings = Depends(get_settings)
):
    """
    Главный endpoint для общения с агентом.
    
    Принимает сообщение пользователя, обрабатывает через LangChain,
    возвращает умный ответ.
    """
    try:
        # Проверка API ключа
        if not settings.openai_api_key:
            raise HTTPException(
                status_code=500,
                detail="OpenAI API key not configured"
            )
        
        # Получаем или создаём агента
        agent = get_or_create_agent(request.user_id)
        
        # Формируем контекст пользователя
        # TODO: Получать из БД
        user_context = UserContext(
            user_id=request.user_id,
            user_name="Продавец",
            has_wb=bool(request.wb_api_key),
            has_ozon=bool(request.ozon_api_key),
        )
        
        # Обрабатываем сообщение
        response = await agent.process_message(
            message=request.message,
            user_context=user_context
        )
        
        logger.info(
            f"User {request.user_id}: '{request.message[:50]}...' -> "
            f"{response.model_used} ({response.tokens_used} tokens, {response.execution_time_ms}ms)"
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Error processing chat: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@app.post("/api/chat/clear")
async def clear_chat(user_id: str):
    """Очистить историю чата для пользователя"""
    if user_id in agent_sessions:
        del agent_sessions[user_id]
        return {"status": "cleared"}
    return {"status": "no_session"}


# ============================================
# RUN SERVER (for local development)
# ============================================

if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
