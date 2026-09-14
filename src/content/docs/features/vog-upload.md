---
title: VOG uploads and review
---

Available since Rondo Club 35.60.0. Members submit a VOG at `/profile/vog`;
coordinators review submissions at `/vrijwilligers/vog/beoordelen`.

The file selector uses a visible Dutch button (PDF kiezen / Bestanden kiezen) with an upload icon. File limits appear below it; choosing files does not submit them. The MijnOverheid option accepts exactly one PDF. A single selected file shows its name, preview link and remove action without a count, numbering or reorder controls. Multiple scan photos retain the count, numbering and ordering controls.

## Upload and approval

- Original digital PDF: submit the unchanged bytes to Justid's GAAV endpoint,
  `https://www.validatie.nl/api/valideer/`. Only integer `response_code: 0` confirms
  authenticity. No API key is required by the tested API. HTTP errors, malformed
  responses and technical response codes never approve a document.
- Scan: accept one PDF or up to five ordered JPG/PNG pages, at most 10 MB total.
  Each PDF is limited to five pages and each image to 25 megapixels. To select
  photos, members must first choose the paper/photo/scan option.
- Paper: the coordinator must confirm inspection of the genuine paper original,
  its security features, identity, organization, function and screening profile.
  A printout of a digital VOG is insufficient. Scans themselves never receive a
  GAAV approval.
- Unknown origin or scanned digital VOG: request the original PDF; the member
  replaces the previous submission. Version checks prevent stale approvals.

Automatic rules are empty by default. An administrator enters the full organization
name in VOG settings. New entries use function `Vrijwilliger` and code `84` (care
for minors); these need no repeated coordinator confirmation. Matching ignores
case and repeated whitespace, but does not use fuzzy or substring matching.
Existing configured functions and additional codes are preserved. Code `84` is
always required, including for legacy rules. Only GAAV code 0, complete first-page
extraction, matching identity, an applicable rule, and an issue date within the
club's three-year window allow automatic approval. The reverse-page legend is
never treated as selected codes. Missing codes, an unrecognized document, a wrong
organization or an invalid date cannot be overridden with an identity confirmation.
A future or older registered date cannot replace the existing VOG date.

## Identity differences and inquiries

Since 35.82.0, the review surface compares extracted identity fields with the member
profile and, where available, previously verified legal names. A coordinator must
explicitly confirm a mismatch and record the evidence method: `original_id` (original
identity document seen in person) or `verified_records` (previously verified identity
records consulted). The application does not infer a birth surname from a different
display surname. No ID upload, BSN or ID-document number is collected.

With the separate **remember names** checkbox, approval saves the extracted given
names, infix and birth surname in private workflow meta
`_rondo_vog_verified_identity` on the person, alongside reviewer, method, timestamp,
source submission ID and a hash of the current profile identity. No duplicate birthdate
is stored. This evidence is not part of the general person field API or Sportlink
sync and cannot be written by members. Display names stay unchanged. A future VOG
uses these names only if the profile identity hash still matches; changed names or
birthdate require review again. A fresh explicit check without remembering clears
prior retained evidence. Person deletion removes the private meta through WordPress.

Review payloads recalculate checks against the current settings and profile, including
older queued submissions. Digital approval requires the displayed `assessment_revision`
as well as submission `version`, and repeats all checks server-side. Approval records
the method/reviewer/time, removes the upload, and shows a confirmation. The member sees
when their identity still needs confirmation instead of a claim that review is active.

**Eerst navraag doen** stores a member-visible note and status `awaiting_member`.
The submission remains active, with its original expiry date and files. Prior VOG
validity remains unchanged. Notes appear in **Mijn VOG**; this action does not send
email. Approval and rejection remain possible after inquiry, with normal version checks.
The member screen refreshes pending review states every 30 seconds.

Since 35.82.2, an existing submission provides the primary member status; the page
no longer simultaneously claims that no VOG was submitted. Previous approved VOG
validity is shown within that status. Upload controls are collapsed behind
**Andere VOG inleveren** during processing, review, inquiry and paper inspection,
and behind **Nieuwe VOG inleveren** after approval. The replacement action explains
that uploading replaces the current submission. First uploads, rejected or expired
submissions, and requests for the original PDF show the upload form immediately.
Submission status remains visible even when the member cannot upload.

Approval writes canonical `datum_vog` through `Fields`, then touches the person's
post modification timestamp for existing Sportlink reverse sync. The API confirms
the Rondo registration; it does not claim that Sportlink has already synchronized.
Pending, failed, rejected and expired submissions preserve prior VOG validity.

## GAAV client identification

Requests use `User-Agent: RondoClub/<theme-version> (+<site-home-url>)` only for
the fixed GAAV endpoint. On 14 September 2026 the production server received
HTTP 403 with the default WordPress user agent and HTTP 200 with the explicit
RondoClub identification for the same public GAAV specification PDF (code 2,
as expected for an unknown document). TLS verification remains enabled and
redirects remain disabled. This diagnostic used no member documents.

