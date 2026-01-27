param (
    [Parameter(Mandatory = $true)]
    [string]$ServerIP
)

Write-Host "🚀 Starting Deployment to $ServerIP..." -ForegroundColor Cyan

# 1. Copy Files
Write-Host "`n📦 Copying deployment files (You may be asked for password)..." -ForegroundColor Yellow
scp -r .\deploy\* root@${ServerIP}:/root/

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ SCP Failed. Check IP or Password." -ForegroundColor Red
    exit 1
}

# 2. Execute Setup
Write-Host "`n🔧 Running Setup Script on Remote Server..." -ForegroundColor Yellow
ssh -t root@${ServerIP} "chmod +x setup.sh && ./setup.sh"

Write-Host "`n✅ Deployment Files Transferred & Setup Complete!" -ForegroundColor Green
Write-Host "👉 Now SSH into the server to set secrets and start docker:" -ForegroundColor Cyan
Write-Host "   ssh root@${ServerIP}"
