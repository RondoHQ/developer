---
title: Feedback Agent
---

The Feedback Agent is an autonomous Claude Code instance that processes user feedback (bug reports and feature requests) submitted through the Rondo Club UI. It runs on a Mac Mini every 30 minutes, creating pull requests for resolved items and posting follow-up questions when it needs more information.

## Submitter profile

The feedback response includes `author.person_id` for the submitter’s linked, published person when the viewer can access that record. “Submitted by” links to `/people/{person_id}`. Missing, unpublished, invalid, or inaccessible profiles return `null` and keep the name as plain text. The WordPress account ID remains `author.id`.

The creation and editing forms have no project selector, including for administrators. New UI submissions send `project: rondo-club`; UI edits omit `project` and preserve the stored value. The REST API still accepts the supported project values for integrations.

## Architecture

```
User submits feedback → WordPress REST API → Feedback queue (status: approved)
                                                    ↓
Mac Mini launchd (every 30 min) → bin/get-feedback.sh --loop --optimize
                                                    ↓
                                        Fetch oldest approved item
                                        Set status to in_progress
                                        Pipe to Claude Code --print
                                                    ↓
                            ┌────────────┬──────────┴──────────┐
                         IN_REVIEW    NEEDS_INFO            DECLINED
                            ↓            ↓                     ↓
                     Create PR     Post comment          Set declined
                     Store Dutch  Set needs_info
                     resolution
                     Store PR URL
                            ↓
                     PR is merged
                     Set resolved
                     Send email
                                                    ↓
                                        When no feedback left:
                                        Run optimization review
```

## Feedback Statuses

| Status | Meaning |
|--------|---------|
| `new` | Just submitted by a non-admin user, awaiting approval |
| `approved` | Ready for agent pickup |
| `in_progress` | Currently being processed by the agent |
| `needs_info` | Agent posted a question, waiting for user reply |
| `resolved` | Agent created a PR or the issue was fixed |
| `declined` | Not actionable |

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
the current status is a successful no-op.

## REST API

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

When a user replies to a `needs_info` feedback item, the status automatically transitions back to `approved` so the agent picks it up again.

### Agent Meta Fields

The feedback API includes two agent-specific fields in the `meta` response:

- `pr_url` — URL of the GitHub PR created by the agent
- `agent_branch` — Git branch name used by the agent
- `resolution_summary` — Dutch user-facing explanation of how the feedback was fixed
- `decline_reason` — Dutch user-facing explanation of why the feedback was declined

These are stored as post meta (`_feedback_pr_url`, `_feedback_agent_branch`,
`_feedback_resolution_summary`, and `_feedback_decline_reason`) and can be set via the update
endpoint. Send `resolution_summary` together with `status: resolved`; the API rejects a new
resolved transition when neither that request nor the post already contains an explanation. Send
`decline_reason` together with `status: declined` on the same terms. Both fields are
administrator-only — a non-admin supplying either gets a 403.

## Script: `bin/get-feedback.sh`

### Flags

| Flag | Description |
|------|-------------|
| `--run` | Process one feedback item with Claude Code |
| `--loop` | Process all approved items until none remain |
| `--optimize` | When no feedback, review one file for optimization |
| `--status=X` | Filter by status (default: `approved`) |
| `--type=X` | Filter by type: `bug` or `feature_request` |
| `--id=X` | Process a specific feedback item |
| `--json` | Output raw JSON (no Claude processing) |

### Safety

- **Lock file** at `/tmp/rondo-feedback-claude.lock` prevents concurrent runs
- **Crash cleanup** resets feedback status to `approved` if the script exits unexpectedly
- **`ensure_clean_main()`** aborts if the working directory is dirty
- **Branch cleanup** deletes merged `feedback/*` and `optimize/*` branches after each run
- Status set to `in_progress` before Claude runs, preventing other instances from picking up the same item

### Agent Prompt

The agent's instructions live at `.claude/agent-prompt.md`. Key rules:
- Create branch `feedback/{id}-{slugified-title}`
- Make changes, build, commit, push, create PR via `gh pr create`
- Do NOT deploy — only create PRs
- Output `STATUS: IN_REVIEW` + `PR_URL:` + a one-line Dutch `RESOLUTION:`, or `STATUS: NEEDS_INFO` + `QUESTION:`

### Optimization Mode

When `--optimize` is set and no feedback items are found, the script reviews one file per run:
1. Build a queue of PHP includes and React source files
2. Track reviewed files in `logs/optimization-tracker.json`
3. Claude reviews one file using `.claude/optimize-prompt.md`
4. If improvements found, creates a PR on `optimize/{module-name}` branch
5. Max 1 optimization PR per run

## Mac Mini Setup

### launchd Configuration

The plist template is at `bin/com.rondo.feedback-agent.plist`. To install on the Mac Mini:

```bash
# Copy to LaunchAgents
cp bin/com.rondo.feedback-agent.plist ~/Library/LaunchAgents/

# Load the job
launchctl load ~/Library/LaunchAgents/com.rondo.feedback-agent.plist

# Check status
launchctl list | grep rondo

# Unload if needed
launchctl unload ~/Library/LaunchAgents/com.rondo.feedback-agent.plist
```

### Prerequisites on Mac Mini

- Claude Code CLI installed and authenticated (Max OAuth)
- `gh` CLI authenticated with GitHub
- SSH keys configured for git push
- `.env` configured with API credentials
- `jq` installed (`brew install jq`)

### Logs

- `logs/feedback-processor.log` — Main script log
- `logs/launchd-stdout.log` — launchd stdout capture
- `logs/launchd-stderr.log` — launchd stderr capture
- `logs/optimization-tracker.json` — Tracks which files have been reviewed

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
