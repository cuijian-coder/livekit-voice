@echo off
echo ============================================================
echo Electron Build Script for Windows
echo ============================================================

echo [1/5] Checking prerequisites...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)
echo   Node.js: OK

pnpm --version
if %errorlevel% neq 0 (
    echo ERROR: pnpm not found. Run: npm install -g pnpm
    pause
    exit /b 1
)
echo   pnpm: OK

echo [2/5] Installing Electron dependencies...
cd /d "frontend"
call pnpm install
if %errorlevel% neq 0 (
    echo ERROR: Dependency installation failed
    pause
    exit /b 1
)

echo [3/5] Building frontend renderer process...
call pnpm build
if %errorlevel% neq 0 (
    echo ERROR: Frontend build failed
    pause
    exit /b 1
)

echo [4/5] Building Electron main process...
call pnpm vite build --config vite.electron.config.ts
if %errorlevel% neq 0 (
    echo ERROR: Electron main process build failed
    pause
    exit /b 1
)


echo [5/5] Packaging Electron app...
call pnpm electron-builder --config electron-builder.json
if %errorlevel% neq 0 (
    echo ERROR: Packaging failed
    pause
    exit /b 1
)


echo ============================================================
echo SUCCESS - Build complete!
echo ============================================================

echo Output location:
echo   frontend\release\

echo Packages:
echo   - Windows: LiveKit Voice Chat Setup.exe
echo   - macOS:   LiveKit Voice Chat.dmg
echo   - Linux:   LiveKit Voice Chat.AppImage

echo Config file (auto-created on first run):
echo   %%APPDATA%%\livekit-voice\config.json

echo To change backend URL:
echo   1. Edit config.json directly (recommended)
echo   2. Or modify frontend\electron\config-manager.ts and rebuild

echo Debug mode:
echo   cd frontend ^&^& pnpm electron:dev
echo ============================================================
pause
