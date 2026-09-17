# 灯光录制批次：OpenSpec 试点

关联 #33，属于 #31 的开发验证工具。只录制应用 Canvas，不启用摄像头，不改动灯光、行为或成长规则。自动化通过不代表视觉评审或真实墙面验收通过。

## 安装与运行

Node.js >=22.13，依赖版本由 package-lock.json 固定：

```powershell
npm ci
npx --no-install playwright install chromium
npm run setup:assets
npm run qa:lighting
```

默认命令启动当前工作区的本地开发服务，选择可用回环端口，使用全新浏览器上下文，完成呼吸、横向/纵向/弧线慢抚、停手、快扫及恢复录制。浏览器和服务在完成或异常后关闭。一次完整录制约需几分钟；首次编译更慢。

慢抚每种方向最多等待 90 秒，以同一时刻读取的真实扰动和伸展状态决定截图时机；停手和受惊恢复也有超时限制。等待更久不会降低原有行为断言阈值，超时仍然失败。

快扫使用连续排队的真实浏览器鼠标事件，避免主机往返延迟把快扫变成间隔过长的两次采样；最多尝试三次，实际次数记入结果。没有直接修改或注入行为状态。

输出：`outputs/lighting-recordings/<UTC时间_UUID>/`。每次执行新建目录并打印绝对位置。相同场景文件名只在各自批次内使用；不存在覆盖或续跑选项。生成批次被 Git 忽略。

可选环境变量（PowerShell）：

```powershell
$env:QA_OUTPUT_DIR = 'outputs/my-lighting-recordings' # 批次根目录，不是复用目录
$env:QA_URL = 'http://localhost:3017/'                # 使用已有服务，不再自行启动
npm run qa:lighting
Remove-Item Env:QA_URL
Remove-Item Env:QA_OUTPUT_DIR
```

`QA_URL` 服务一律标记“被测版本未核实”，即使是 localhost，也不能用工具提交号证明服务版本。不要在 URL 中嵌入凭据。默认自启服务记录工作区提交、dirty 状态和源文件摘要；录制期间改动源码会导致失败。为取得清晰证据，请先提交代码再录制。

自定义输出根目录不能是项目根目录；生成的输出目录不参与源码摘要，避免新素材被误判为源码修改。建议仍放在已忽略的 `outputs/` 下。

保留 `PLAYWRIGHT_MODULE`，可指向兼容 Playwright 模块。已有 Chrome 可设置 `QA_BROWSER_CHANNEL=chrome`；默认使用上述安装的 Chromium，manifest 记录实际版本。

## 查看结果

`manifest.json` 包含批次 ID、起止时间、自动化状态、浏览器版本、1280×720 视口/DPR 1、工具与被测来源，以及文件大小和 SHA-256。它自身不加入哈希清单。

- `passed`：行为断言、所需素材写入、资源清理均完成；`visualReview` 仍为 `pending`。
- `failed`：返回非零退出码；尽量保留失败原因、状态和已完成素材。
- `running`：录制中，或强制结束后留下的未完成批次；不能当作通过。磁盘故障也可能阻止最终状态写入。

`final-breath-strokes-recovery.webm` 包含连续呼吸、三种慢抚、停手和惊扰恢复。`*-detail.png` 是画布局部放大截图，不能冒充原生高分辨率画面。`browser-results.json` 保存实际状态和性能采样；性能只代表当次机器。

素材采用独占写入，同名文件导致失败；工具不能修改已完成批次。失败诊断保留本地，不作为成功演示上传。PR 提供选定 manifest、哈希比较及代表性成功录像，不提交全部生成素材。

## 验证与接续

```powershell
npm test
npm run spec:validate
npm run typecheck
npm run lint
npm run build
```

CI 运行文件测试和 OpenSpec 校验；浏览器录制是本地验收。不可达 `QA_URL` 应生成失败批次并返回非零。连续录制两次，比较第一批全部文件（含 manifest）哈希，确认不变。不得通过删掉慢抚/惊扰断言来“修复”失败。

OpenSpec 固定为开发依赖，Codex 技能在 `.agents/skills`。新任务先关联 Issue，再在对话中用 `$openspec-propose`；实施用 `$openspec-apply-change <变更名>`，完成后 `$openspec-archive-change <变更名>`。CLI 使用 `npx --no-install openspec …`，可设置 `OPENSPEC_TELEMETRY=0` 关闭工具遥测。归档不代表 PR 已合并或产品已发布。

录制脚本来自 #23 固定提交 `8c5aa7459d14cf80a5984196cb8abe192976696d`，没有带入渲染代码。未来合并 #23 时保留批次入口、来源判断和失败处理；新素材统一通过批次 `write`，不得恢复固定目录写入。#31 可读取 manifest 建立档案/飞书索引，视觉评审与发布记录独立维护。历史证据不迁移、不覆盖。
