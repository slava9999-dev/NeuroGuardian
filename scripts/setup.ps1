# ============================================
# NeuroGuardian - Windows Setup Script
# ============================================
# Запуск: .\scripts\setup.ps1
# Требуется: PowerShell 7+, Docker Desktop, Node.js 20+

param(
    [switch]$SkipDocker,
    [switch]$SkipNpm,
    [switch]$Quick
)

$ErrorActionPreference = "Stop"

# Цвета
function Write-Success($msg) { Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "ℹ️  $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "⚠️  $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "❌ $msg" -ForegroundColor Red }

# Баннер
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                                           ║" -ForegroundColor Green
Write-Host "║     🛡️  NEUROGUARDIAN - ПОЛНАЯ НАСТРОЙКА СИСТЕМЫ  🛡️      ║" -ForegroundColor Green
Write-Host "║                                                           ║" -ForegroundColor Green
Write-Host "║     Виктор Маржин - Эксперт по маркетплейсам              ║" -ForegroundColor Green
Write-Host "║                                                           ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# ============================================
# Проверка зависимостей
# ============================================
Write-Info "Проверка системных зависимостей..."

# Node.js
try {
    $nodeVersion = node -v
    $nodeMajor = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($nodeMajor -lt 18) {
        Write-Err "Требуется Node.js 18+. Текущая: $nodeVersion"
        exit 1
    }
    Write-Success "Node.js: $nodeVersion"
} catch {
    Write-Err "Node.js не установлен! Скачайте: https://nodejs.org"
    exit 1
}

# npm
try {
    $npmVersion = npm -v
    Write-Success "npm: v$npmVersion"
} catch {
    Write-Err "npm не найден!"
    exit 1
}

# Docker
if (-not $SkipDocker) {
    try {
        $dockerVersion = docker --version
        Write-Success "Docker: $dockerVersion"
        
        # Проверяем запущен ли Docker
        $dockerInfo = docker info 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "Docker Desktop не запущен! Запустите его вручную."
        }
    } catch {
        Write-Warn "Docker не установлен. Локальные сервисы будут недоступны."
    }
}

# Git
try {
    $gitVersion = git --version
    Write-Success "Git: $gitVersion"
} catch {
    Write-Err "Git не установлен!"
    exit 1
}

Write-Host ""

# ============================================
# Настройка переменных окружения
# ============================================
Write-Info "Проверка переменных окружения..."

$envLocal = Join-Path $PSScriptRoot "..\..\.env.local"
$envExample = Join-Path $PSScriptRoot "..\..\.env.example"

if (-not (Test-Path $envLocal)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envLocal
        Write-Success "Создан .env.local из .env.example"
        Write-Warn "Не забудьте заполнить API ключи в .env.local!"
    } else {
        Write-Warn ".env.example не найден"
    }
} else {
    Write-Info ".env.local уже существует"
}

Write-Host ""

# ============================================
# Установка зависимостей
# ============================================
if (-not $SkipNpm) {
    Write-Info "Установка npm зависимостей..."
    
    Push-Location (Join-Path $PSScriptRoot "..")
    try {
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
        Write-Success "Зависимости установлены"
    } finally {
        Pop-Location
    }
}

Write-Host ""

# ============================================
# Запуск Docker контейнеров
# ============================================
if (-not $SkipDocker) {
    $dockerCompose = Join-Path $PSScriptRoot "..\docker\docker-compose.yml"
    
    if (Test-Path $dockerCompose) {
        Write-Info "Запуск Docker контейнеров..."
        
        # Копируем .env для docker если нет
        $dockerEnv = Join-Path $PSScriptRoot "..\docker\.env"
        $dockerEnvExample = Join-Path $PSScriptRoot "..\docker\.env.docker"
        if (-not (Test-Path $dockerEnv) -and (Test-Path $dockerEnvExample)) {
            Copy-Item $dockerEnvExample $dockerEnv
            Write-Info "Создан docker/.env"
        }
        
        Push-Location (Join-Path $PSScriptRoot "..\docker")
        try {
            docker compose down 2>$null
            docker compose up -d
            if ($LASTEXITCODE -ne 0) { throw "docker compose up failed" }
            Write-Success "Docker контейнеры запущены"
        } finally {
            Pop-Location
        }
        
        # Ждём готовности сервисов
        if (-not $Quick) {
            Write-Info "Ожидание готовности сервисов (30 сек)..."
            Start-Sleep -Seconds 10
            
            # Проверяем PostgreSQL
            Write-Info "Проверка PostgreSQL..."
            $maxAttempts = 10
            for ($i = 1; $i -le $maxAttempts; $i++) {
                try {
                    $result = docker exec ng_postgres pg_isready -U neuroguardian 2>&1
                    if ($result -match "accepting connections") {
                        Write-Success "PostgreSQL готов"
                        break
                    }
                } catch {}
                if ($i -eq $maxAttempts) {
                    Write-Warn "PostgreSQL ещё не готов, продолжаем..."
                }
                Start-Sleep -Seconds 2
            }
        }
    } else {
        Write-Warn "docker-compose.yml не найден"
    }
}

Write-Host ""

# ============================================
# Применение миграций
# ============================================
Write-Info "Применение миграций базы данных..."

Push-Location (Join-Path $PSScriptRoot "..")
try {
    # Проверяем есть ли скрипт миграций
    if (Test-Path "scripts\run-migrations.cjs") {
        npm run db:migrate 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Миграции применены"
        } else {
            Write-Warn "Миграции не применены (возможно БД не настроена)"
        }
    }
} finally {
    Pop-Location
}

Write-Host ""

# ============================================
# Финальная проверка
# ============================================
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    СИСТЕМА ГОТОВА!                        ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Доступные сервисы:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   🌐 Приложение:      http://localhost:3000"
Write-Host "   🔄 n8n Dashboard:   http://localhost:5678"
Write-Host "   🗄️  Adminer (БД):    http://localhost:8080"
Write-Host "   📊 Redis Commander: http://localhost:8081"
Write-Host ""
Write-Host "📝 Credentials для n8n:" -ForegroundColor Cyan
Write-Host "   User: admin"
Write-Host "   Pass: localn8npass (или см. docker/.env)"
Write-Host ""
Write-Host "🚀 Команды для запуска:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   npm run dev         - Запуск приложения"
Write-Host "   npm test            - Запуск тестов"
Write-Host "   .\scripts\health-check.ps1  - Проверка здоровья"
Write-Host ""
Write-Warn "Не забудьте добавить API ключи в .env.local!"
Write-Host ""
