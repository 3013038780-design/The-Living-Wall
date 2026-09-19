#!/bin/zsh
cd "${0:A:h}"
echo '这次仅用管理员权限读取 Gemini 335 的 USB 深度流。'
echo '测试网页仍以普通用户身份运行，关闭窗口或按 Ctrl+C 即停止。'
echo '如提示 Password，请在此终端输入 Mac 登录密码（输入时不会显示字符）。'
echo '不要把密码发到聊天里。'
sudo -v || exit 1
sudo -- "$PWD/.venv/bin/python" "$PWD/camera_capture.py" | "$PWD/.venv/bin/python" "$PWD/server.py" --capture-stdin --port 8769 --open
read '?测试已结束。按回车关闭。'
