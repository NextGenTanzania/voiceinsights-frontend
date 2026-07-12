# UI Functional Closure Release

This release consolidates duplicate dashboards and connects the remaining visible actions to backend workflows.

## Changes
- Legacy Founder dashboard redirects to the single production Founder Executive Dashboard.
- Legacy Operations Manager dashboard redirects to the single production Operations Dashboard.
- Founder approval list, request detail, approve, reject and request-changes actions use live protected APIs.
- Founder Operations Manager invite, replace and suspend actions create auditable records.
- Operations Manager can create a client workflow, upload proposal/contract/invoice files to R2, and submit a completed request to Founder.
- Enumerator workspace directly binds Start, Resume, Sync, Download Assignment and Report Issue actions.
- Offline Sync sends locally queued interviews through the collection operations endpoint and preserves conflicts for review.
- Generate Invoice and Generate Proposal no longer default to bare `#` links.
- Demo credentials toggle is a real button rather than an empty anchor.
- Report Library `publicationScoreText` recovery remains included.

## Database migration
Apply:

`backend/migrations/026_ui_functional_closure.sql`

## Verification
- 397/397 tests passing
- Worker import OK
- No alert placeholders in Founder/Operations dashboards
- Required Enumerator handlers present
- Business links no longer use bare hash defaults
