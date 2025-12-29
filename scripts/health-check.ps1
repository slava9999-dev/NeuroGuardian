# ============================================
# NeuroGuardian - Health Check Script
# ============================================
# Запуск: .\scripts\health-check.ps1
# Быстрая проверка: .\scripts\health-check.ps1 -Quick

param(
    [switch]$Quick,
    [switch]$Json
)

$results = @{
    timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    status = "healthy"
    services = @{}
}

# Функции
function Test-Service($name, $url, $expected = 200) {
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq $expected) {
            return @{ status = "ok"; code = $response.StatusCode }
        }
        return @{ status = "error"; code = $response.StatusCode }
    } catch {
        return @{ status = "error"; message = $_.Exception.Message }
    }
}

function Test-Port($port) {
    try {
        $connection = New-Object System.Net.Sockets.TcpClient
        $connection.Connect("localhost", $port)
        $connection.Close()
        return $true
    } catch {
        return $false
    }
}

# Вывод
if (-not $Json) {
    Write-Host ""
    Write-Host "🏥 HEALTH CHECK - NEUROGUARDIAN" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
}

# ============================================
# Docker контейнеры
# ============================================
if (-not $Json) {
    Write-Host "📦 Docker контейнеры:" -ForegroundColor Yellow
}

try {
    $containers = docker ps --format "{{.Names}}: {{.Status}}" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $ngContainers = $containers | Where-Object { $_ -match "^ng_" }
        if ($ngContainers) {
            $results.services["docker"] = @{ status = "ok"; containers = @($ngContainers) }
            if (-not $Json) {
                $ngContainers | ForEach-Object { Write-Host "   ✅ $_" -ForegroundColor Green }
            }
        } else {
            $results.services["docker"] = @{ status = "warning"; message = "No NG containers" }
            if (-not $Json) {
                Write-Host "   ⚠️  Нет запущенных контейнеров NeuroGuardian" -ForegroundColor Yellow
            }
        }
    }
} catch {
    $results.services["docker"] = @{ status = "error"; message = "Docker not available" }
    if (-not $Json) {
        Write-Host "   ❌ Docker не запущен" -ForegroundColor Red
    }
}

if (-not $Json) { Write-Host "" }

# ============================================
# Порты сервисов
# ============================================
if (-not $Json) {
    Write-Host "🌐 Сервисы:" -ForegroundColor Yellow
}

$services = @(
    @{ name = "PostgreSQL"; port = 5432 }
    @{ name = "Redis"; port = 6379 }
    @{ name = "n8n"; port = 5678 }
    @{ name = "App"; port = 3000 }
    @{ name = "Adminer"; port = 8080 }
    @{ name = "Redis Commander"; port = 8081 }
)

foreach ($svc in $services) {
    $isOpen = Test-Port $svc.port
    $results.services[$svc.name] = @{ status = if ($isOpen) { "ok" } else { "error" }; port = $svc.port }
    
    if (-not $Json) {
        if ($isOpen) {
            Write-Host "   ✅ $($svc.name): порт $($svc.port) открыт" -ForegroundColor Green
        } else {
            Write-Host "   ❌ $($svc.name): порт $($svc.port) закрыт" -ForegroundColor Red
        }
    }
}

if (-not $Json) { Write-Host "" }

# ============================================
# HTTP Health Checks
# ============================================
if (-not $Quick) {
    if (-not $Json) {
        Write-Host "🔗 HTTP Endpoints:" -ForegroundColor Yellow
    }
    
    $endpoints = @(
        @{ name = "App Health"; url = "http://localhost:3000/api/health" }
        @{ name = "n8n Health"; url = "http://localhost:5678/healthz" }
    )
    
    foreach ($ep in $endpoints) {
        $result = Test-Service $ep.name $ep.url
        $results.services["$($ep.name)_http"] = $result
        
        if (-not $Json) {
            if ($result.status -eq "ok") {
                Write-Host "   ✅ $($ep.name): OK" -ForegroundColor Green
            } else {
                Write-Host "   ❌ $($ep.name): $($result.message)" -ForegroundColor Red
            }
        }
    }
    
    if (-not $Json) { Write-Host "" }
}

# ============================================
# Итоговый статус
# ============================================
$errorCount = ($results.services.Values | Where-Object { $_.status -eq "error" }).Count
if ($errorCount -gt 0) {
    $results.status = "unhealthy"
}

if ($Json) {
    $results | ConvertTo-Json -Depth 3
} else {
    Write-Host "================================" -ForegroundColor Cyan
    if ($results.status -eq "healthy") {
        Write-Host "✅ Система здорова!" -ForegroundColor Green
    } else {
        Write-Host "❌ Обнаружены проблемы ($errorCount сервисов недоступны)" -ForegroundColor Red
    }
    Write-Host ""
}

exit $(if ($results.status -eq "healthy") { 0 } else { 1 })
