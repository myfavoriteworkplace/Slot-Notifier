# R2 File Storage: A Plain-Language Guide

This document explains how uploaded files are stored in the application, why the
folders are organized this way, and how patient medical documents are protected.
It is written for non-technical readers as well as future developers.

## 1. What is R2?

R2 is the application's cloud file storage service. It stores files such as:

- Clinic logos
- Doctor profile photos
- Public case-study photos
- Clinic registration documents
- Patient X-rays
- Patient clinical photographs
- Patient reports and PDFs

The application database stores information *about* a file, such as its name,
category, patient, visit, and upload date. The actual file is stored in R2.

Think of it like this:

```text
Database = the index card describing a file
R2       = the locked filing cabinet containing the actual file
```

The database and R2 must stay connected. A database record without a real file
is a broken reference, and a real file without a database record is an orphan.

## 2. One storage bucket, organized safely

The application uses one R2 bucket. A bucket is like one large storage room.
Folders inside the bucket are called prefixes. They help organize the room, but
they are not security locks by themselves.

The planned structure is:

```text
public/
  clinics/{clinicId}/branding/
  doctors/{doctorId}/profile/
  doctors/{doctorId}/case-media/
  smile-deals/

private/
  clinics/{clinicId}/
    administrative/
      registration/
      licenses/
      certificates/

    patients/{patientId}/
      medical-history/
      visits/{bookingId}/
        documents/
        imaging/
        clinical-photos/
        reports/
        consent/
```

### Public files

Public files are intentionally used on pages that anyone may view, such as:

- Clinic website branding
- Doctor profile images
- Public case studies
- Marketing images

These can use permanent public URLs when appropriate.

### Private files

Private files include:

- Patient X-rays
- Patient photographs
- Patient reports
- Medical clearances
- Clinic registration paperwork

These must not be treated as public website images. Access should be checked
through the application before a user previews or downloads them.

## 3. Where new patient documents are stored

New documents uploaded from a patient appointment are stored using a path like:

```text
private/clinics/12/patients/45/visits/78/documents/unique-file-id.png
```

The numbers mean:

```text
12 = clinic ID
45 = patient ID
78 = booking/visit ID
```

The final file name is a random unique ID, not the patient's original file name.
The original name is saved in the database for display.

This is intentional:

- Two patients may upload files with the same name.
- Original names may contain spaces or unsafe characters.
- A random name makes guessing file locations harder.
- The database remains the place where the human-readable file name is kept.

## 4. Why the browser cannot choose the clinic folder

The browser sends the booking ID when asking to upload a patient document.
The server then looks up:

1. The booking
2. The patient connected to the booking
3. The clinic connected to the appointment slot

The server creates the storage path itself.

This is safer than allowing the browser to send:

```json
{
  "clinicId": 99,
  "patientId": 200,
  "folder": "some-folder"
}
```

If the browser were trusted to choose these values, a malicious or modified
request could try to place one clinic's document inside another clinic's area.

The safe flow is:

```text
User opens patient card
        ↓
Browser sends booking ID
        ↓
Server resolves clinic and patient
        ↓
Server creates the private storage path
        ↓
Server returns a short-lived upload URL
        ↓
Browser uploads directly to R2
        ↓
Application saves document metadata
```

## 5. Upload security

The upload process uses a short-lived signed URL. This is like receiving a
temporary permission slip for one file upload.

The signed URL:

- Expires quickly
- Is tied to a specific object key
- Is tied to a file type and size
- Does not give permanent bucket access
- Does not give the browser general permission to browse storage

The server validates:

- The user is logged in
- The booking exists
- The booking has a patient
- The booking belongs to a clinic
- The file type is allowed
- The file size is within the limit

Current patient-document formats are:

- JPG/JPEG
- PNG
- WebP
- PDF

The current patient-document size limit is 10 MB.

DICOM files are not currently enabled. The interface must not promise DICOM
support until the upload validator, size limit, and preview approach support it.

## 6. Patient document metadata

The application stores metadata alongside each patient document, including:

- Original file name
- File URL/key
- MIME type
- File size
- Category
- Description
- Upload date
- Uploader
- Uploader role
- Clinic
- Patient
- Booking/visit
- Doctor
- Optional clinical record link
- Optional diagnosis snapshot
- Optional affected-tooth snapshot

The document may be:

