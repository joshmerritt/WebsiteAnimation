# setup.ps1
# Run this from inside your WebsiteAnimation folder.
# It organizes your files and starts a local server for testing.

Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   WebsiteAnimation — Setup Script    ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── 1. Create folder structure ───────────────────────────────────────────────
Write-Host "→ Creating folder structure..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "assets"         | Out-Null
New-Item -ItemType Directory -Force -Path "assets/images"  | Out-Null
Write-Host "  ✓ assets/ and assets/images/ ready" -ForegroundColor Green

# ── 2. Move .txt files into assets/ ─────────────────────────────────────────
Write-Host "→ Moving project .txt files into assets/..." -ForegroundColor Yellow
$txtFiles = @(
    "aboutMe.txt",
    "arduinoCoopDoor.txt",
    "googleDataStudioServiceTechs.txt",
    "powerBIMetrics.txt",
    "thisWebsite.txt"
)
foreach ($file in $txtFiles) {
    if (Test-Path $file) {
        Move-Item -Force $file "assets/$file"
        Write-Host "  ✓ Moved $file → assets/$file" -ForegroundColor Green
    } elseif (Test-Path "assets/$file") {
        Write-Host "  · $file already in assets/" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠ $file not found — add it to assets/ manually" -ForegroundColor Red
    }
}

# ── 3. Move library files into assets/ ──────────────────────────────────────
Write-Host "→ Moving library files into assets/..." -ForegroundColor Yellow

# p5.js — accept either name
if (Test-Path "p5_min.js") {
    Move-Item -Force "p5_min.js" "assets/p5.min.js"
    Write-Host "  ✓ Moved p5_min.js → assets/p5.min.js" -ForegroundColor Green
} elseif (Test-Path "p5.min.js") {
    Move-Item -Force "p5.min.js" "assets/p5.min.js"
    Write-Host "  ✓ Moved p5.min.js → assets/p5.min.js" -ForegroundColor Green
} elseif (Test-Path "assets/p5.min.js") {
    Write-Host "  · p5.min.js already in assets/" -ForegroundColor Gray
} else {
    Write-Host "  ⚠ p5.min.js not found — check index.html uses the CDN link" -ForegroundColor Red
}

# matter.js — check version before moving
if (Test-Path "matter.js") {
    $matterContent = Get-Content "matter.js" -First 10 -Raw
    $versionMatch  = [regex]::Match($matterContent, '"version"\s*:\s*"([\d.]+)"')
    if ($versionMatch.Success) {
        $matterVersion = $versionMatch.Groups[1].Value
        $parts = $matterVersion.Split('.')
        $minor = [int]$parts[1]
        if ($minor -ge 19) {
            Move-Item -Force "matter.js" "assets/matter.js"
            Write-Host "  ✓ matter.js v$matterVersion — moved to assets/ (compatible)" -ForegroundColor Green
            Write-Host ""
            Write-Host "  ACTION: In index.html, replace the CDN matter.js line with:" -ForegroundColor Cyan
            Write-Host '    <script src="assets/matter.js"></script>' -ForegroundColor White
        } else {
            Move-Item -Force "matter.js" "assets/matter.js"
            Write-Host "  ⚠ matter.js v$matterVersion detected (need v0.19+)" -ForegroundColor Red
            Write-Host ""
            Write-Host "  Your local matter.js is too old. Keep the CDN line in index.html:" -ForegroundColor Cyan
            Write-Host '    <script src="https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js"></script>' -ForegroundColor White
            Write-Host "  (The file has been moved to assets/ but won't be used)" -ForegroundColor Gray
        }
    } else {
        Move-Item -Force "matter.js" "assets/matter.js"
        Write-Host "  · matter.js moved to assets/ (version undetected — CDN recommended)" -ForegroundColor Yellow
    }
} elseif (Test-Path "assets/matter.js") {
    Write-Host "  · matter.js already in assets/" -ForegroundColor Gray
}

# ── 4. Check for images ──────────────────────────────────────────────────────
Write-Host ""
Write-Host "→ Checking for project images in assets/images/..." -ForegroundColor Yellow
$imageFiles = @(
    "aboutMe.jpg",
    "arduinoCoopDoor.jpg",
    "googleDataStudioServiceTechs.jpg",
    "powerBIMetrics.jpg",
    "thisWebsite.jpg"
)
$missingImages = @()
foreach ($img in $imageFiles) {
    if (Test-Path "assets/images/$img") {
        Write-Host "  ✓ $img" -ForegroundColor Green
    } else {
        Write-Host "  ✗ MISSING: assets/images/$img" -ForegroundColor Red
        $missingImages += $img
    }
}
if ($missingImages.Count -gt 0) {
    Write-Host ""
    Write-Host "  Add these images to assets/images/ before running the site." -ForegroundColor Red
}

# ── 5. Check for new source files ────────────────────────────────────────────
Write-Host ""
Write-Host "→ Checking for rewritten source files..." -ForegroundColor Yellow
$sourceFiles = @("index.html", "sketch.js", "imageBall.js", "App.jsx", "main.css",
                  "boundary.js", "goal.js", "net.js", "menu.js", "contactUs.js")
foreach ($f in $sourceFiles) {
    if (Test-Path $f) {
        Write-Host "  ✓ $f" -ForegroundColor Green
    } else {
        Write-Host "  ✗ MISSING: $f — copy it from Claude's output" -ForegroundColor Red
    }
}

# ── 6. Start a local server ───────────────────────────────────────────────────
Write-Host ""
Write-Host "─────────────────────────────────────────" -ForegroundColor DarkGray
if ($missingImages.Count -gt 0) {
    Write-Host "⚠ Add missing images before launching, then re-run this script." -ForegroundColor Yellow
} else {
    Write-Host "✓ Setup complete! Launching local server..." -ForegroundColor Green
    Write-Host ""
    Write-Host "  Open your browser to: http://localhost:8000" -ForegroundColor Cyan
    Write-Host "  Press Ctrl+C to stop the server." -ForegroundColor Gray
    Write-Host ""
    # Try Python first, fall back to Node
    $python = Get-Command python -ErrorAction SilentlyContinue
    $node   = Get-Command node   -ErrorAction SilentlyContinue
    if ($python) {
        python -m http.server 8000
    } elseif ($node) {
        npx serve . --listen 8000
    } else {
        Write-Host "  No server found. Install Python or Node.js, or use VS Code Live Server." -ForegroundColor Red
    }
}
