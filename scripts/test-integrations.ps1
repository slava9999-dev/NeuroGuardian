# scripts/test-integrations.ps1
# Testing all integrations

param(
    [switch]$Quick
)

$ErrorActionPreference = "Stop"

function Write-Test($msg) { Write-Host "[TEST] $msg" -ForegroundColor Yellow }
function Write-Pass($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "🧪 INTEGRATION TESTING"
Write-Host "=========================="
Write-Host ""

$Failed = 0

# ============================================
# PostgreSQL Test
# ============================================
Write-Test "PostgreSQL connection..."
try {
    # Check simple tcp connection first
    $tcp = Test-NetConnection -ComputerName 127.0.0.1 -Port 5432 -WarningAction SilentlyContinue
    if ($tcp.TcpTestSucceeded) {
        Write-Pass "PostgreSQL port 5432 is open"
        
        # Try application level if docker is available
        if (Get-Command docker -ErrorAction SilentlyContinue) {
            $res = docker exec ng_postgres pg_isready -U neuroguardian 2>&1
            if ($res -match "accepting connections") {
                Write-Pass "PostgreSQL is ready (pg_isready)"
            }
        }
    }
    else {
        throw "Port closed"
    }
}
catch {
    Write-Fail "PostgreSQL unavailable"
    $Failed = 1
}

# ============================================
# Redis Test
# ============================================
Write-Test "Redis connection..."
try {
    $tcp = Test-NetConnection -ComputerName 127.0.0.1 -Port 6379 -WarningAction SilentlyContinue
    if ($tcp.TcpTestSucceeded) {
        Write-Pass "Redis port 6379 is open"
    }
    else {
        throw "Port closed"
    }
}
catch {
    Write-Fail "Redis unavailable"
    $Failed = 1
}

# ============================================
# n8n Test
# ============================================
Write-Test "n8n API..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5678/healthz" -Method Get -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Pass "n8n is working"
    }
    else {
        throw "Status $($response.StatusCode)"
    }
}
catch {
    Write-Fail "n8n unavailable: $_"
    $Failed = 1
}

# ============================================
# External APIs (Skip if Quick)
# ============================================
if (-not $Quick) {
    # Load .env.local
    $envPath = Join-Path $PSScriptRoot "..\.env.local"
    if (Test-Path $envPath) {
        Get-Content $envPath | ForEach-Object {
            if ($_ -match "^([^#=]+)=(.*)") {
                [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
            }
        }
    }

    # WB
    Write-Test "Wildberries API..."
    $wbToken = $env:WB_API_TOKEN
    if ($wbToken) {
        try {
            $res = Invoke-WebRequest -Uri "https://suppliers-api.wildberries.ru/api/v3/warehouses" -Headers @{ "Authorization" = $wbToken } -Method Get -ErrorAction Stop
            Write-Pass "Wildberries API working"
        }
        catch {
            Write-Fail "Wildberries API error: $_"
            $Failed = 1
        }
    }
    else {
        Write-Fail "WB_API_TOKEN not set"
        $Failed = 1
    }

    # Ozon
    Write-Test "Ozon API..."
    $ozonId = $env:OZON_CLIENT_ID
    $ozonKey = $env:OZON_API_KEY
    if ($ozonId -and $ozonKey) {
        try {
            $headers = @{ "Client-Id" = $ozonId; "Api-Key" = $ozonKey }
            $res = Invoke-RestMethod -Uri "https://api-seller.ozon.ru/v1/warehouse/list" -Headers $headers -Method Post -Body "{}" -ContentType "application/json" -ErrorAction Stop
            Write-Pass "Ozon API working"
        }
        catch {
            Write-Fail "Ozon API error: $_"
            $Failed = 1
        }
    }
    else {
        Write-Fail "OZON credentials not set"
        $Failed = 1
    }
}

Write-Host ""
Write-Host "=========================="
if ($Failed -eq 0) {
    Write-Host "✅ All tests passed!" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "❌ Some tests failed" -ForegroundColor Red
    exit 1
}