```text
Patient-level:
  Not linked to a specific visit

Visit-level:
  Linked to a booking/appointment

Diagnosis-linked:
  Linked to a clinical record and diagnosis
```

These relationships should be stored in the database. The folder path is only
an organizational aid and should not be used as the application's only source
of truth.

## 7. Preview and download security

Folders are not security boundaries. A URL beginning with a private-looking
folder name is not automatically secure.

For sensitive patient documents, the preferred production approach is:

```text
User requests preview
        ↓
Server checks login and clinic/patient access
        ↓
Server creates a short-lived signed download URL
        ↓
Browser previews or downloads the file
```

The server should verify:

- The user is authenticated
- The user belongs to the clinic
- The document belongs to that clinic
- The document belongs to the patient/booking being viewed
- The user's role allows the requested action

Permanent public URLs are acceptable for deliberately public assets, but they
are not the preferred final model for medical records.

## 8. Clinic and doctor access

A doctor should not gain access to every file just because they know a patient
ID. Access should be based on the doctor's relationship with the clinic and
the relevant patient/appointment.

A clinic administrator can generally access documents for patients belonging
to that clinic.

A doctor can generally access documents for appointments and patients that
belong to the clinic where the doctor is authorized to work.

The server—not only the user interface—must enforce this. Hiding a button in
the browser is not a security control.

## 9. Deleting documents

The current delete flow removes the document metadata from the patient's
attachment list after verifying the booking, clinic, patient, and document
URL.

The stored R2 object may remain until a storage-cleanup process removes it.
This is safer than immediately destroying the object because it allows:

- Investigation
- Recovery
- Audit review
- Cleanup retries

A more mature production model should add:

- A stable document ID
- `deletedAt`
- `deletedBy`
- Delete audit event
- Delayed physical object deletion
- Restore support where appropriate

## 10. Why a dedicated document table is the long-term goal

The current patient-history attachment list is a practical starting point.
However, a dedicated `patient_documents` table is better when the application
needs a larger document library.

A normalized document record would contain:

```text
document ID
clinic ID
patient ID
booking ID, optional
clinical record ID, optional
storage key
original name
MIME type
file size
category
description
uploader
created date
deleted date, optional
```

Advantages:

- Easier searching
- Safer deletion of one document
- Better audit history
- Better filtering by visit or diagnosis
- Better concurrency behavior
- Easier migration and cleanup
- Less risk of rewriting a large JSON attachment list

Existing attachments should be migrated gradually, not deleted suddenly.

## 11. Migration plan for older files

The application already has older folders and URLs. They should not be renamed
by changing only the database text, because that would leave the actual file
in the old location.

A safe migration is:

1. List existing database references.
2. Resolve each file's clinic, patient, booking, and category.
3. Copy the object to the new private clinic-rooted path.
4. Verify the new object exists and has the expected size/type.
5. Update the database with the new key.
6. Keep the old key temporarily for rollback.
7. Test preview/download from the new location.
8. Delete old objects only after a retention period.

If ownership cannot be resolved confidently, do not move the file
automatically. Mark it for manual review.

## 12. Orphaned files

An orphaned file is a file in R2 with no matching database record. Orphans can
appear when:

- Upload succeeds but metadata saving fails
- A user closes the browser during upload
- A database update fails
- A document is deleted from the database but not R2

A future cleanup job should compare:

```text
R2 object keys
against
database document keys
```

It should report unknown objects first. Automatic deletion should happen only
after a safe waiting period and with logs.

## 13. What is currently implemented

The current application now:

- Uses a dedicated patient-document upload endpoint.
- Derives clinic and patient ownership from the booking on the server.
- Creates new patient upload keys under a clinic/patient/visit path.
- Keeps UUID-based file names.
- Keeps public asset upload folders separate.
- Validates file type and size.
- Stores visit and diagnosis metadata with the document.

The existing general signed-upload endpoint remains for older public and
administrative upload flows. Those flows should be migrated one at a time,
because they have different visibility and ownership requirements.

## 14. Plain-language summary

The safest way to think about the storage design is:

```text
One storage room
  ├── public files for the website
  └── private files for clinics and patients
```

Inside private storage:

```text
Clinic
  └── Patient
      └── Visit
          └── Documents
```

The folder helps keep files organized. The application database and server
permissions decide who is actually allowed to see them.

