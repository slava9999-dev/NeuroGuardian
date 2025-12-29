# scripts/activate-all-workflows.ps1
# Activate all n8n workflows

$ErrorActionPreference = "Stop"

function Write-Info($msg) { Write-Host "ℹ️  $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "❌ $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "⚡ ACTIVATING ALL N8N WORKFLOWS"
Write-Host "============================"
Write-Host ""

try {
    # Check container
    $status = docker inspect -f '{{.State.Running}}' ng_n8n 2>&1
    if ($status -ne 'true') { throw "Container ng_n8n is not running" }

    Write-Info "Activating all workflows..."
    
    # Run activation command
    $cmd = "n8n update:workflow --all --active=true"
    $res = docker exec ng_n8n sh -c $cmd 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "All workflows activated successfully."
        Write-Host $res -ForegroundColor Gray
    }
    else {
        Write-Err "Failed to activate workflows:"
        Write-Host $res -ForegroundColor DarkGray
    }

}
catch {
    Write-Err "Error: $_"
}
