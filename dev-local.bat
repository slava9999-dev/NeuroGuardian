@echo off
REM ============================================
REM NeuroGUARDIAN - Local Development Starter
REM ============================================
echo.
echo NeuroGUARDIAN Local Development
echo ================================
echo.

REM Check if Vercel CLI is installed
where vercel >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Vercel CLI is not installed!
    echo.
    echo Install it with: npm install -g vercel
    echo.
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    echo [WARNING] .env file not found!
    echo.
    echo Copy .env.example to .env and configure:
    echo   copy .env.example .env
    echo.
    echo Then add your actual values:
    echo   - POSTGRES_URL
    echo   - ADMIN_API_KEY
    echo   - CRON_SECRET
    echo   - At least one AI key (AGENTROUTER/GROQ/OPENAI)
    echo.
    pause
    exit /b 1
)

echo Starting Vercel Dev Server...
echo.
echo This will run BOTH frontend and backend on http://localhost:3000
echo.
echo Press Ctrl+C to stop
echo.

vercel dev
