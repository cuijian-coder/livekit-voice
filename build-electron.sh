#!/usr/bin/env bash
set -e
# ============================================================
# Electron 打包脚本 (Linux/macOS/WSL)
#
# 功能：一键构建并打包 Electron 桌面应用
# 支持：Linux (AppImage), macOS (dmg), Windows (exe 需交叉编译)
#
# 前置条件：
#   1. 已安装 Node.js (>= 18)
#   2. 已安装 pnpm (npm install -g pnpm)
#   3. 后端服务已就绪（本地或远程）
#
# 使用方式：
#   chmod +x build-electron.sh
#   ./build-electron.sh
#
# 后端地址配置（打包前修改）：
#   - 本地开发: 无需修改，默认连 localhost:3000
#   - 公网部署: 修改 frontend/electron/config-manager.ts 中的 defaultConfig
#     或打包后修改 ~/.config/livekit-voice/config.json (Linux)
#               ~/Library/Application Support/livekit-voice/config.json (macOS)
#
# 输出位置：
#   - Linux:   frontend/release/LiveKit Voice Chat.AppImage
#   - macOS:   frontend/release/LiveKit Voice Chat.dmg
#   - Windows: frontend/release/LiveKit Voice Chat Setup.exe
# ============================================================

echo "[1/5] 检查前置环境..."
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js，请先安装 https://nodejs.org"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "[错误] 未检测到 pnpm，请先执行: npm install -g pnpm"
    exit 1
fi

echo "[2/5] 安装 Electron 依赖..."
cd frontend
pnpm install

echo "[3/5] 构建前端渲染进程..."
pnpm build

echo "[4/5] 构建 Electron 主进程..."
pnpm vite build --config vite.electron.config.ts

echo "[5/5] 打包 Electron 应用..."
pnpm electron-builder --config electron-builder.json

echo ""
echo "============================================================"
echo "[成功] 打包完成！"
echo ""
echo "输出文件位置:"
echo "  frontend/release/"
echo ""
echo "安装包示例:"
echo "  - Linux:   LiveKit Voice Chat.AppImage"
echo "  - macOS:   LiveKit Voice Chat.dmg"
echo "  - Windows: LiveKit Voice Chat Setup.exe (需 Wine 或交叉编译)"
echo ""
echo "首次运行时自动创建:"
echo "  Linux: ~/.config/livekit-voice/config.json"
echo "  macOS: ~/Library/Application Support/livekit-voice/config.json"
echo ""
echo "修改后端地址:"
echo "  1. 直接编辑 config.json (推荐)"
echo "  2. 或修改 frontend/electron/config-manager.ts 后重新打包"
echo ""
echo "调试模式:"
echo "  cd frontend && pnpm electron:dev  (开发模式，带 DevTools)"
echo "============================================================"
