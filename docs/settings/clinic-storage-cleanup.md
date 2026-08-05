# Clinic Settings: Untracked File Review

## Purpose

Clinic Admin Settings provides a review-first workflow for files that exist
under the clinic's private R2 namespace but do not have a matching database
document reference.

This is intentionally a clinic-only feature. It is not a bucket-wide cleanup
tool and it must never expose another clinic's objects.

## Current workflow

1. A clinic administrator opens Settings.
2. The administrator chooses **Scan**.
3. The server lists objects only under:

   ```text
   private/clinics/{current-session-clinic-id}/
   ```

4. The server collects tracked patient-document keys and normalized referenced
   URLs for that clinic.
5. Objects without a matching reference are shown as candidates.
6. The administrator selects individual candidates.
7. The administrator confirms permanent deletion.
8. The server rechecks the current clinic session, namespace, and tracked
   references before deleting each selected object.

Scanning never deletes anything.

## What is considered tracked

New patient documents store a server-generated storage key in their metadata.
For compatibility, the scan also attempts to normalize a referenced URL into
an object key when the URL belongs to the clinic namespace.

The scan does not treat a browser-provided clinic ID as authoritative. The
clinic ID always comes from the authenticated clinic session.

## What is considered a candidate

A candidate is an R2 object that:

- Is under the current clinic's private namespace.
- Is returned by the R2 object listing API.
- Does not match a tracked storage key or safely normalized tracked URL.

Candidates may still be legitimate legacy files. The UI therefore calls them
untracked candidates, not confirmed garbage.

## Permanent deletion safety

The delete endpoint:

- Requires a clinic administrator session.
- Requires R2 configuration.
- Accepts only selected keys.
- Limits one request to 100 keys.
- Requires every key to start with the current clinic prefix.
- Rejects path traversal segments.
- Reloads tracked metadata immediately before deletion.
- Skips keys that became tracked after the scan.
- Deletes only the remaining eligible keys.

The client confirmation dialog is only an extra usability guard. The server
checks are the actual security boundary.

## Deliberate limitations

The current workflow does not:

- Scan public or global objects.
- Display other clinics' objects.
- Classify unknown legacy folders.
- Delete database metadata.
- Delete missing database references.
- Provide a bulk “delete all” action.
- Quarantine files.
- Persist scan history.
- Persist review decisions.
- Provide a deletion audit record.

The scan result is not a permanent inventory. A later scan may produce a
different result as uploads and metadata writes complete.

## Upload timing consideration

Patient documents upload directly to R2 before their metadata is saved. If a
browser closes between those operations, the object can temporarily appear
untracked. Do not delete a newly uploaded candidate without reviewing its
timestamp and context.

## Future implementation roadmap

### Phase 2: durable review state

- Store scan records and candidate observations.
- Track first-seen and last-seen timestamps.
- Allow administrators to mark a candidate as reviewed or keep it.
- Require candidates to survive multiple scans before deletion.

### Phase 3: quarantine

- Move eligible candidates to a quarantine namespace rather than deleting
  immediately.
- Keep them for a configurable grace period.
- Support restore before final deletion.

### Phase 4: deletion audit

- Record object key, size, clinic, user, timestamp, reason, and result.
- Keep an immutable deletion history.
- Report failed deletions for retry.

### Phase 5: normalized document inventory

- Move patient documents from JSON attachment lists into a dedicated table.
- Store a stable document ID and canonical storage key.
- Track `deletedAt`, `deletedBy`, and lifecycle state.
- Make comparison and cleanup more reliable under concurrent updates.

### Phase 6: application-admin operations

- Add a separate application-admin inventory for legacy, unknown, public, and
  cross-clinic objects.
- Require stronger review and audit controls.
- Never merge this broader inventory into the clinic-admin view.