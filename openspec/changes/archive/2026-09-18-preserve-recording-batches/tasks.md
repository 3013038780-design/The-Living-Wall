## 1. Setup and specification
- [x] 1.1 Create #33, coordinate #31/#22, isolate worktree from main.
- [x] 1.2 Pin dependencies, initialize Codex integration and validate specification.

## 2. Implementation
- [x] 2.1 Implement exclusive batches, provenance and hashed manifests.
- [x] 2.2 Import recorder, retain behavior checks and add owned server/failure cleanup.
- [x] 2.3 Add npm commands, CI-covered tests and documentation.

## 3. Verification and delivery
- [x] 3.1 Run tests and OpenSpec strict validation.
- [x] 3.2 按本次确认的替代验收完成：批次测试、运行前后哈希、既有成功录制及用户手工 GIF 确认；具体限制见验收记录。
- [x] 3.3 Verify unreachable URL fails with nonzero exit and failed batch.
- [x] 3.4 Run test/typecheck/lint/build and record results.
- [x] 3.5 同步并归档规格，附证据到打向 main 的 PR。本次不合并、不发布；最新提交 CI 与转为可评审状态在 PR 上核实，不以归档代替。

## 本次验收调整（2026-09-18）

用户明确：多次自动录制失败后，已手工录制并确认惊吓触发，本次不再把连续两次完整自动成功及交互式播放检查作为硬门槛。此调整仅适用于本次试点，不是以后任务的通用豁免。

证据见 `docs/evidence/recording-batches/README.md`。两次连续自动成功仍未证明；交互式 WebM 播放未执行，但完整解码通过。现有失败状态、真实输入及行为断言不变；人工确认不冒充自动通过。批次保护由 9 项专项测试、83 个素材校验及 17 个文件的运行前后快照比较支持。

原 3.2 的执行方式由上述结果验收替代；原 3.5 的最新 CI 门禁保留在 PR，须在最终提交后确认。