That separation is important. A well-named folder is useful, but it is not a
substitute for authentication, authorization, signed URLs, auditing, and
careful database relationships.

## 15. Clinic Admin Settings: storage overview

The Clinic Admin now has a **Settings** section focused initially on storage
visibility and upload information. It is read-only and does not delete files,
change upload rules, or change R2 permissions.

It shows two different measurements:

### Tracked storage estimate

This is calculated from file metadata saved in the database, currently
including patient medical-history attachments that record a file size.

It shows:

- Total tracked bytes
- Number of saved file records

This number is useful and fast, but it is an estimate. Older metadata may not
contain a size, and an R2 object can exist without a database record.

### Exact R2 bucket scan

When R2 credentials are configured, the Settings page can scan the bucket
using the R2-compatible object listing API. It follows pagination and sums the
actual object sizes.

The scan reports:

- Total R2 object count
- Total R2 bytes
- Scan timestamp
- Top-level namespace breakdown, for example `public`, `private`, or a legacy
  folder such as `patient-docs`

The scan is triggered by the Settings page's Refresh button. It is not run on
every application request. The result is cached in the browser for five
minutes during the current session.

If R2 credentials are missing, the page clearly reports that the exact scan is
unavailable instead of presenting the estimate as exact.

### Current read-only upload information

The Settings page currently displays the server-enforced limits:

- Patient documents: 10 MB
- Clinic documents: 5 MB
- Case media: 3 MB
- Patient documents support JPG, JPEG, PNG, WebP, and PDF

These values are informational at this stage. They are not editable from the
clinic interface.

## 16. Clinic storage quotas

Each clinic has an effective storage allowance resolved in this order:

1. An application-admin clinic-specific override, when configured.
2. The allowance associated with the clinic's payment plan.
3. The default allowance of **100 MB**.

The default plan allowances are Starter 100 MB, Growth 500 MB, and Pro 2047 MB
(the current database column supports a maximum of 2047 MB).
Application admins can set or clear an override from the Edit Clinic dialog.
This does not change subscription or billing state.

Clinic Settings shows tracked usage, maximum storage, remaining capacity,
percentage used, and whether the allowance comes from a plan or clinic
override. Patient-document uploads are checked against remaining capacity
before a signed upload URL is issued; the existing 10 MB per-file limit still
applies.

Quota usage is based on sizes recorded in clinic-owned patient medical-history
attachments. Legacy records without a size contribute zero. The exact R2
bucket scan is not used for clinic quotas because a shared bucket may contain
other clinics and public assets.

## 17. Settings security boundary

The storage report endpoint is clinic-admin-only. The server obtains the
clinic ID from the authenticated session rather than from a browser-supplied
clinic ID.

The tracked report is limited to records belonging to that clinic. The exact
R2 scan currently reports the configured bucket's object inventory, so it
should be treated as a bucket-level operational report when a bucket is shared
by multiple clinics. A future multi-tenant inventory layer must filter or
partition exact results by clinic before showing them as clinic-specific.

The Settings page has no destructive storage action. In particular, it does
not expose:

- Delete-object controls
- Orphan cleanup
- Retention changes
- Quota changes
- Upload-policy changes

## 18. Future Settings roadmap

The implementation is intentionally staged:

### Phase 1 — Implemented

- Clinic Admin Settings navigation item
- Tracked database-metadata estimate
- Exact R2 object scan when credentials are configured
- Object count and byte totals
- Scan timestamp
- Read-only upload limits
- Authenticated clinic-scoped report endpoint
- No destructive controls

### Phase 2 — Recommended next

- Persist scan results server-side with a timestamp
- Add a background/manual scan history
- Show public/private and clinic namespace breakdowns
- Add explicit orphan candidates by comparing R2 keys with database keys
- Add missing-file and missing-size warnings
- Make exact reports clinic-safe when a bucket is shared

### Phase 3 — Safe management

- Dedicated normalized patient-document records
- Stable document IDs and storage keys
- Deletion audit events
- Delayed physical deletion
- Retention-period review queue
- Restore or recovery workflow

### Phase 4 — Configurable policies

- Clinic storage quotas, if product plans define them
- Server-enforced per-clinic upload limits
- Category and MIME-type policies
- Doctor upload permissions
- Retention configuration

Quota or policy controls must be enforced on the server before a signed upload
URL is issued. A browser-only setting would not provide protection.
