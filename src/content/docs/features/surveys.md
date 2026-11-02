---
title: Surveys
---

Rondo surveys let you build forms, invite people and read their answers in
**Communicatie → Enquêtes** (`/communicatie/enquetes`). People can answer through a public
link or a personal invite without a Rondo account.

## Permissions

Two separate section rights control access:

| Capability | Access |
| --- | --- |
| `enquetes` | Create, edit, preview, publish, close, duplicate and manage invitations |
| `enquete_resultaten` | Read results and download CSV exports |

Either right allows users to read the survey list and detail. Editors need the results right to read answers.
Users with only the results right cannot read the list of invited people. Administrators
and `rondo_bestuur` receive both rights through role version 21. These section rights
do not grant access to all people. Current-user flags are `can_access_enquetes` and
`can_access_enquete_resultaten`.

## Questions and branching

The editor lets you order sections, questions and answer options. Questions support `single`,
`multiple`, `scale` and `text`, with descriptions and optional required answers.
The **Vrijwilligersenquête gebruiken** template includes four routes: a completed
shift, an upcoming shift, another volunteer role, and no signup yet. It creates a
draft; it does not publish or send invitations.

Each section or question can depend on one answer to an earlier choice question.
A rule is `{ "question": "route", "value": "planned" }`; multiple-choice rules
test whether the answer contains that option. Rules cannot refer to later questions, form cycles, use unknown
options or test text answers. Moving or removing a referenced
question requires updating its rules.

The server validates 1–40 nonempty sections, at most 200 questions, and 2–40 options
per choice question. Section and question IDs must be unique across the document;
option IDs must be unique within their question. IDs start with a letter and contain
at most 64 letters, digits, underscores or hyphens. The document limit is 512,000
JSON bytes; text answers allow at most 10,000 characters.

Both the browser and server remove hidden answers before checking later rules.
Only visible required questions block submission. The public runner shows one
section at a time with previous/next controls and progress. It saves unfinished
answers in tab-local `sessionStorage`, scoped to survey, version and invitation,
then clears them after a successful submission. Draft preview uses the saved
document and stores no answers.

## Drafts and published versions

Saving changes updates the draft. Each publish saves a new version
with its title, intro, questions and thank-you text. Published versions cannot change. Send the last read `revision` when saving. If another editor has saved since
then, the API returns HTTP 409.

The general link uses the latest published version. Invites keep the version that
was current when they were prepared. A stale general form must reload after a
new version is published. Results remain separated by version.

Access (`public` or `invitation`) and answer linkage (`linked`) cannot change after
the first publication. Duplicate the survey to change them. A duplicate is a draft
without published versions, invites, replies or a closing date. Closing or reaching
`closes_at` blocks reads and submissions; publishing requires a future closing date
when one is set. Dates use RFC 3339 with an explicit timezone.

## Links and answer privacy

The public page is `/enquete/{id}`. Public surveys provide a general link and a
downloadable QR image. Invitation-only surveys require the personal link
`/enquete/{id}?uitnodiging={token}`. Each token is 64 random hex characters and
allows one reply. A general link cannot enforce one response per person.

By default, replies store no name, email, person ID or invite context.
Invites keep the name, email and whether the person has replied in a separate record.
Administrators with storage access may still link these records.
Open text can also identify someone. With `linked: true`, a reply from a personal
invite includes those fields. A reply through the general link
has no invite identity to attach.

The HTML shell sends `no-store, private`, `noindex, nofollow` and `no-referrer`.
Public and management APIs also disable caching and indexing. The service worker
uses `NetworkOnly` for both survey namespaces. The standalone runner uses no
analytics or external assets and fetches without WordPress credentials.

## Invitations and reminders

Prepare recipients from accessible people or email/name rows. Person selections
resolve the primary email server-side; raw recipient rows cannot attach a person ID.
Preparation checks all rows and accepts at most 2,000 people per batch.
It keeps one invite per lowercase email address within the same context. Preparing the same email again
reuses the invite and its original version. This step sends no mail.

The explicit `send` action queues incomplete invitations in `prepared` or `failed`
state. Hourly `rondo_survey_deliveries` cron processes at most 30 messages per run,
using the shared branded `wp_mail` transport. Closed surveys and completed invitations
are skipped. Invitations linked to a person recheck the communication policy.

