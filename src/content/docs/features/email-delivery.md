---
title: "Email Delivery (Lettermint)"
---

Rondo Club routes outgoing `wp_mail()` traffic through Lettermint using the theme-level transport `Rondo\Notifications\LettermintMailer`.

## Overview

- Existing mail call sites remain unchanged (`wp_mail()` is still used throughout the codebase)
- Delivery is handled via Lettermint API instead of SMTP/plugin transport
- Delivery failures and complaints are fed back through a signed webhook endpoint

## Outbound Transport

Class: `includes/class-lettermint-mailer.php`

Hook: `pre_wp_mail`

Behavior:
- If Lettermint is not configured, the filter returns `null` and WordPress default mail flow continues
- If configured, mail is sent through Lettermint with support for:
  - HTML/text content
  - `From`, `Cc`, `Bcc`, `Reply-To`
  - Custom headers
  - Attachments
  - Optional route ID
  - Tags and metadata

## Webhook Inbound Events

Class: `includes/class-lettermint-webhook.php`

Endpoint: `POST /wp-json/rondo/v1/lettermint/webhook`

Supported actionable events:
- `message.hard_bounced`
- `message.soft_bounced`
- `message.spam_complaint`

Behavior:
- Verifies webhook signatures using Lettermint SDK
- Stores/updates per-recipient state in option `rondo_lettermint_suppressed_emails`
- Creates idempotent follow-up `rondo_todo` tasks for Secretaris users
- Task deduplication is applied first on Lettermint `event_id`, then on mail-level `message_id + recipient` to avoid duplicate todos for one email when retries/follow-up events arrive
- Falls back to administrators when no active Secretaris is found
- For verification-email flows (`metadata.flow = email_verification`):
  - Assigns bounce follow-up task to the original sender (`metadata.sender_user_id`)
  - Marks the matched person email contact as inactive (`contact_label` suffix `(inactief)` + `_rondo_inactive_emails` post meta)

## Configuration

Configuration helper: `includes/class-lettermint-config.php`

Priority order for values:
1. WordPress constants
2. Environment variables
3. WordPress options

Supported keys:
- API token:
  - `RONDO_LETTERMINT_API_TOKEN`
  - `LETTERMINT_API_TOKEN`
  - `rondo_lettermint_api_token` (option)
- Team API token (for Team API management calls such as webhook creation):
  - `RONDO_LETTERMINT_TEAM_API_TOKEN`
  - `LETTERMINT_TEAM_API_TOKEN`
  - `rondo_lettermint_team_api_token` (option)
  - Falls back to the regular API token when not explicitly configured
- Route ID (optional):
  - `RONDO_LETTERMINT_ROUTE_ID`
  - `LETTERMINT_ROUTE_ID`
  - `rondo_lettermint_route_id` (option)
- Default From email (optional):
  - `RONDO_LETTERMINT_FROM_EMAIL`
  - `LETTERMINT_FROM_EMAIL`
  - `rondo_lettermint_from_email` (option)
- Default From name (optional):
  - `RONDO_LETTERMINT_FROM_NAME`
  - `LETTERMINT_FROM_NAME`
  - `rondo_lettermint_from_name` (option)
- Project ID (selected in settings for webhook auto-provisioning):
  - `rondo_lettermint_project_id` (option)
- Webhook secret:
  - `RONDO_LETTERMINT_WEBHOOK_SECRET`
  - `LETTERMINT_WEBHOOK_SECRET`
  - `rondo_lettermint_webhook_secret` (option)
- Webhook tolerance (seconds, minimum 30):
  - `RONDO_LETTERMINT_WEBHOOK_TOLERANCE`
  - `LETTERMINT_WEBHOOK_TOLERANCE`
  - `rondo_lettermint_webhook_tolerance` (option)

## Settings UI

Rondo exposes Lettermint connection management in:

- `Instellingen > Koppelingen > Lettermint`

The screen stores credentials via the existing club config endpoint (`POST /wp-json/rondo/v1/config`) without exposing token/secret values in responses (only `has_*` flags are returned).

UI guidance:
- Project API token help link points to `https://dash.lettermint.co/projects`
- Team API token help link points to `https://dash.lettermint.co/team/api-tokens`
- Default sender can be configured with:
  - `Standaard afzender e-mailadres`
  - `Standaard afzender naam`
- Bounce verification uses a separate `Verificatiemail` block with:
  - `Verificatiemail From e-mailadres`
  - `Verificatiemail From naam`
  - `Verificatiemail onderwerp`
  - `Verificatiemail bericht`
  - Placeholders: `{name}`, `{email}`, `{club_name}`, `{sender_name}`, `{sender_email}`, `{date}`

Sender behavior:
- If a mail call provides an explicit `From` header, that value is used.
- If not, Lettermint transport falls back to configured default sender values.

## Webhook Provisioning

Admin users can trigger automatic webhook creation from the same Lettermint settings screen.

Backend endpoint:

- `POST /wp-json/rondo/v1/lettermint/webhook/create`

Behavior:

- Uses the configured Team API token (or API token fallback)
- Auto-resolves project/route using this priority:
  - Explicit route override from advanced settings
  - Explicit project override in request payload
  - Stored selected project (`rondo_lettermint_project_id`)
  - Single available project fallback
- Resolves the route by loading project routes (`GET /v1/projects/{projectId}/routes`) and picking the `is_default` route
- Creates a webhook pointing to `POST /wp-json/rondo/v1/lettermint/webhook`
- Registers only actionable events:
  - `message.hard_bounced`
  - `message.soft_bounced`
  - `message.spam_complaint`
- Persists returned `webhook_id` and webhook secret (`secret`/`signing_secret`) to WordPress options for runtime verification

UI note:

- `Instellingen > Koppelingen > Lettermint` uses the automatic flow by default.
- If multiple Lettermint projects are available, the UI shows a dropdown with project names and requires selecting one.
- The selected project is stored and reused for future webhook provisioning calls.
- Webhook status is shown as a simple success/error indicator.
- Detailed webhook metadata (project/route/webhook ID/secret state) is available only under advanced settings.
- Route ID and webhook secret are available only as advanced fallback overrides.

## Delivery Test

The same settings screen supports a quick send test to verify outbound transport:

- `POST /wp-json/rondo/v1/lettermint/test-email`

Behavior:

- Admin-only endpoint
- Uses `wp_mail()` with `X-Rondo-Email-Tag: lettermint-test`
- Validates Lettermint API token presence before sending
- Sends to the provided recipient (or current admin user email when omitted)

## Bounce Verification Flow

Task action endpoint:

- `POST /wp-json/rondo/v1/lettermint/verify-email`

Behavior:

- Accessible to approved users with access to the todo (author, assignee, or admin)
- Sends a verification email via `wp_mail()` with:
  - `X-Rondo-Email-Tag: email-verification`
  - `X-Rondo-Metadata` JSON containing flow/sender/todo/person IDs
- Sender resolution order for verification mails:
  - `Verificatiemail From e-mailadres` and `Verificatiemail From naam`
  - Default Lettermint sender (`Standaard afzender ...`)
  - Current user fallback
- Recipient resolution order:
  - Explicit `recipient` request field
  - Bounce recipient meta on the todo (`_rondo_lettermint_recipient`)
  - First email in the first related person
- When that verification email bounces, webhook processing assigns the follow-up todo to the sender and marks the person email inactive
