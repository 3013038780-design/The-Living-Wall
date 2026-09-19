## ADDED Requirements

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
