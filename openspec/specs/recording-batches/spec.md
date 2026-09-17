# Recording batches

## Purpose

为灯光录制提供独立且可追溯的证据批次，确保重复执行、并发、失败及中断不会覆盖已有素材；记录真实完成状态、被测来源和文件哈希，让团队能依据证据验收和接续工作。

## Requirements

### Requirement: Exclusive batches
The recorder SHALL create a unique UTC timestamp plus UUID batch for every invocation using exclusive directory creation. It SHALL refuse existing directories and artifact files.

#### Scenario: Repeated runs
- **WHEN** two recordings run sequentially
- **THEN** their directories differ and first-run bytes remain unchanged

#### Scenario: Concurrent runs
- **WHEN** recordings start at the same timestamp
- **THEN** each uses an independent directory

#### Scenario: Collision
- **WHEN** a batch directory or artifact exists
- **THEN** creation fails without modifying it

### Requirement: Honest lifecycle
The recorder SHALL start running, finalize passed only after assertions, required writes and cleanup succeed, and exit nonzero on failure. It SHALL never resume incomplete batches. Visual review SHALL remain pending independently.

#### Scenario: Success
- **WHEN** all checks and writes and cleanup succeed
- **THEN** status is passed with files/hashes and visual review pending

#### Scenario: Failure
- **WHEN** navigation, assertions, writes or cleanup fail
- **THEN** exit is nonzero and status is failed with a reason when storage permits

#### Scenario: Interruption
- **WHEN** execution terminates before finalization
- **THEN** running means incomplete and the next invocation creates another batch

### Requirement: Traceable evidence
Each manifest SHALL record identity, times, viewport/DPR, browser version when available, recorder source identity and artifact sizes/SHA-256. Target provenance SHALL be separate from tool provenance.

#### Scenario: Owned server
- **WHEN** the recorder launches its worktree server and source stays unchanged
- **THEN** target provenance identifies that local commit and dirty state

#### Scenario: Custom URL
- **WHEN** QA_URL points to an existing server
- **THEN** target provenance is unverified and never inherits the tool commit as its deployed revision

#### Scenario: Inventory
- **WHEN** a completed batch is inspected
- **THEN** each artifact matches its recorded size and SHA-256

### Requirement: Effective behavior checks
The recorder SHALL retain real pointer input and slow-stroke, release, startle and recovery assertions without modifying app code or claiming visual acceptance.

#### Scenario: Ineffective stroke
- **WHEN** a stroke fails to trigger the expected disturbance and stretch
- **THEN** the batch fails rather than accepting the screenshot alone
