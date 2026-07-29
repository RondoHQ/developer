---
title: Feedback Agent
---

The Feedback Agent is an autonomous Claude Code instance that processes user feedback (bug reports and feature requests) submitted through the Rondo Club UI. It runs on a Mac Mini every 30 minutes, creating pull requests for resolved items and posting follow-up questions when it needs more information.

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

### Changing status with WP-CLI

Use the status command for manual or operational changes instead of writing ACF post meta directly:

```bash
wp rondo feedback set-status 8496 resolved \
  --message="Het formulier gebruikt nu één datum met aparte begin- en eindtijden."
wp rondo feedback set-status 8496 needs_info
```

Allowed statuses are `new`, `approved`, `in_progress`, `in_review`, `resolved`, `declined`, and
`needs_info`. The command delegates to the same `StatusService` as the REST update endpoint, so a
transition to `resolved` sets `_feedback_resolved_at` and attempts the one-time styled email. A
new transition to `resolved` requires `--message` unless a resolution summary was stored earlier.
A repeated command with the current status is a successful no-op.

## REST API

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

These are stored as post meta (`_feedback_pr_url`, `_feedback_agent_branch`, and
`_feedback_resolution_summary`) and can be set via the update endpoint. Send
`resolution_summary` together with `status: resolved`; the API rejects a new resolved transition
when neither that request nor the post already contains an explanation.

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

### FeedbackDetail Page

- Shows **PR link** when `meta.pr_url` is set
- Shows **"Waiting for your response"** banner when status is `needs_info`
- Shows **conversation thread** with agent/user messages
- Shows **reply form** when status is `needs_info`

### FeedbackManagement Admin Page

- Includes `needs_info` ("Info nodig") in status dropdown
- Shows **PR** column with link to GitHub PR
