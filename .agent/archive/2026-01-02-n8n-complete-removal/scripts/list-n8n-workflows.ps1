# scripts/list-n8n-workflows.ps1
# List n8n workflows from the container

$ErrorActionPreference = "Stop"

Write-Host "📋 N8N WORKFLOWS STATUS"
Write-Host "========================="

try {
    # Check if container is running
    $status = docker inspect -f '{{.State.Running}}' ng_n8n 2>&1
    if ($status -ne 'true') { throw "Container ng_n8n is not running" }

    # Fetch workflows from SQLite/Postgres DB inside container
    # Since we can't easily use n8n CLI list command (it doesn't exist in all versions),
    # we'll query the DB directly if possible or just use the export command to see what's there.
    
    # Try exporting to stdout to see metadata
    $cmd = "n8n export:workflow --all"
    $res = docker exec ng_n8n sh -c $cmd 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        # The output is a JSON array of workflows. We parse it to list names and active status.
        # Check if output is valid JSON
        if ($res.Trim().StartsWith("[")) {
            $workflows = $res | ConvertFrom-Json
            
            foreach ($wf in $workflows) {
                $statusIcon = if ($wf.active) { "✅" } else { "⭕" }
                Write-Host "$statusIcon $($wf.id) - $($wf.name) (Active: $($wf.active))"
            }
        }
        else {
            Write-Host "Raw output received (not JSON):"
            Write-Host $res -ForegroundColor Gray
        }
    }
    else {
        Write-Host "Failed to list workflows via CLI:" -ForegroundColor Red
        Write-Host $res -ForegroundColor DarkGray
    }

}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
