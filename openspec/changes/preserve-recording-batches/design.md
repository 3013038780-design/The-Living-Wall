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
- Pure Node tests run in CI; actual browser acceptance runs locally. Generated batches ignored; attach two manifests, hash comparison and one representative video to PR.

## Risks / Trade-offs

Hard termination or disk exhaustion can prevent failure metadata, so running never proves success. Keep batch protection when reconciling the future #23 script merge. Diagnose timing failures without weakening assertions.

## Rollout

One child Issue/worktree/PR. Specs precede code; validate strictly, test, record twice plus failed URL, archive specs. No merge or deployment.
