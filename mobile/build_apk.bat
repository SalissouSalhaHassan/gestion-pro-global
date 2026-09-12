@echo off
chcp 65001 >nul
title GESTION PRO GLOBAL - Construction de l'application Mobile (APK)

echo =====================================================================
echo           GESTION PRO GLOBAL - BUILD APK (RELEASE)
echo =====================================================================
echo.

:: 1. Aller dans le dossier du script
cd /d "%~dp0"
echo [INFO] Dossier de travail : %CD%

:: 2. Recherche automatique de Flutter dans le PATH ou les dossiers usuels
set "FLUTTER_CMD=flutter"
where flutter >nul 2>&1
if %errorlevel% equ 0 goto :FLUTTER_FOUND

if exist "C:\flutter\bin\flutter.bat" (
    set "FLUTTER_CMD=C:\flutter\bin\flutter.bat"
    goto :FLUTTER_FOUND
)
if exist "C:\src\flutter\bin\flutter.bat" (
    set "FLUTTER_CMD=C:\src\flutter\bin\flutter.bat"
    goto :FLUTTER_FOUND
)
if exist "%USERPROFILE%\flutter\bin\flutter.bat" (
    set "FLUTTER_CMD=%USERPROFILE%\flutter\bin\flutter.bat"
    goto :FLUTTER_FOUND
)
if exist "%USERPROFILE%\development\flutter\bin\flutter.bat" (
    set "FLUTTER_CMD=%USERPROFILE%\development\flutter\bin\flutter.bat"
    goto :FLUTTER_FOUND
)
if exist "D:\flutter\bin\flutter.bat" (
    set "FLUTTER_CMD=D:\flutter\bin\flutter.bat"
    goto :FLUTTER_FOUND
)

echo.
echo [ERREUR] Flutter n'a pas été trouvé dans le PATH ni dans les emplacements habituels.
echo Veuillez vous assurer que Flutter SDK est installé et accessible dans les variables d'environnement.
echo.
pause
exit /b 1

:FLUTTER_FOUND
echo [OK] Flutter detecte : %FLUTTER_CMD%
echo.

:: 3. Téléchargement des dépendances
echo ---------------------------------------------------------------------
echo [ETAPE 1/3] Telechargement des dependances (flutter pub get)...
echo ---------------------------------------------------------------------
call "%FLUTTER_CMD%" pub get
if %errorlevel% neq 0 (
    echo.
    echo [ERREUR] Echec lors de la recuperation des dependances.
    pause
    exit /b %errorlevel%
)

:: 4. Nettoyage prealable optionnel
echo.
echo ---------------------------------------------------------------------
echo [ETAPE 2/3] Verification et compilation de l'APK Release...
echo ---------------------------------------------------------------------

:: 5. Compilation en mode Release
call "%FLUTTER_CMD%" build apk --release
if %errorlevel% neq 0 (
    echo.
    echo [ERREUR] Echec lors de la compilation de l'APK.
    echo Verifiez votre configuration Android SDK et Java JDK.
    pause
    exit /b %errorlevel%
)

:: 6. Verification du fichier de sortie
set "APK_PATH=%CD%\build\app\outputs\flutter-apk\app-release.apk"

echo.
echo =====================================================================
if exist "%APK_PATH%" (
    echo [SUCCES] L'APK a ete genere avec succes !
    echo Emplacement : %APK_PATH%
    echo.
    echo Ouverture du dossier contenant l'APK...
    explorer /select,"%APK_PATH%"
) else (
    echo [AVERTISSEMENT] Compilation terminee mais fichier introuvable a :
    echo %APK_PATH%
)
echo =====================================================================
echo.
pause
