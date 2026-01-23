@echo off
TITLE NeuroGUARDIAN - Portable Mode
echo ========================================================
echo   🚀 NeuroGUARDIAN Industrial: USB PORTABLE MODE
echo ========================================================
echo.

:: 1. Check for Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is NOT installed on this machine.
    echo Please install Docker Desktop to run NeuroGUARDIAN from USB.
    pause
    exit /b
)

:: 2. Load Environment from USB
if not exist .env (
    echo [WARN] .env not found. Creating from example...
    copy .env.example .env
)

:: 3. Launch Industrial Stack
echo [INIT] Starting isolated Docker containers...
cd docker
docker-compose up -d

echo.
echo ========================================================
echo   ✅ SYSTEM IS LIVE (LOCAL-FIRST)
echo   Dashboard: http://localhost:3000
echo   API: http://localhost:3001
echo ========================================================
echo.
pause