One reminder can be sent to each incomplete invitation, manually or after
`reminder_days` (default 7; 0 disables automatic reminders, maximum 90).
Failed sends remain visible as `failed` or `reminder_failed` and can be queued again.
If the send outcome is unknown, its state stays `sending`. Cron does not resend it.
Successful `wp_mail` acceptance does not prove inbox delivery.

Task types can select an open survey through canonical `survey_id` (0 clears it).
The existing [shift email scheduler](/features/volunteer-shifts/#notifications) sends its
personal invitation one day after the shift, skipping no-shows. The context is
`dienst:{shift_id}:persoon:{person_id}`, so another shift receives its own invitation.
The internal survey takes precedence over `survey_url`; a selected closed survey
blocks that send rather than falling back to the external URL. Successful shift
mail marks the invitation sent, allowing the survey reminder workflow to continue.

## Results and export

Select a published version and optionally filter by choice `question` and `value`.
Summaries count only answers present for each question. Percentages use that
question's answered count; multiple-choice totals can exceed 100%.
The response list shows 50 rows per page. CSV exports include all matching rows, with option labels, semicolons and a UTF-8 BOM.
Cells that look like formulas start with an added apostrophe. Linked surveys add recipient
columns; unlinked surveys omit them.

## REST contract

All routes use `/wp-json/rondo/v1`. Management requests use normal WordPress
authentication and browser nonces. Rights below refer to the capabilities above.

| Method and path | Right and contract |
| --- | --- |
| `GET /surveys` | Either right; metadata list without questionnaire documents |
| `POST /surveys` | Manage; `title`, `document`, optional settings, or `template: "volunteers"` |
| `GET /surveys/{id}` | Either right; draft, versions, URL and effective rights |
| `PUT /surveys/{id}` | Manage; partial settings/document update with last read `revision` |
| `POST /surveys/{id}/action` | Manage; `action`: `publish`, `close`, `duplicate`, `send` or `remind` |
| `GET /surveys/recipients?search=...` | Manage; at least two characters, up to 30 accessible people with a primary email |
| `GET /surveys/available` | Manage, `vrijwilligers` or administrator; open survey IDs/titles for the task-type picker |
| `GET /surveys/{id}/invitations` | Manage; recipients and delivery/completion state, without tokens |
| `POST /surveys/{id}/invitations` | Manage; `recipients: [{ email, name }]` and/or `person_ids`; returns `{ prepared }` |
| `GET /surveys/{id}/results` | Results; optional `version`, `question`, `value`, `page`; returns version, total, summary, rows, page and pages |
| `GET /surveys/{id}/export` | Results; same selection, all rows; returns JSON `{ csv, filename }` |
| `GET /public-surveys/{id}` | Public; optional `invitation` token; published document/version, privacy mode and signed challenge |
| `POST /public-surveys/{id}` | Public; same token plus JSON `version`, `challenge`, `answers`, empty `website`; returns `{ submitted, thanks }` |

Public submissions require an HMAC challenge bound to survey, version and token.
It expires after 24 hours; a nonempty honeypot, future timestamp or invalid signature
returns HTTP 403. A salted transient counter limits POST attempts to 300 per
hour per remote address/survey/token combination. It does not trust forwarded headers
or retain the raw IP. Duplicate submissions, stale versions and closed submissions
return HTTP 409. Missing surveys, invalid tokens, and closed or unpublished public
reads return HTTP 404; an already completed invitation returns HTTP 409.

## Storage and tests

Private, non-exportable native post types store survey (`rondo_survey`), version
(`rondo_survey_version`), invitation (`rondo_survey_invite`) and response
(`rondo_survey_reply`) JSON in `post_content`. Children use `post_parent`.
There is no generic WordPress REST exposure or core CRUD access. Invitation lookup
uses `_survey_token_hash`; the private invitation JSON also contains its delivery token.
Treat storage and backups as sensitive. Native option locks allow one publish, close, prepare or submit action at a time.
Stored option claims prevent the same reply from being saved twice.

Implementation: `class-surveys.php`, `class-survey-schema.php`,
`class-survey-volunteer-template.php`, `class-rest-surveys.php`,
`class-public-survey-page.php`, `public/survey.js` and `Surveys.jsx`.
`SurveysTest` covers branching, hidden required questions, immutable versions,
invitation reuse, privacy, replay, closing, permissions, CSV safety, reminders,
editor conflicts and per-shift invitations with no-show exclusion.
