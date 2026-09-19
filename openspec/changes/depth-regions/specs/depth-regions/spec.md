## ADDED Requirements

### Requirement: Hand center and wall distance share one capture
The hand viewer SHALL use SDK depth-to-color alignment and the same frameset for color landmarks and wall displacement. The existing depth diagnostics and hand viewer SHALL share ROI and wall calibration. No alignment, calibration, valid local depth, or fresh input means no proximity activation. This is visible-surface displacement, not physical touch.

#### Scenario: Single hand near the wall
- WHEN the mean position of wrist and four finger bases has reliable local depth within 200mm for 150ms
- THEN activate the local hand status, retain until distance exceeds 230mm, and clear on invalid/lost input
- AND do not claim hand-facing classification or projection alignment

### Requirement: Region diagnostics
The local lab SHALL show multiple geometric foreground contours and a separate near-wall band, without labelling them as recognized people.

#### Scenario: Arm connected to torso
- **WHEN** a near-wall patch is attached to a farther foreground region
- **THEN** the near-wall patch is extracted independently and is not replaced by the whole region centroid

### Requirement: Invalid evidence
The lab SHALL clear region overlays after missing or stale frames and label excessive wall occlusion as uncertain.

#### Scenario: Lost depth
- **WHEN** valid depth disappears
- **THEN** no prior region remains as a current interaction target

### Requirement: Guided numeric recording
The lab SHALL prompt one action at a time and export only allowlisted numeric diagnostics plus user-reported completion, labelled simulation or camera.

#### Scenario: Disconnection
- **WHEN** data stops or capture mode changes
- **THEN** the current action is interrupted and no stale frame is recorded as a valid sample

#### Scenario: Completed sequence
- **WHEN** all actions receive user confirmation
- **THEN** the report marks the sequence completed without claiming physical touch acceptance

### Requirement: Frozen local wall background
The detector SHALL learn a per-pixel median and temporal noise from empty-wall calibration, ignore unreliable reference pixels, and compare new foreground against that frozen reference along the fitted normal.

#### Scenario: Fixed wall relief
- **WHEN** fixed shallow wall relief is present during calibration and observation
- **THEN** it is not reported as foreground, while a new object above it remains detectable

#### Scenario: Stationary hand
- **WHEN** a hand remains stationary after calibration
- **THEN** it is not absorbed into the background

#### Scenario: Unknown reference
- **WHEN** calibration contains missing depth at a pixel
- **THEN** later depth at that pixel cannot alone generate foreground

### Requirement: 本地自动短测和近墙点跟踪
系统 SHALL 在不重启相机采集的情况下提供本地辅助页面，只使用近墙区域生成短时跟踪点，禁止用远离墙面的身体整体中心驱动交互。持续150ms确认，最近邻匹配与平滑；区域丢失和无效/过期数据清除跟踪点。此功能不声称语义手部识别或真实接触。

#### Scenario: 一次点击完成动作引导
- WHEN 已校准真实数据有效，操作者开始短测
- THEN 自动依次提示空墙、移动、停留、身体干扰、离开五步，每步先准备5秒
- AND 将每次轮询的数值、提示阶段和质量标记保存到本机报告，不保存图像
- AND 流程结束只报告观察统计，不自动宣称动作完成或物理测试通过

#### Scenario: 无效数据与可见诊断
- WHEN 连续0.8秒无法可靠判断背景或数据失效
- THEN 中止自动短测并保存原因，不标记完成
- AND 操作页始终显示实际错误及新鲜深度预览；预览不写入报告
- AND 提供明确标记的空墙校准操作，测试过程中禁用

### Requirement: 独立距离诊断
系统 SHALL 提供固定小框的可见表面法向位移统计，不使用前景、正距离和近墙门限筛选测量样本。零值和负值保留；有效像素不足返回空值。光轴深度、空间分布、时间波动、物理接触 SHALL 区分标注。

#### Scenario: 固定距离回归
- WHEN 合成表面沿墙面法向偏移0、-8、3、20或100毫米
- THEN 固定框分别输出对应值，不被近墙筛选截断
- AND 倾斜墙面20毫米法向偏移仍输出20毫米
- AND 无深度时不输出虚假的零毫米
# 半米内手部互动补充（Issue #25）

本节取代此前20/23cm范围。可靠单手中心与有效对齐深度同时存在时，距墙不超过500mm持续150ms激活，超过530mm退出。无效输入不能被当作近墙。桥接超过500ms无更新失效，投影渐隐待机。后台保留在电脑端，独立投影页面提供四点映射和纯画面；相机或投影移动、画布尺寸改变后重新映射，四点映射不构成三维精度认证。仅本地实验，不改生产网站。

记录为可选辅助：五步逐次确认开始，每步8秒；数值逐条保存本机，记录关节、中心、距离与异常，无彩色视频。关闭页面或进程后已写记录可读取为未完成，报告完成不自动代表硬件验收通过。
