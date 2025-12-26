@echo off
REM ============================================
REM NeuroGUARDIAN — n8n Local Setup Script
REM Запускает n8n с переменными из Vercel
REM ============================================

echo.
echo ============================================
echo   NeuroGUARDIAN n8n Local Setup
echo ============================================
echo.

REM Проверка Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker не установлен или не запущен!
    echo Установите Docker Desktop: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo [OK] Docker обнаружен
echo.

REM Создаём .env файл если его нет
if not exist ".env.n8n" (
    echo [INFO] Создаём .env.n8n файл...
    echo.
    
    REM Пытаемся получить переменные из Vercel
    echo Попытка получить переменные из Vercel...
    vercel env pull .env.vercel --yes >nul 2>&1
    
    if exist ".env.vercel" (
        echo [OK] Переменные из Vercel получены
        
        REM Копируем нужные переменные
        echo # n8n Environment Variables > .env.n8n
        echo # Generated from Vercel >> .env.n8n
        echo. >> .env.n8n
        echo API_URL=https://neuro-guardian.vercel.app >> .env.n8n
        
        REM Извлекаем переменные из .env.vercel
        for /f "tokens=1,2 delims==" %%a in (.env.vercel) do (
            if "%%a"=="CRON_SECRET" echo CRON_SECRET=%%b >> .env.n8n
            if "%%a"=="TELEGRAM_BOT_TOKEN" echo TELEGRAM_BOT_TOKEN=%%b >> .env.n8n
            if "%%a"=="ADMIN_API_KEY" echo ADMIN_API_KEY=%%b >> .env.n8n
        )
        
        echo ADMIN_CHAT_ID=7548070478 >> .env.n8n
        
        echo [OK] .env.n8n создан
    ) else (
        echo [WARN] Не удалось получить переменные из Vercel
        echo [INFO] Создаём шаблон .env.n8n...
        
        echo # n8n Environment Variables > .env.n8n
        echo # Заполните значения вручную >> .env.n8n
        echo. >> .env.n8n
        echo API_URL=https://neuro-guardian.vercel.app >> .env.n8n
        echo CRON_SECRET=YOUR_CRON_SECRET_HERE >> .env.n8n
        echo TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE >> .env.n8n
        echo ADMIN_CHAT_ID=7548070478 >> .env.n8n
        
        echo.
        echo [ACTION] Отредактируйте .env.n8n и добавьте реальные значения!
    )
)

echo.
echo [INFO] Используем переменные из .env.n8n
echo.

REM Создаём папку для workflows
if not exist "n8n-workflows" mkdir n8n-workflows

REM Запускаем Docker Compose
echo [INFO] Запускаем n8n...
echo.

docker-compose -f docker-compose.n8n.yml --env-file .env.n8n up -d

if errorlevel 1 (
    echo.
    echo [ERROR] Ошибка запуска Docker!
    pause
    exit /b 1
)

echo.
echo ============================================
echo   n8n успешно запущен!
echo ============================================
echo.
echo   URL:      http://localhost:5678
echo   Login:    admin
echo   Password: neuroguardian2024
echo.
echo   Переменные окружения загружены из .env.n8n
echo.
echo   Для остановки: docker-compose -f docker-compose.n8n.yml down
echo ============================================
echo.

REM Открываем браузер
timeout /t 3 >nul
start http://localhost:5678

pause
