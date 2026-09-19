#!/bin/zsh
cd "${0:A:h}"
if ! /usr/bin/curl -fs --max-time 2 http://127.0.0.1:8769/api/state >/dev/null; then
  echo '请先运行「启动手部感应后台.command」，保持相机窗口打开，再运行本脚本。'
  read '?按回车关闭。'
  exit 1
fi
if /usr/bin/curl -fs --max-time 2 http://127.0.0.1:8773/api/interaction >/dev/null; then
  bridge_running=1
fi
if ! /usr/bin/curl -fs --max-time 2 http://127.0.0.1:3018/ >/dev/null; then
  if ! command -v npm >/dev/null; then
    export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
  fi
  if ! command -v npm >/dev/null || [[ ! -d ../../node_modules ]]; then
    echo '网站依赖未安装：请在项目根目录安装 Node.js 后执行 npm ci。'
    read '?按回车关闭。'
    exit 1
  fi
  (cd ../..; npm run dev -- --port 3018) &
  life_pid=$!
  trap 'kill $life_pid 2>/dev/null' EXIT
fi
if [[ "$bridge_running" == 1 ]]; then
  open 'http://127.0.0.1:8773/hands'
  if [[ -n "$life_pid" ]]; then wait "$life_pid"; fi
  exit 0
fi
echo '墙面互动后台 http://127.0.0.1:8773/hands ，本窗口请保持打开。'
(sleep 2; open 'http://127.0.0.1:8773/hands') &
"$PWD/.venv/bin/python" "$PWD/recording_server.py"
read '?服务已停止，按回车关闭。'
