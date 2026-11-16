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
| `enquete_resultaten` | Read results, analysis, conclusions and round comparisons, and download CSV exports |

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

### Choose recipients

**Alle leden selecteren** loads current members the signed-in user may access.
It skips former members, external contacts, company-only records, deceased
members and people without a valid email. The editor shows the selected member
count and unique email count. You can remove people before preparing invitations.
You can also search for individuals or enter email/name rows manually.

The server rechecks person access and resolves the primary email from the person
record. In all-members mode it also rechecks current membership. Raw recipient
rows carry only an email and optional name. The UI submits groups of 500, and the
API accepts up to 2,000 resolved recipients per request. A shared email gets one
invite and one reply per context. Preparing the same address again reuses the
invite and its original questionnaire version. Preparation adds to the existing
list and sends no mail.

### Edit and preview the invitation email

**Begeleidende e-mail** saves the subject and message separately from the
questionnaire draft and published versions. Both fields are plain text and
required. The subject allows up to 200 characters on one line, and the message
allows up to 10,000 characters. The branded email adds the personal survey link
automatically. Existing surveys have a default subject and message.

Both fields support `{voornaam}`, `{naam}`, `{enquete}` for the survey title
and `{club}` for the site name. `{voornaam}` uses the linked person's
registered first name, including compound names. It falls back to **AWCer** when no first name is available, including for
manual email rows. `{naam}` uses the invite name and falls back to `clublid`.
Preview and test use the signed-in user's display name and first name. For the
first name, they prefer the linked person and then the WordPress profile.

The UI requires a preview of the saved message and a confirmation before
sending. Preview and test also accept unsaved copy. **Testmail naar mezelf**
uses the signed-in manager's WordPress email address and adds `[Test]` to the
subject. Its button opens the authenticated survey preview. Testing creates
no invitations or responses.

### Delivery and reminders

The explicit `send` action queues incomplete invitations in `prepared` or
`failed` state. Each queued invitation stores the subject and body templates
used for that send, so later edits leave the queued copy intact. Supply the
last read `expected_email` when saving or queueing the reviewed message.
A stale value returns HTTP 409.

WordPress processes up to 30 attempts per batch through the branded `wp_mail`
transport. The `rondo_survey_delivery_batch` event is scheduled for the next
minute boundary when messages are queued and again when a batch uses its full
budget. The hourly `rondo_survey_deliveries` sweep also handles automatic
reminders and pending work. Closed surveys and completed invitations are
skipped. Before sending an invitation linked to a person, Rondo checks the
communication policy again.

One reminder can be sent to each incomplete invitation, manually or after
`reminder_days` (default 7, maximum 90, with 0 disabling automatic reminders).
Reminders use the built-in subject and message. Failed sends remain visible as
`failed` or `reminder_failed` and can be queued again. If the send outcome is
unknown, its state stays `sending` and cron skips it. Mail acceptance records
handoff to the transport. Inbox delivery requires separate confirmation.

### Duty-type survey selection

Task types select an open survey through `fields.survey_id` on
`POST /wp/v2/dienst-types` or `POST /wp/v2/dienst-types/{id}`.
The REST schema gives its type as `integer|null`, with minimum 0. Send an existing
survey ID to select it. Send `0` or `null` for **Geen interne enquête**, including
to clear a saved choice. You can also create a task type without an internal survey.

The PHP field layer turns whole numbers and whole-number strings into integers
before checking the survey. It rejects fractions, negative IDs, booleans, overflow
and invalid values without truncation. Invalid REST values return HTTP 400 before
creating a task type or saving other fields. Responses return an integer or `null`.
Storage keeps the `survey_id` key and its `_survey_id` field reference.

The existing [shift email scheduler](/features/volunteer-shifts/#notifications) sends its
personal invitation one day after the shift, skipping no-shows. The context is
`dienst:{shift_id}:persoon:{person_id}`, so another shift receives its own invitation.
The internal survey takes precedence over `survey_url`; a selected closed survey
blocks that send rather than falling back to the external URL. Successful shift
mail marks the invitation sent, allowing the survey reminder workflow to continue.

## Results and export

Select a published version in **Resultaten**. The
[survey analysis workspace](/features/survey-analysis/) supports multiple choice
filters, open-answer search, confirmed themes, conclusions and round comparisons.
Survey managers with results access can configure profiles and track follow-up
actions. The legacy results API still returns 50 rows per page.
CSV exports include all matching rows, with option labels, semicolons and a UTF-8 BOM.
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
| `POST /surveys/{id}/action` | Manage. `action` is `publish`, `close`, `duplicate`, `send` or `remind`. `send` and `remind` accept optional `expected_email` and return `{ queued }` |
| `GET /surveys/recipients?search=...` | Manage; at least two characters, up to 30 accessible people with a primary email |
| `GET /surveys/recipients?all_members=true` | Manage. Returns `{ id, name, email }` rows for accessible, contactable current members |
| `GET /surveys/available` | Manage, `vrijwilligers` or administrator; open survey IDs/titles for the task-type picker |
| `GET /surveys/{id}/invitations` | Manage; recipients and delivery/completion state, without tokens |
| `POST /surveys/{id}/invitations` | Manage. Accepts `recipients: [{ email, name }]` and/or `person_ids`. Set `all_members: true` to recheck the current-member filter for those IDs. Returns `{ prepared }` |
| `GET /surveys/{id}/email` | Manage. Returns the effective `{ subject, body }` |
| `PUT /surveys/{id}/email` | Manage. Accepts `email: { subject, body }` and the last read `expected_email`. Returns the saved settings or HTTP 409 if they changed |
| `POST /surveys/{id}/email-preview` | Manage. Accepts `email: { subject, body }` and returns `{ subject, html }` |
| `POST /surveys/{id}/email-test` | Manage. Accepts the same input as preview and returns `{ sent_to }` after mail handoff |
| `GET /surveys/{id}/results` | Results. Accepts the [shared analysis selection](/features/survey-analysis/#rest-contract) and `page`. Returns version, total, summary, rows, page and pages |
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
recipient scoping, preview and test isolation, saved email conflicts, personalization,
batch continuation, task types without surveys, clearing selections and per-shift
invitations with no-show exclusion. `IntegerFieldContractTest` checks integer values and bounds, clearing with `null`,
REST and metadata schemas, and stored keys. It also checks invalid writes and access
rights. Ordinary `number` fields still
support fractions.
