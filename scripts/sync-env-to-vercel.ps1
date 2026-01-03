# ============================================
# Sync local .env.local to Vercel Production
# ============================================

Write-Host "`n🔄 Syncing environment variables to Vercel Production" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# Keys to sync
$keysToSync = @(
    "ADMIN_API_KEY",
    "GROQ_API_KEY",
    "YOOKASSA_SHOP_ID",
    "YOOKASSA_SECRET_KEY"
)

# Load environment from .env.local
$envFile = Get-Content -Path ".env.local" -ErrorAction Stop
$envVars = @{}

foreach ($line in $envFile) {
    if ($line -match "^([^=#]+)=(.*)$") {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        # Remove quotes if present
        $value = $value -replace '^["'']|["'']$', ''
        if ($value) {
            $envVars[$key] = $value
        }
    }
}

Write-Host "`nFound keys in .env.local:" -ForegroundColor Yellow
foreach ($key in $keysToSync) {
    if ($envVars.ContainsKey($key)) {
        $masked = $envVars[$key].Substring(0, [Math]::Min(4, $envVars[$key].Length)) + "***"
        Write-Host "  ✅ $key = $masked" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $key = NOT FOUND" -ForegroundColor Red
    }
}

Write-Host "`nReady to sync to Vercel Production." -ForegroundColor Cyan
Write-Host "Run the following commands manually:" -ForegroundColor Yellow
Write-Host ""

foreach ($key in $keysToSync) {
    if ($envVars.ContainsKey($key)) {
        $value = $envVars[$key]
        Write-Host "echo `"$value`" | vercel env add $key production" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "After adding, redeploy with: vercel --prod" -ForegroundColor Cyan
