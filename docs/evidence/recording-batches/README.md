# Recording batch evidence — #33 / #34

No application behavior changes; PRD unchanged. No merge or deployment.

## Verified

- All 83 listed artifacts across five prior real browser batches match their manifest SHA-256 and byte counts.
- A saved pre-run snapshot matches all 17 files, including the manifest, in batch `2026-09-17T09-32-20-152Z_2eaa9657-0d55-49b2-bf61-e4ac1baa24f0` after the next recording failed. This proves preservation across that subsequent run, not two consecutive successful recordings.
- An unreachable loopback URL produced a new failed batch and exit code 1; target version remains unverified. Exact results: [verification.json](verification.json).
- Two independently successful real recordings have attached manifests. [Representative successful recording](representative-success.webm) is from the second passed batch. Its original automated assertions passed. The complete WebM decoded without errors using `ffmpeg -v error -i representative-success.webm -f null -`; interactive playback inspection was not performed and is covered by the case-specific acceptance decision below.
- User supplied a 96.9-second, 778-frame GIF (853×880), and explicitly confirmed the expected startle response occurred. The GIF decodes successfully; [sampled frames](manual-contact-sheet.jpg) were inspected. SHA-256: `1166b45b4064a1ae7cd4f6cf58b297bf73f7a126d55a06d49007542465536081`. Original GIF remains local and is not included in this PR. This is user-confirmed manual evidence, not a new automated pass.

## 本次结果验收（用户确认，2026-09-18）

用户在多次自动录制失败后提供手工 GIF，并确认预期惊吓状态触发；明确本次不再以连续两次完整自动录制成功和交互式播放检查为硬性门槛。此替代只适用于本次试点，不取消后续任务的适用验证。

- 批次保护：9 项专项测试、5 批共 83 个素材校验，以及一个成功批次全部 17 个文件的运行前后哈希一致。
- 状态可信：失败地址退出码 1 且状态 failed；中断与写入失败由专项测试覆盖；历史失败记录不变。
- 内容有效：两份独立成功录制、WebM 全量解码、手工 GIF 关键帧与用户对惊吓效果的确认。
- 限制保留：连续两次完整自动成功未证明，交互式 WebM 播放未执行；快扫自动化仍不稳定，未降低断言或修改应用来规避问题。人工验收不冒充自动化通过。

本次结果验收完成。规格同步到 `openspec/specs/recording-batches/spec.md`，变更归档到 `openspec/changes/archive/2026-09-18-preserve-recording-batches/`。归档不代表已合并或发布。

Full original batches remain in ignored `outputs/lighting-recordings/`; manual source and review are in local `outputs/manual-review/`. Existing evidence was neither moved nor overwritten. #31 can reuse manifests; when merging #23 retain this PR's exclusive batch lifecycle and provenance, rather than restoring fixed output paths.

## Closeout checks

On 2026-09-17: 33/33 tests, strict OpenSpec validation, typecheck, lint and build passed locally. The inherited unused `branchByName` declaration in `scripts/project-pulse.mjs` was removed to unblock lint; the project-pulse workflow fix was taken from main. Latest remote CI is reported in the PR checks, not inferred from these local results.
