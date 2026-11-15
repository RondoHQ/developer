---
title: Feedback Agent
---

Rondo Club stores bug reports and feature requests for review. Process feedback
in a reviewed interactive session. The legacy unattended runner is disabled.

## Submitter profile

The feedback response includes `author.person_id` for the submitter’s linked, published person when the viewer can access that record. “Submitted by” links to `/people/{person_id}`. Missing, unpublished, invalid, or inaccessible profiles return `null` and keep the name as plain text. The WordPress account ID remains `author.id`.

The creation and editing forms have no project selector, including for administrators. New UI submissions send `project: rondo-club`; UI edits omit `project` and preserve the stored value. Administrator integrations can set the project through the REST API.

## Review workflow

| Status | Meaning |
|--------|---------|
| `new` | Awaiting review or reapproval |
| `approved` | Ready to review the recorded approval and start work |
| `in_progress` | Work has started |
| `in_review` | A proposed change is ready for review |
| `needs_info` | Waiting for more information |
| `resolved` | The issue has been resolved |
| `declined` | The club has declined the request |

Approval applies to one revision. Feedback responses expose the current
`content_revision` and the recorded `approved_revision`. The latter is an
empty string when no approval is recorded. Check both the workflow status
and the matching revision before relying on an approval. Review content
includes the title, description, report details, project, screenshot,
plan and comments. Priority and other workflow bookkeeping sit outside
the fingerprint.

A content change or new comment clears recorded approval and returns items
in `approved`, `in_progress`, `in_review` or `needs_info` to `new`.
Rondo also clears the old plan. An administrator may save a replacement
plan in the same edit for review. Sending `status: "approved"` with an
administrator edit records approval for the final saved content. An edit
that leaves the revision unchanged preserves approval.

### New feedback email

After the REST API has stored a new feedback item and all of its metadata, Rondo sends a branded
HTML notification to the WordPress administration email (`admin_email`). The message contains the
submitter, feedback type, project, priority, description, and a direct link to `/feedback/{id}`.
This applies to every new feedback item, including administrator submissions that start with the
`approved` status.

A successful delivery records `_new_feedback_email_sent_at` on the feedback post, preventing
duplicate notifications for the same item. Mail delivery is non-blocking: if `wp_mail()` fails or
the administration address is invalid, the feedback REST request still succeeds and the item
remains available in the queue.

### Resolution email

When an administrator changes feedback from any non-resolved status to `resolved`, a Dutch
`resolution_summary` is required. Rondo stores it as `_feedback_resolution_summary` and sends the
feedback author a branded HTML email. The message highlights the explanation under “Zo hebben we
het opgelost”, contains the feedback title, and links to `/feedback/{id}`. Household accounts use
`UserProvisioning::contact_email()` so mail is sent to the real shared address instead of a
synthetic `@members.rondo.invalid` WordPress address.

A successful delivery records `_feedback_resolution_email_sent_at` on the feedback post. This
makes the notification one-time: submitting the same `resolved` status again, or reopening and
resolving the same item later, does not send a duplicate. The update response includes a
`resolution_email` result only on the transition that attempted delivery.

### Decline email

Declining works the same way in mirror image. Changing feedback from any non-declined status to
`declined` requires a Dutch `decline_reason`, stored as `_feedback_decline_reason`, and sends the
author a branded HTML email that highlights the explanation under “Waarom we dit niet doen”. It
closes by inviting the submitter to send new feedback, so a decline does not read as a dead end.

Delivery records `_feedback_decline_email_sent_at`, making this one-time in exactly the way the
resolution email is: reopening a declined item and declining it again does not mail the author
twice. The update response includes a `decline_email` result only on the transition that attempted
delivery, and `_feedback_declined_at` is cleared when an item moves back out of `declined`.

In the UI both outcomes share one dialog, `FeedbackOutcomeModal`, parameterised by variant —
picking `resolved` or `declined` from the feedback list opens it and blocks the change until an
explanation is written. The edit modal shows the matching field inline when an administrator
selects either status. Once saved, the feedback detail page shows the resolution summary or
decline reason together with its outcome date, so both the submitter and administrators can see
how the item was handled.

