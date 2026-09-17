## 1. Setup and specification
- [x] 1.1 Create #33, coordinate #31/#22, isolate worktree from main.
- [x] 1.2 Pin dependencies, initialize Codex integration and validate specification.

## 2. Implementation
- [x] 2.1 Implement exclusive batches, provenance and hashed manifests.
- [x] 2.2 Import recorder, retain behavior checks and add owned server/failure cleanup.
- [x] 2.3 Add npm commands, CI-covered tests and documentation.

## 3. Verification and delivery
- [x] 3.1 Run tests and OpenSpec strict validation.
- [ ] 3.2 Record twice, verify first batch unchanged and inspect actual media.
- [x] 3.3 Verify unreachable URL fails with nonzero exit and failed batch.
- [x] 3.4 Run test/typecheck/lint/build and record results.
- [ ] 3.5 Archive spec, attach evidence to PR targeting main, verify latest CI. Do not merge or deploy.

## Closeout evidence
See `docs/evidence/recording-batches/README.md`. User-confirmed manual startle evidence is recorded separately. Task 3.2 remains incomplete: two consecutive passed recordings and WebM playback inspection are not proven. Do not interpret preserved hashes after a failed run as two passed runs.
