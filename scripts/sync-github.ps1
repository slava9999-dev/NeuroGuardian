# scripts/sync-github.ps1
# Sync with GitHub and check status

$ErrorActionPreference = "Stop"

function Write-Info($msg) { Write-Host "ℹ️  $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "⚠️  $msg" -ForegroundColor Yellow }

Write-Host ""
Write-Host "🔄 GITHUB SYNCHRONIZATION"
Write-Host "========================="
Write-Host ""

# Check Branch
$currentBranch = git branch --show-current
Write-Info "Current branch: $currentBranch"

# Check Status
$status = git status --porcelain
if ($status) {
    Write-Warn "You have uncommitted changes:"
    git status --short
    Write-Host ""
    
    $continue = Read-Host "Continue syncing? (y/n)"
    if ($continue -ne "y") {
        exit 0
    }
}

# Fetch
Write-Info "Fetching latest changes..."
git fetch origin

# Check divergence
try {
    $local = git rev-parse "@"
    $remote = git rev-parse "@{u}" 2>$null
    $base = git merge-base "@" "@{u}" 2>$null
    
    if (-not $remote) {
        Write-Warn "Upstream not configured"
    }
    elseif ($local -eq $remote) {
        Write-Success "Branch is up to date with origin"
    }
    elseif ($local -eq $base) {
        Write-Warn "New commits on origin. Run: git pull"
    }
    elseif ($remote -eq $base) {
        Write-Warn "Local commits ready to push. Run: git push"
    }
    else {
        Write-Warn "Branches have diverged. Merge/Rebase required."
    }
}
catch {
    Write-Warn "Could not check upstream status (upstream might be missing)"
}

# GH CLI Check
if (Get-Command gh -ErrorAction SilentlyContinue) {
    Write-Info "Recent GitHub Actions:"
    gh run list --limit 5
}
else {
    Write-Warn "GitHub CLI (gh) not installed. Cannot check CI status."
}

Write-Host ""
Write-Success "Sync check complete"
