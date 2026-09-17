## Context

main has get_creature_state and the same behavior fields, but not the recorder. Import that script from the fixed #23 revision without renderer changes.

## Goals / Non-Goals

Prevent batch reuse and overwriting. Only completed assertions, writes and cleanup allow passed. Record target provenance separately from tool provenance. Do not equate automated success with visual approval.

## Decisions

- Node filesystem only. Windows-safe UTC timestamp plus UUID; exclusive leaf mkdir and exclusive artifact writes. No overwrite option. QA_OUTPUT_DIR overrides the root, default outputs/lighting-recordings.
- Atomic manifest.json replacement within the new batch. running transitions to passed or failed. A killed process may leave running, treated as incomplete. Never resume a batch.
- Record visualReview=pending, browser version, viewport/DPR, URL, timestamps, files/sizes/SHA-256; hash recorder sources and record Git commit, dirty state and working source digest.
- Default invocation launches this worktree's dev server on a free loopback port with strict binding. Compare source identity before/after; reject changes during recording. QA_URL always means unverified target, including localhost.
- Write shots/state as available. On failure preserve diagnostic evidence, exit nonzero, close browser and owned server. Cleanup failure prevents passed.
- Keep isolated browser context, real slow strokes/release/startle assertions. No camera or user profile.
- Initial real capture exposed slow-host timing: retain thresholds, allow up to 90 seconds per stroke, and check the captured state atomically before writing a success shot. Ask the OS for a free port because Vite treats port 0 as its default; strictPort still rejects races.
- Queue the two fast-swipe browser input events together; allow at most three real attempts and record their count. No state injection. Exclude the configured output root from source identity so a custom non-ignored output directory cannot invalidate its own capture; reject the repository itself as output root.
- Pure Node tests run in CI; actual browser acceptance runs locally. Generated batches ignored; attach two manifests, hash comparison and one representative video to PR.

## Risks / Trade-offs

Hard termination or disk exhaustion can prevent failure metadata, so running never proves success. Keep batch protection when reconciling the future #23 script merge. Diagnose timing failures without weakening assertions.

## Rollout

One child Issue/worktree/PR. Specs precede code; validate strictly, test, record twice plus failed URL, archive specs. No merge or deployment.

## 本次验收决策（2026-09-18）

原定双次完整自动录制及交互式播放检查在本次自动化多次失败后，由用户确认的人工 GIF、已有成功录制、完整解码、批次测试和哈希证据组合替代。只改变本次交付的验收方式，不改变录制器 passed 条件或通用验证规则。详见 tasks.md 和证据说明。
