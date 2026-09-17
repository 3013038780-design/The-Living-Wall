## Why

Issue #33 is an independent OpenSpec pilot under #31. The recorder on PR #23 reuses fixed filenames, allowing a later run to erase earlier evidence. Failures and interrupted runs also need explicit identities.

## What Changes

- Import only the recorder from 8c5aa7459d14cf80a5984196cb8abe192976696d, preserving pointer interactions and assertions.
- Create exclusive batches, lifecycle manifests, source provenance and artifact hashes.
- Add tests, repeat-run evidence and contributor instructions; pin OpenSpec and Playwright.

## Capabilities

### New Capabilities
- `recording-batches`: isolated, traceable lighting evidence with honest completion status.

### Modified Capabilities
None.

## Impact

Development tools and CI tests only. No app behavior change; PRD unchanged. No renderer changes, growth migration, deployment, Feishu or Superpowers. Coordinate the shared script with #22 / PR #23; target main independently.
