"""
NeuroAgent Core - Configuration
Все настройки приложения через переменные окружения
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Настройки приложения из .env файла"""
    
    # OpenAI
    openai_api_key: str = ""
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    
    # CORS
    allowed_origins: str = "http://localhost:5173"
    
    # Security
    api_secret_key: str = "change-me-in-production"
    
    # Logging
    log_level: str = "INFO"
    
    # LLM Settings
    fast_model: str = "gpt-4o-mini"  # Для 80% простых запросов
    smart_model: str = "gpt-4o"      # Для 20% сложных запросов
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
    
    @property
    def cors_origins(self) -> list[str]:
        """Парсинг CORS origins из строки"""
        return [origin.strip() for origin in self.allowed_origins.split(",")]


@lru_cache()
def get_settings() -> Settings:
    """Singleton для настроек (кэшируется)"""
    return Settings()
