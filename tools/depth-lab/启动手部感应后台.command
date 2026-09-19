#!/bin/zsh
cd "${0:A:h}"
echo '先关闭旧的相机采集窗口，避免同时占用 Gemini 335。'
echo '本次启用彩色和深度；密码只在本机输入，窗口请保持打开。'
if /usr/sbin/lsof -tiTCP:8769 -sTCP:LISTEN >/dev/null; then
  echo '8769 已被占用。请先在旧相机终端按 Ctrl+C，再运行本脚本。'
  read '?按回车关闭。'
  exit 1
fi
"$PWD/.venv/bin/python" "$PWD/setup_hand_assets.py" || exit 1
sudo -v || exit 1
open 'http://127.0.0.1:8769/hands'
sudo -- "$PWD/.venv/bin/python" "$PWD/camera_capture.py" --color | "$PWD/.venv/bin/python" "$PWD/server.py" --capture-stdin --port 8769
read '?服务已停止，按回车关闭。'
