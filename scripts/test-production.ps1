# ============================================
# NeuroGUARDIAN — Production Test Script
# ============================================

# Load environment from .env.local
$envFile = Get-Content -Path ".env.local" -ErrorAction SilentlyContinue
$envVars = @{}

foreach ($line in $envFile) {
    if ($line -match "^([^=]+)=(.*)$") {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        # Remove quotes if present
        $value = $value -replace '^["'']|["'']$', ''
        $envVars[$key] = $value
    }
}

$ADMIN_KEY = $envVars["ADMIN_API_KEY"]
$API_BASE = "https://neuro-guardian.vercel.app/api"

Write-Host "`n🔧 NeuroGUARDIAN Production Test" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "`n1️⃣ Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$API_BASE`?action=health"
    Write-Host "   ✅ Status: $($health.status)" -ForegroundColor Green
    Write-Host "   ✅ Database: $($health.database)" -ForegroundColor Green
    Write-Host "   ✅ Version: $($health.version)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}

# Test 2: Telegram Webhook Info
Write-Host "`n2️⃣ Telegram Webhook Status..." -ForegroundColor Yellow
try {
    $webhookInfo = Invoke-RestMethod -Uri "$API_BASE`?action=telegram-webhook-info" -Headers @{"X-Admin-Key"=$ADMIN_KEY}
    Write-Host "   ✅ Webhook URL: $($webhookInfo.url)" -ForegroundColor Green
    Write-Host "   ✅ Pending updates: $($webhookInfo.pending_update_count)" -ForegroundColor Green
    if ($webhookInfo.last_error_message) {
        Write-Host "   ⚠️ Last error: $($webhookInfo.last_error_message)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   ℹ️ Setting up webhook..." -ForegroundColor Cyan
    
    try {
        $setResult = Invoke-RestMethod -Uri "$API_BASE`?action=telegram-set-webhook" -Method POST -Headers @{"X-Admin-Key"=$ADMIN_KEY}
        Write-Host "   ✅ Webhook set: $($setResult | ConvertTo-Json -Compress)" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Failed to set webhook: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 3: Subscription Tiers
Write-Host "`n3️⃣ Subscription Tiers..." -ForegroundColor Yellow
try {
    $tiers = Invoke-RestMethod -Uri "$API_BASE`?action=subscription-tiers"
    Write-Host "   ✅ Tiers loaded: $($tiers.tiers.Count) plans" -ForegroundColor Green
    foreach ($tier in $tiers.tiers) {
        Write-Host "      - $($tier.name_ru): $($tier.price_monthly)₽/мес" -ForegroundColor White
    }
} catch {
    Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "✅ Production tests complete!" -ForegroundColor Green
Write-Host ""
