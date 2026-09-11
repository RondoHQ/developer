---
title: VOG uploads and review
---

Available since Rondo Club 35.60.0. Members submit a VOG at `/profile/vog`;
coordinators review submissions at `/vrijwilligers/vog/beoordelen`.

## Upload and approval

- Original digital PDF: submit the unchanged bytes to Justid's GAAV endpoint,
  `https://www.validatie.nl/api/valideer/`. Only integer `response_code: 0` confirms
  authenticity. No API key is required by the tested API. HTTP errors, malformed
  responses and technical response codes never approve a document.
- Scan: accept one PDF or up to five ordered JPG/PNG pages, at most 10 MB total.
  Each PDF is limited to five pages and each image to 25 megapixels. A photo picked
  in the digital flow automatically switches the interface to the scan flow.
- Paper: the coordinator must confirm inspection of the genuine paper original,
  its security features, identity, organization, function and screening profile.
  A printout of a digital VOG is insufficient. Scans themselves never receive a
  GAAV approval.
- Unknown origin or scanned digital VOG: request the original PDF; the member
  replaces the previous submission. Version checks prevent stale approvals.

Automatic rules are empty by default. An administrator can configure exact
organization/function pairs and required screening codes in VOG settings. Only
GAAV code 0, a complete first-page extraction, exact normalized names and birthdate,
an applicable rule, and an issue date within the club's three-year window allow
automatic approval. The reverse-page legend is never treated as selected codes.
Other authentic originals go to manual content review. A future or older registered
date cannot replace the existing VOG date.

Approval writes canonical `datum_vog` through `Fields`, then touches the person's
post modification timestamp for existing Sportlink reverse sync. The API confirms
the Rondo registration; it does not claim that Sportlink has already synchronized.
Pending, failed, rejected and expired submissions preserve prior VOG validity.

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

Approval, rejection and replacement remove source files and extracted identities.
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
| `POST /vog/submissions/{id}/review` | `version`, `action` (`approve`/`reject`), member-visible `note` (3–500 characters). Approval also requires boolean `confirmed`, `method` (`gaav_manual`/`paper_original`), and `date` if extraction has no date. |
| `POST /vog/submissions/{id}/retry` | Technical digital failures only; coordinator permission and attempt cap enforced. |
| `GET /vog/approval-rules` | Administrator only: `rules` and `reader_available`. |
| `POST /vog/approval-rules` | Administrator only: `rules` array, each with `organization`, `function`, nonempty two-digit `codes`; at most ten rules. |

Statuses: `checking`, `technical`, `review`, `needs_original`, `waiting_paper`,
`approved`, `rejected`, `replaced`, `expired`. The first five are active.

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
