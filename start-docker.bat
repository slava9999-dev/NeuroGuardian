@echo off
REM ============================================
REM NeuroGuardian - Quick Docker Start
REM ============================================
REM Двойной клик для запуска всех Docker сервисов

echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║     🛡️  NEUROGUARDIAN - ЗАПУСК DOCKER СЕРВИСОВ  🛡️        ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

REM Проверка Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker не найден! Установите Docker Desktop.
    pause
    exit /b 1
)

REM Переход в директорию docker
cd /d "%~dp0docker"

REM Копирование .env если нет
if not exist ".env" (
    if exist ".env.docker" (
        copy ".env.docker" ".env"
        echo ✅ Создан docker/.env
    )
)

echo 🚀 Запуск контейнеров...
docker compose up -d

if errorlevel 1 (
    echo ❌ Ошибка запуска контейнеров!
    pause
    exit /b 1
)

echo.
echo ✅ Контейнеры запущены!
echo.
echo 📍 Доступные сервисы:
echo    🌐 Приложение:      http://localhost:3000
echo    🔄 n8n Dashboard:   http://localhost:5678
echo    🗄️  Adminer:         http://localhost:8080
echo    📊 Redis Commander: http://localhost:8081
echo.
echo 📝 Credentials для n8n: admin / localn8npass
echo.

REM Открыть n8n в браузере
timeout /t 3 >nul
start http://localhost:5678

pause
