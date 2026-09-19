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