### Changing status with WP-CLI

Use the status command for manual or operational changes instead of writing ACF post meta directly:

```bash
wp rondo feedback set-status 8496 resolved \
  --message="Het formulier gebruikt nu één datum met aparte begin- en eindtijden."
wp rondo feedback set-status 8496 declined \
  --reason="Dit kan al via de knop rechtsboven op het dashboard."
wp rondo feedback set-status 8496 needs_info
```

Allowed statuses are `new`, `approved`, `in_progress`, `in_review`, `resolved`, `declined`, and
`needs_info`. The command delegates to the same `StatusService` as the REST update endpoint, so a
transition to `resolved` sets `_feedback_resolved_at` and attempts the one-time styled email. A
new transition to `resolved` requires `--message` unless a resolution summary was stored earlier,
and a new transition to `declined` requires `--reason` on the same terms. A repeated command with
the current status leaves it in place. Setting `approved` again records the current revision.

## REST API

### Item permissions

The submitter and users with feedback-section access can read an item. The
submitter or an administrator can edit it. The item route
`/rondo/v1/feedback/{id}` accepts `POST`, `PUT`, and `PATCH` for edits.
On creation, member submissions use `new`, `medium` and `rondo-club` for
status, priority and project. Administrators can choose an initial status of
`new` or `approved`, with `approved` as the default.

Only administrators can edit `status`, `priority`, `project`, `resolution_summary`,
`decline_reason`, `agent_plan`, `agent_branch` and `pr_url`. A non-admin edit
that supplies any of these fields returns HTTP 403 before applying changes.
Members write feedback and its comments through the Rondo routes. The generic
`/wp/v2/feedback` and `/wp/v2/comments` writes for feedback return HTTP 403
for non-admins. `DELETE /rondo/v1/feedback/{id}` requires `manage_options` and
permanently deletes the item.

### Private screenshots

`POST /rondo/v1/feedback` and `POST /rondo/v1/feedback/{id}` accept one optional `screenshot` file during creation or editing. Send the feedback fields and file as `multipart/form-data`; PHP parses uploads on POST. Requests without a screenshot keep the JSON format. Only the submitter and administrators may add or replace a screenshot; feedback-section read access alone is insufficient. Both forms share `FeedbackScreenshotInput`, with a preview, a button to clear the newly selected file, and visible save errors.

An edit without a file preserves the stored screenshot. Selecting a file replaces it after the new descriptor is saved and read back successfully, then deletes the old private file. Invalid uploads are rejected before text changes. Failed attachment storage removes the new file while preserving the previous attachment. There is no API action to remove a stored screenshot; clearing the file selection only cancels the pending upload.

The server validates the actual image bytes: PNG, JPEG or WebP, at most 5 MiB and 25 million pixels. Invalid uploads return HTTP 400 before feedback creation or notification; storage failures return HTTP 500 and clean up the file and any newly created feedback record.

Feedback responses expose top-level `has_screenshot` and `screenshot_version` fields. The version is a SHA-256 hash of the descriptor, or an empty string without a screenshot; it refreshes the authenticated preview after replacement without exposing a storage path. To read the image, request `GET /rondo/v1/feedback/{id}/screenshot` with normal REST authentication. The endpoint uses the same access check as the feedback thread: its submitter or a user with feedback-section access may read it. Anonymous and unrelated users cannot read the image. Missing files and trashed feedback return HTTP 404.

`Rondo\Feedback\FeedbackScreenshot` stores files in `rondo-private/feedback/` beside the WordPress directory, outside public uploads. It uses a random filename, directory permissions `0700`, file permissions `0600`, and protected `_feedback_screenshot` post metadata. Include this private directory in backups alongside the WordPress database. Permanent feedback deletion removes the file; trashing the record only blocks access.

The REST response streams the image with `Cache-Control: private, no-store, max-age=0`, `X-Content-Type-Options: nosniff` and `Content-Security-Policy: sandbox`. `FeedbackScreenshot.jsx` fetches an authenticated blob and displays a temporary object URL, revoking it when the component unmounts. No public media URL or storage filename appears in the feedback response.

### Feedback Comments

Comments enable a conversation thread between the agent and users on feedback items.

