# Recording batch evidence — #33 / #34

No application behavior changes; PRD unchanged. No merge or deployment.

## Verified

- All 83 listed artifacts across five prior real browser batches match their manifest SHA-256 and byte counts.
- A saved pre-run snapshot matches all 17 files, including the manifest, in batch `2026-09-17T09-32-20-152Z_2eaa9657-0d55-49b2-bf61-e4ac1baa24f0` after the next recording failed. This proves preservation across that subsequent run, not two consecutive successful recordings.
- An unreachable loopback URL produced a new failed batch and exit code 1; target version remains unverified. Exact results: [verification.json](verification.json).
- Two independently successful real recordings have attached manifests. [Representative successful recording](representative-success.webm) is from the second passed batch. Its original automated assertions passed. The complete WebM decoded without errors using `ffmpeg -v error -i representative-success.webm -f null -`; interactive playback inspection is still pending.
- User supplied a 96.9-second, 778-frame GIF (853×880), and explicitly confirmed the expected startle response occurred. The GIF decodes successfully; [sampled frames](manual-contact-sheet.jpg) were inspected. SHA-256: `1166b45b4064a1ae7cd4f6cf58b297bf73f7a126d55a06d49007542465536081`. Original GIF remains local and is not included in this PR. This is user-confirmed manual evidence, not a new automated pass.

## Remaining original acceptance items

- Two consecutive fully passing automated recordings remain unproven: fast-swipe automation is intermittent. Existing failed batches remain failed. No assertions were removed or weakened during this closeout.
- Successful WebM playback inspection remains pending.
- OpenSpec change remains active until outstanding acceptance is resolved; this evidence does not claim full completion.

Full original batches remain in ignored `outputs/lighting-recordings/`; manual source and review are in local `outputs/manual-review/`. Existing evidence was neither moved nor overwritten. #31 can reuse manifests; when merging #23 retain this PR's exclusive batch lifecycle and provenance, rather than restoring fixed output paths.

## Closeout checks

On 2026-09-17: 33/33 tests, strict OpenSpec validation, typecheck, lint and build passed locally. The inherited unused `branchByName` declaration in `scripts/project-pulse.mjs` was removed to unblock lint; the project-pulse workflow fix was taken from main. Latest remote CI is reported in the PR checks, not inferred from these local results.
