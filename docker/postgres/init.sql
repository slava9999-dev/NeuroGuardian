-- ============================================
-- NeuroGuardian - Database Initialization
-- ============================================
-- Этот файл выполняется при первом запуске PostgreSQL контейнера

-- Создаём отдельную базу для n8n (опционально)
CREATE DATABASE n8n;

-- Устанавливаем расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Создаём схему для приложения
CREATE SCHEMA IF NOT EXISTS app;

-- Выводим информацию о готовности
DO $$
BEGIN
    RAISE NOTICE '✅ NeuroGuardian database initialized successfully!';
    RAISE NOTICE '📦 Extensions: uuid-ossp, pg_trgm';
    RAISE NOTICE '🗂️  Schema: app';
END $$;