**List comments:** `GET /rondo/v1/feedback/{id}/comments`

Returns an array of comments ordered by date ascending:
```json
[
  {
    "id": 1,
    "content": "Can you clarify which page this happens on?",
    "author_id": 1,
    "author_name": "Admin",
    "author_type": "agent",
    "created": "2026-02-14 12:00:00"
  }
]
```

**Create comment:** `POST /rondo/v1/feedback/{id}/comments`

```json
{
  "content": "It happens on the People list page",
  "author_type": "user"
}
```

`author_type` defaults to `user`. Only administrators can post as `agent`.
Each new comment invalidates approval. A reply to a `needs_info` item
returns it to `new` for review.

### Agent Meta Fields

The feedback API exposes agent and outcome fields in `meta`.

- `pr_url` — URL of the GitHub PR created by the agent
- `agent_branch` — Git branch name used by the agent
- `agent_plan` — plan saved by an administrator for review
- `resolution_summary` — Dutch user-facing explanation of how the feedback was fixed
- `decline_reason` — Dutch user-facing explanation of why the feedback was declined

The update endpoint stores these fields as post meta. A transition to
`resolved` requires a `resolution_summary` in the request or already on the
item. A transition to `declined` requires a `decline_reason` on the same terms.

## Script: `bin/get-feedback.sh`

The script exits with status 1 before reading credentials, acquiring locks
or launching agents. The same exit applies with every script flag, including when launchd invokes it.

## Frontend

### Feedback overview and cache

The overview starts with numeric ID sorting in descending order, with the active direction visible in the ID header. Sorting and filtering run in the browser after every REST page has loaded. `feedbackListOptions()` reads `X-WP-TotalPages`, fetches the remaining pages with the same filters, and rejects a failed page instead of displaying an incomplete list.

`src/utils/feedbackQueries.js` owns shared keys and refresh behavior. Detail and comment keys normalize IDs to strings. List queries always refetch on mount; detail and comment queries refetch stale data on mount. After an update, `refreshUpdatedFeedback()` cancels the old detail request, writes the returned record into the detail cache, and waits for list invalidation with `refetchType: 'all'` plus dashboard invalidation. This also refreshes cached inactive overviews before the edit dialog closes.

### FeedbackDetail Page

- Shows **PR link** when `meta.pr_url` is set
- Shows **"Waiting for your response"** banner when status is `needs_info`
- Shows **conversation thread** with agent/user messages
- Shows **reply form** when status is `needs_info`
- Shows the private screenshot when `has_screenshot` is true, with an option to open it at full size
- Opens `meta.url_context` in a new tab using `rel="noopener noreferrer"`

### FeedbackManagement Admin Page

- Includes `needs_info` ("Info nodig") in status dropdown
- Shows **PR** column with link to GitHub PR

## Configurable feedback notice

Administrators configure **Melding boven het feedbackformulier** under **Instellingen → Club**. The notice directs profile and membership questions to the club's membership administration. It is disabled by default with an empty contact address. Settings include an enable switch, title, plain multiline text, email and a live preview; disabling retains the content for re-enabling.

`GET /rondo/v1/config` returns `feedback_notice`; administrator-only `POST /rondo/v1/config` accepts a partial `feedback_notice` object with `enabled`, `title`, `text` and `email`. Omitted fields retain their current values. The option is `rondo_feedback_notice`, and the initial frontend configuration exposes it as `window.rondoConfig.feedbackNotice`. The settings save refreshes that in-memory value.

Enabled notices require a nonempty title/text and valid email. A supplied nonempty invalid email is rejected even while disabled. Invalid settings return HTTP 400 (`rondo_invalid_feedback_notice`) without overwriting the stored notice. Title and textarea sanitization remove markup. `FeedbackNotice` renders text through React with preserved line breaks, replaces every `{email}` with a `mailto:` link, and adds a separate email link when the placeholder is absent. The shared feedback modal shows it above the form fields. The notice is guidance and does not change submission permissions or routing.

`tests/Wpunit/FeedbackNoticeTest.php` covers defaults, sanitization, partial disable/re-enable updates, validation and administrator-only writes.
