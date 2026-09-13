@echo off
title GESTION PRO GLOBAL - Build APK
echo ===================================================
echo       GESTION PRO GLOBAL - BUILD APK RELEASE
echo ===================================================
echo.

cd /d "%~dp0"
echo [*] Working Directory: %CD%

set "PATH=C:\src\flutter\bin;C:\Program Files\Git\cmd;C:\Windows\System32;C:\Windows\System32\WindowsPowerShell\v1.0;%PATH%"

set "FLUTTER_BIN="
if exist "C:\src\flutter\bin\flutter.bat" (
    set "FLUTTER_BIN=C:\src\flutter\bin\flutter.bat"
    goto :FLUTTER_READY
)
if exist "C:\flutter\bin\flutter.bat" (
    set "FLUTTER_BIN=C:\flutter\bin\flutter.bat"
    goto :FLUTTER_READY
)
if exist "%USERPROFILE%\flutter\bin\flutter.bat" (
    set "FLUTTER_BIN=%USERPROFILE%\flutter\bin\flutter.bat"
    goto :FLUTTER_READY
)

where flutter.bat >nul 2>&1
if %errorlevel% equ 0 (
    set "FLUTTER_BIN=flutter.bat"
    goto :FLUTTER_READY
)

echo [ERROR] Flutter SDK not found in PATH or C:\src\flutter\bin!
echo Please make sure Flutter is installed.
pause
exit /b 1

:FLUTTER_READY
echo [*] Flutter command: %FLUTTER_BIN%
echo.

echo ---------------------------------------------------
echo [1/2] Fetching dependencies (flutter pub get)...
echo ---------------------------------------------------
call "%FLUTTER_BIN%" pub get
if %errorlevel% neq 0 (
    echo [ERROR] flutter pub get failed.
    pause
    exit /b %errorlevel%
)

echo.
echo ---------------------------------------------------
echo [2/2] Building Release APK (flutter build apk --release)...
echo ---------------------------------------------------
call "%FLUTTER_BIN%" build apk --release
if %errorlevel% neq 0 (
    echo [ERROR] Build failed! Check Android SDK / Java settings.
    pause
    exit /b %errorlevel%
)

set "APK_FILE=%CD%\build\app\outputs\flutter-apk\app-release.apk"

echo.
echo ===================================================
if exist "%APK_FILE%" (
    echo [SUCCESS] APK generated successfully!
    echo Location: %APK_FILE%
    echo.
    echo Opening folder...
    explorer /select,"%APK_FILE%"
) else (
    echo [WARNING] Build finished but APK not found at: %APK_FILE%
)
echo ===================================================
echo.
pause
