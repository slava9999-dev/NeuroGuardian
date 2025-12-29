# scripts/import-workflows-cli.ps1
# Import workflows using n8n CLI (no API key required)

$ErrorActionPreference = "Stop"

function Write-Info($msg) { Write-Host "ℹ️  $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "❌ $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "🔄 N8N WORKFLOW IMPORT (CLI)"
Write-Host "============================"
Write-Host ""

$destDir = Join-Path $PSScriptRoot "..\docker\n8n\workflows"
$srcDir = Join-Path $PSScriptRoot "..\n8n-workflows"

# 1. Create docker mount dir if missing
if (-not (Test-Path $destDir)) {
    Write-Info "Creating directory: $destDir"
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
}

# 2. Copy workflows
Write-Info "Copying workflows to docker mount..."
$workflows = Get-ChildItem $srcDir -Filter "*.json"
foreach ($wf in $workflows) {
    Copy-Item $wf.FullName -Destination $destDir -Force
    Write-Host "   - Copied $($wf.Name)" -ForegroundColor Gray
}

# 3. Import via Docker Exec
Write-Info "Importing into n8n container..."

# Check if container runs
try {
    $status = docker inspect -f '{{.State.Running}}' ng_n8n
    if ($status -ne 'true') { throw "Container not running" }
}
catch {
    Write-Err "n8n container (ng_n8n) is not running!"
    exit 1
}

foreach ($wf in $workflows) {
    Write-Host "   Importing $($wf.Name)..." -NoNewline
    try {
        # n8n inside container reads from /home/node/workflows
        $cmd = "n8n import:workflow --input=/home/node/workflows/$($wf.Name)"
        $res = docker exec ng_n8n sh -c $cmd 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host " OK" -ForegroundColor Green
        }
        else {
            Write-Host " FAILED" -ForegroundColor Red
            Write-Host $res -ForegroundColor DarkGray
        }
    }
    catch {
        Write-Host " ERROR" -ForegroundColor Red
        Write-Host $_ -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Success "Import complete."
Write-Host "Note: Workflows are imported but may default to INACTIVE."
Write-Host "Go to http://localhost:5678 to activate them."