## Permissions and storage

`rondo_vog_submission` is a private, non-exportable custom post type without core
CRUD capabilities or generic REST exposure. Structured state is stored in private
post metadata. Uploads target only the current linked person. Former members,
unlinked accounts and demo sites cannot upload. Reading/reviewing another person's
submission requires `vog` and row-level person access; IVA permission is insufficient.

Files use random names and mode 0600 in `../rondo-private/vog` above `ABSPATH`,
directory mode 0700. A kernel `flock` per person serializes replacement, processing,
review and expiry. No custom database tables or public media attachments are used.
Documents stream through authenticated REST requests with `private, no-store`,
`nosniff` and a sandbox CSP. The UI uses nonce-authenticated blob downloads.

Approval, rejection and replacement remove source files and extracted identities
from the submission. Explicitly retained verified names remain in the private
identity record described above.
Open submissions become inaccessible after 30 days; daily `rondo_vog_cleanup`
deletes expired files (100 submissions per run) and orphaned files older than 31
days. Minimal receipts retain hashes, dates, validation code, rule version and
reviewer/method. Person deletion also deletes submissions. Hosting backup retention
is separate and has not been verified by this release; do not promise deletion
from hosting backups within the application's access window.

Uploads are limited to eight new submissions per hour per account. Identical
active file hashes with the same uploader and origin reuse the submission.
Technical failures retry after five and thirty minutes; coordinators can request
additional attempts up to five total. Attempts persist before external work and
have a recovery event. No member notifications are sent in this version.

## REST contract

All paths are relative to `/wp-json/rondo/v1`; authentication and a REST nonce
are required for browser requests.

| Route | Contract |
| --- | --- |
| `POST /vog/upload` | Multipart `files[]`, `source`: `digital`, `paper`, `digital_scan`, `unknown`. Member identity is resolved server-side. |
| `GET /vog/me` | Existing validity response plus `can_upload` and minimal latest `submission`. |
| `GET /vog/submissions?page=1` | Active review items, 25 per page, filtered by accessible people. |
| `GET /vog/submissions/{id}/files/{file_id}` | Zero-based file position; private bytes, never a filesystem path in JSON. |
| `POST /vog/submissions/{id}/review` | `version`, `action` (`approve`/`inquire`/`reject`). `inquire` and `reject` require a member-visible `note` (3–500 characters); approval uses a default confirmation if blank. Approval requires boolean `confirmed` and `method` (`gaav_manual`/`paper_original`). Paper requires `date`. Digital requires `assessment_revision`; identity differences additionally require `identity_confirmed: true` and `identity_method` (`original_id`/`verified_records`). Optional `remember_identity: true` requires the same explicit identity check. Identity values come from the stored extraction, never the request. |
| `POST /vog/submissions/{id}/retry` | Technical digital failures only; coordinator permission and attempt cap enforced. |
| `GET /vog/approval-rules` | Administrator only: `rules` and `reader_available`. |
| `POST /vog/approval-rules` | Administrator only: `rules` array, each with `organization`, `function`, nonempty two-digit `codes`; at most ten rules. |

Statuses: `checking`, `technical`, `review`, `awaiting_member`, `needs_original`,
`waiting_paper`, `approved`, `rejected`, `replaced`, `expired`. The first six are active.
Reviewer payloads include an `assessment` with identity comparison rows, content
checks and revision. Member payloads expose only `identity_check_required` and
`identity_remembered` booleans, not extracted identity values or reviewer details.

## Runtime and testing

`VogDocument` runs `bin/vog/read.py` via bounded array-form `proc_open`, without a
shell. The production Python path is `/bin/python3`; override it using the
`RONDO_VOG_PYTHON` constant if needed. The helper uses isolated mode, an eight-second
CPU limit, a Linux 256 MB address-space limit and a ten-second PHP wall timeout.
It reads encrypted PDFs without rewriting them, emits only first-page text, and
suppresses parser logs. Parsing failure cannot establish authenticity.

CI and release packaging install hash-pinned pypdf and PyCryptodome wheels from
`bin/vog/requirements-linux.txt` into `vendor/vog-python` for Linux x86_64. Other
development platforms need native wheels for the same pinned versions.

```bash
python3 tests/python/test_vog_reader.py
python3 tests/python/make_vog_fixture.py /tmp/rondo-vog-synthetic.pdf
RONDO_TEST_PYTHON=/absolute/path/to/python3 composer test
```

The fixture contains fictional identity data. The integration test exercises the
real encrypted reader and approval lifecycle while mocking the GAAV response.
Permission, stale versions, changed bytes, rule matching, dates, deletion and
bounded retry tests never submit personal documents to an external service.
