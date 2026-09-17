#!/bin/zsh
cd "${0:A:h}"
if [[ ! -x .venv/bin/python ]]; then
  echo '请先按 README 完成 Python 3.12 虚拟环境安装。'
  read '?按回车关闭'
  exit 1
fi
open http://127.0.0.1:8765
exec .venv/bin/python server.py
