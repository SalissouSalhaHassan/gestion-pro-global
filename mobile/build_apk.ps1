# ===================================================
# GESTION PRO GLOBAL - Build Release APK (PowerShell)
# ===================================================

$Host.UI.RawUI.WindowTitle = "GESTION PRO GLOBAL - Build APK"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "      GESTION PRO GLOBAL - BUILD APK RELEASE       " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location -Path $PSScriptRoot
Write-Host "[*] Working Directory: $PWD" -ForegroundColor Gray

# 1. Add known Flutter paths to environment
$flutterPaths = @(
    "C:\src\flutter\bin",
    "C:\flutter\bin",
    "$env:USERPROFILE\flutter\bin",
    "$env:USERPROFILE\development\flutter\bin"
)

foreach ($p in $flutterPaths) {
    if (Test-Path $p) {
        $env:PATH = "$p;$env:PATH"
    }
}

# 2. Check Flutter command
$flutterCmd = Get-Command flutter -ErrorAction SilentlyContinue
if (-not $flutterCmd) {
    Write-Host "[ERROR] Flutter command not found in PATH!" -ForegroundColor Red
    Write-Host "Please ensure Flutter SDK is installed." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[OK] Flutter found: $($flutterCmd.Source)" -ForegroundColor Green
Write-Host ""

# 3. Dependencies
Write-Host "---------------------------------------------------" -ForegroundColor Yellow
Write-Host "[1/2] Fetching dependencies (flutter pub get)..." -ForegroundColor Yellow
Write-Host "---------------------------------------------------" -ForegroundColor Yellow

& $flutterCmd.Source pub get
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to fetch dependencies!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "---------------------------------------------------" -ForegroundColor Yellow
Write-Host "[2/2] Building Release APK (flutter build apk --release)..." -ForegroundColor Yellow
Write-Host "---------------------------------------------------" -ForegroundColor Yellow

& $flutterCmd.Source build apk --release
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Build failed! Check Android SDK / Java settings." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit $LASTEXITCODE
}

$apkPath = Join-Path $PWD "build\app\outputs\flutter-apk\app-release.apk"

Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
if (Test-Path $apkPath) {
    Write-Host "[SUCCESS] APK generated successfully!" -ForegroundColor Green
    Write-Host "Location: $apkPath" -ForegroundColor White
    Write-Host ""
    Write-Host "Opening output folder in Explorer..." -ForegroundColor Cyan
    explorer.exe /select,$apkPath
} else {
    Write-Host "[WARNING] Build finished but file not found at: $apkPath" -ForegroundColor Yellow
}
Write-Host "===================================================" -ForegroundColor Green
Write-Host ""

Read-Host "Press Enter to exit"
