---
title: "REST API"
---


This document describes all REST API endpoints available in Rondo Club, including both WordPress standard endpoints and custom endpoints.

## Authentication

All API requests require authentication via WordPress session with REST nonce.

## Tournament registrations

Tournament endpoints are authenticated and use domain permissions rather than generic post-type
access. Managers are administrators or users with the current work-history role
`Coördinator toernooien`; entry access is additionally scoped to its assigned staff accounts.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/rondo/v1/tournaments` | Manager | List tournament editions and totals |
| `POST` | `/rondo/v1/tournaments` | Manager | Create a draft edition |
| `GET`, `PATCH` | `/rondo/v1/tournaments/{id}` | Manager | Read or edit a draft edition |
| `GET` | `/rondo/v1/tournaments/assignment-options` | Manager | List eligible teams and current staff accounts |
| `POST` | `/rondo/v1/tournaments/{id}/publish` | Manager | Create shared entries and send invitations |
| `PATCH` | `/rondo/v1/tournaments/{id}/deadline` | Manager | Extend the internal deadline |
| `GET` | `/rondo/v1/tournaments/{id}/entries` | Manager | Read the team-level progress overview |
| `GET` | `/rondo/v1/tournament-entries/mine` | Signed-in user | List assigned entries |
| `GET` | `/rondo/v1/tournament-entries/{id}` | Assignee or manager | Read one shared entry |
| `PATCH` | `/rondo/v1/tournament-entries/{id}/draft` | Assignee | Save contact and tournament-team draft data |
| `POST` | `/rondo/v1/tournament-entries/{id}/submit` | Assignee | Confirm a positive registration |

Draft and submit writes require the current `version`. A stale version returns HTTP 409 with the
current entry in the error data. Confirmation requires at least one tournament team, a positive
player count per team, and one complete shared contact. See
[Tournament registrations](/features/tournament-registrations/) for the data model and workflow.

**Headers:**
```
X-WP-Nonce: {nonce_value}
```

The nonce is automatically injected by the frontend via `window.wpApiSettings.nonce`.

## API Namespaces

Rondo Club uses two API namespaces:

| Namespace | Purpose |
|-----------|---------|
| `/wp/v2/` | Standard WordPress REST API for CRUD operations on post types |
| `/rondo/v1/` | Custom endpoints for dashboard, search, and specialized operations |
| `/wp-abilities/v1/` | Typed, discoverable read operations for REST, MCP, and AI clients; see [Abilities API](./abilities/) |

---

## Standard WordPress Endpoints (`/wp/v2/`)

These endpoints are provided by WordPress with access control applied:

### People

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/wp/v2/people` | List all accessible people |
| GET | `/wp/v2/people/{id}` | Get single person |
| POST | `/wp/v2/people` | Create new person |
| PUT | `/wp/v2/people/{id}` | Update person |
| DELETE | `/wp/v2/people/{id}` | Delete person |

### Teams

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/wp/v2/teams` | List all accessible teams |
| GET | `/wp/v2/teams/{id}` | Get single team |
| POST | `/wp/v2/teams` | Create new team |
| PUT | `/wp/v2/teams/{id}` | Update team |
| DELETE | `/wp/v2/teams/{id}` | Delete team |

### Taxonomies

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/wp/v2/relationship_type` | List relationship types |
| GET | `/wp/v2/seizoen` | List seasons (for discipline cases) |

---

## Custom Endpoints (`/rondo/v1/`)

These endpoints provide specialized functionality beyond basic CRUD operations.

### Dashboard

**GET** `/rondo/v1/dashboard`

Returns summary statistics and recent activity for the dashboard.

**Permission:** Logged in users only

The response is cached for 15 minutes per user. Cache keys include the site-wide
`rondo_dashboard_cache_generation` option. Saving a person, team, committee, todo,
feedback item, or discipline case advances that generation, so the next request
recomputes immediately even when WordPress uses a persistent object cache. Do not
invalidate dashboard caches by deleting transient rows directly.

**Response:**
```json
{
  "stats": {
    "total_people": 150,
    "total_teams": 45
  },
  "recent_people": [
    {
      "id": 123,
      "name": "John Doe",
      "first_name": "John",
      "infix": "",
      "last_name": "Doe",
      "thumbnail": "https://...",
      "is_favorite": true
    }
  ],
  "upcoming_reminders": [
    {
      "id": 456,
      "title": "John Doe's Birthday",
      "date_value": "2025-01-15",
      "days_until": 5,
      "is_recurring": true
    }
  ],
  "favorites": [...]
}
```

---

### Version

**GET** `/rondo/v1/version`

Returns the current theme version. Used for PWA/mobile app cache invalidation.

**Permission:** Public (no authentication required)

**Response:**
```json
{
  "version": "1.42.0"
}
```

This endpoint is called periodically by the frontend to detect when a new version has been deployed, allowing users to reload and get the latest code.

---

### Global Search

**GET** `/rondo/v1/search`

Search across people and teams.

People matches include:
- first name, infix, last name
- general post search/title
- searchable custom fields
- KNVB ID (`knvb-id` and `custom_knvb-id`)
- e-mail addresses inside `contact_info` (ACF repeater)

**Permission:** Logged in users only

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `q` | string | Yes | Search query (minimum 2 characters) |

**Response:**
```json
{
  "people": [
    { "id": 1, "name": "John Doe", "thumbnail": "...", "is_favorite": true }
  ],
  "teams": [
    { "id": 2, "name": "Acme Corp", "thumbnail": "...", "website": "https://..." }
  ]
}
```

---

### Sportlink Individual Sync

**POST** `/rondo/v1/sportlink/sync-individual`

Start a single-member Sportlink sync for one KNVB ID.

**Permission:** `manage_options` (admin) **or** `toegangscontrole` capability.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `knvb_id` | string | Yes | KNVB member ID to sync |

**Response:**
Returns the proxied response from the sync service, optionally including immediate capability-sync output for the linked person/user.

---

### Upcoming Reminders

**GET** `/rondo/v1/reminders`

Get upcoming birthdays for reminders.

**Permission:** Logged in users only

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `days_ahead` | int | 30 | Number of days to look ahead (1-365) |

**Response:**
```json
[
  {
    "id": 123,
    "title": "John's Birthday",
    "next_occurrence": "2025-01-20",
    "days_until": 10,
    "related_people": [
      { "id": 456, "name": "John Doe", "thumbnail": "..." }
    ]
  }
]
```

Birthdays are generated from the `birthdate` field on person records.

---

### People by Team

**GET** `/rondo/v1/teams/{team_id}/people`

Get all people who work or worked at a team.

**Permission:** Must have access to the team

**Response:**
```json
{
  "current": [
    {
      "id": 1,
      "name": "John Doe",
      "thumbnail": "...",
      "job_title": "CEO",
      "start_date": "2020-01-15",
      "end_date": ""
    }
  ],
  "former": [
    {
      "id": 2,
      "name": "Jane Smith",
      "thumbnail": "...",
      "job_title": "CTO",
      "start_date": "2018-03-01",
      "end_date": "2023-06-30"
    }
  ]
}
```

---

### Filtered People

**GET** `/rondo/v1/people/filtered`

Returns paginated people with server-side filtering and sorting for the `/people` list.

**Authentication:** Required (approved user)

**Useful query params:**

- `page`, `per_page`
- `orderby`, `order`
- `birth_year_from`, `birth_year_to`
- `birth_month` (1-12, filters people by birthday month)
- `person_type` (`member` for members, parents, and legacy records; `contact` for explicitly marked external contacts)
- `is_sponsor` (`1` for active sponsors, `0` for people without the sponsor role; overlaps either person type)
- `knvb_bekend` (`1` when `knvb_id` has a value, `0` when it does not)
- `is_parent` (`1` for people with a current `child` relationship to a published, non-former person)
- `is_businessclub_member` (`1` for active sponsors with the `businessclub` pass variant, `0` for everyone else)
- `include_former` (`1` to include former members)
- `lid_tot_future` (`1` to show members with a future `lid-tot` date)
- `spelend_lid` (`1` = playing members — `spelactiviteit` set and not `-`; `0` = non-playing members)

**Response:**
```json
{
  "people": [
    {
      "id": 123,
      "characteristics": {
        "playing_member": true,
        "knvb_known": true,
        "parent": true,
        "volunteer": true,
        "sponsor": false,
        "contact": false
      }
    }
  ],
  "total": 0,
  "page": 1,
  "total_pages": 0
}
```

---

### People Filter Options

**GET** `/rondo/v1/people/filter-options`

Returns available filter options for the People list with counts. Options are derived dynamically from database values.

**Authentication:** Required (authenticated user)

**Response:**
```json
{
  "total": 523,
  "age_groups": [
    { "value": "Onder 6", "count": 12 },
    { "value": "Onder 7", "count": 18 },
    { "value": "Onder 8", "count": 24 },
    { "value": "Onder 9", "count": 31 },
    { "value": "Onder 9 Meiden", "count": 15 },
    { "value": "Onder 10", "count": 28 },
    { "value": "Onder 11", "count": 35 },
    { "value": "Onder 11 Meiden", "count": 18 },
    { "value": "Onder 12", "count": 42 },
    { "value": "Onder 13", "count": 38 },
    { "value": "Onder 13 Meiden", "count": 19 },
    { "value": "Onder 14", "count": 45 },
    { "value": "Onder 15", "count": 41 },
    { "value": "Onder 15 Meiden", "count": 22 },
    { "value": "Onder 16", "count": 39 },
    { "value": "Onder 17", "count": 36 },
    { "value": "Onder 17 Meiden", "count": 20 },
    { "value": "Onder 18", "count": 33 },
    { "value": "Onder 19", "count": 29 },
    { "value": "Senioren", "count": 87 },
    { "value": "Senioren Vrouwen", "count": 34 }
  ],
  "member_types": [
    { "value": "Junior", "count": 142 },
    { "value": "Senior", "count": 287 },
    { "value": "Donateur", "count": 51 },
    { "value": "Lid van Verdienste", "count": 8 }
  ]
}
```

**Notes:**
- Only values with at least 1 matching person are included
- Age groups sorted youngest to oldest (numeric extraction from "Onder X"), gender variants after base groups
- Member types sorted in priority order (new types from sync appear at end)
- Frontend caches with 5-minute staleTime

---

### Current User

**GET** `/rondo/v1/user/me`

Get information about the currently logged in user.

**Permission:** Logged in users only

**Response:**
```json
{
  "id": 1,
  "name": "Admin User",
  "email": "admin@example.com",
  "avatar_url": "https://...",
  "is_admin": true,
  "is_sponsor": false,
  "is_parent": true,
  "can_access_fairplay": false,
  "can_access_vog": false,
  "can_access_financieel": false,
  "can_edit_financieel": false,
  "feedback_intro_seen": false,
  "profile_url": "https://.../wp-admin/profile.php",
  "admin_url": "https://.../wp-admin/",
  "linked_person_name": "Jan de Vries",
  "active_functies": ["Voorzitter", "Penningmeester"]
}
```

`linked_person_name` is `null` when the user has no linked person record. `active_functies` is an empty array when there are no current job titles. `is_parent` is derived from a current `child` relationship to a published, non-former person and controls whether a sponsor keeps **Mijn inschrijftaken** as their default landing page.

`feedback_intro_seen` is `false` until the user acknowledges the one-time explanation beside the feedback button.

---

### Acknowledge Feedback Introduction

**POST** `/rondo/v1/user/feedback-intro-seen`

Marks the one-time feedback explanation as acknowledged for the current account. The timestamp is stored in user meta, so the explanation stays dismissed across devices.

**Permission:** Logged in users only

**Success response (200):**
```json
{
  "feedback_intro_seen": true
}
```

---

### Change Password

**POST** `/rondo/v1/user/password`

Change the current user's password. On success all sessions are destroyed, requiring the user to log in again.

**Permission:** Logged in users only (demo user is blocked)

**Request body:**
```json
{
  "current_password": "old-password",
  "new_password": "new-secure-password"
}
```

**Success response (200):**
```json
{
  "success": true,
  "message": "Wachtwoord succesvol gewijzigd. Log opnieuw in."
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `wrong_password` | Huidig wachtwoord is onjuist. |
| 403 | `demo_user` | Wachtwoord wijzigen is niet beschikbaar in de demo. |

---

### Request Password Reset Link

**POST** `/rondo/v1/user/password-reset`

Send the current user a one-time WordPress password-reset link. This is the profile fallback for
members who sign in through Magic Login and therefore do not know their generated account password.
Household placeholder addresses are routed to the account's `rondo_contact_email` address.

**Permission:** Logged in users only (demo user is blocked)

**Success response (200):**
```json
{
  "success": true,
  "message": "Controleer je e-mail voor een link om je wachtwoord in te stellen."
}
```

**Error responses:**

| Status | Code | Meaning |
|--------|------|---------|
| 403 | `demo_user` | Password changes are disabled for the demo account. |
| 422 | `no_contact_email` | The account has no deliverable contact address. |
| 500 | `password_reset_email_failed` | WordPress could not send the reset message. |

---

### Person Photo Upload

**POST** `/rondo/v1/people/{person_id}/photo`

Upload and set a person's profile photo. The filename is automatically generated from the person's name.

**Permission:** Must be able to edit the person

**Content-Type:** `multipart/form-data`

**Body:**
- `file` - Image file (JPEG, PNG, GIF, WebP)

**Response:**
```json
{
  "success": true,
  "attachment_id": 789,
  "filename": "john-doe.jpg",
  "thumbnail_url": "https://...",
  "full_url": "https://..."
}
```

---

### Team Logo Upload

**POST** `/rondo/v1/teams/{team_id}/logo/upload`

Upload and set a team's logo. The filename is automatically generated from the team name.

**Permission:** Must be able to edit the team

**Content-Type:** `multipart/form-data`

**Body:**
- `file` - Image file (JPEG, PNG, GIF, WebP, SVG)

**Response:**
```json
{
  "success": true,
  "attachment_id": 789,
  "filename": "acme-corp-logo.png",
  "thumbnail_url": "https://...",
  "full_url": "https://..."
}
```

---

### Set Team Logo (by Media ID)

**POST** `/rondo/v1/teams/{team_id}/logo`

Set a team's logo from an existing media library item.

**Permission:** Must be able to edit the team

**Body:**
```json
{
  "media_id": 789
}
```

**Response:**
```json
{
  "success": true,
  "media_id": 789,
  "thumbnail_url": "https://...",
  "full_url": "https://..."
}
```

---

### Restore Relationship Type Defaults

**POST** `/rondo/v1/relationship-types/restore-defaults`

Restore default inverse relationship mappings and gender-dependent configurations.

**Permission:** Logged in users only

**Response:**
```json
{
  "success": true,
  "message": "Default relationship type configurations have been restored."
}
```

---

### Workspaces

**GET** `/rondo/v1/workspaces`

List all workspaces the current user is a member of.

**Permission:** Logged in users only

**Response:**
```json
[
  {
    "id": 1,
    "name": "My Workspace",
    "description": "Shared team workspace",
    "member_count": 3,
    "role": "owner"
  }
]
```

---

**GET** `/rondo/v1/workspaces/{id}`

Get single workspace with members.

**Permission:** Must be workspace member

**Response:**
```json
{
  "id": 1,
  "name": "My Workspace",
  "description": "Shared team workspace",
  "members": [
    {
      "user_id": 1,
      "display_name": "John Doe",
      "email": "john@example.com",
      "role": "owner"
    }
  ]
}
```

---

**POST** `/rondo/v1/workspaces`

Create a new workspace.

**Permission:** Logged in users only

**Body:**
```json
{
  "name": "New Workspace",
  "description": "Optional description"
}
```

---

**PUT** `/rondo/v1/workspaces/{id}`

Update workspace details.

**Permission:** Must be workspace owner or admin

**Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description"
}
```

---

**DELETE** `/rondo/v1/workspaces/{id}`

Delete a workspace.

**Permission:** Must be workspace owner

---

### Workspace Members

**POST** `/rondo/v1/workspaces/{id}/members`

Add a member to the workspace.

**Permission:** Must be workspace owner or admin

**Body:**
```json
{
  "user_id": 123,
  "role": "member"
}
```

---

**PUT** `/rondo/v1/workspaces/{id}/members/{user_id}`

Update member role.

**Permission:** Must be workspace owner or admin

**Body:**
```json
{
  "role": "admin"
}
```

---

**DELETE** `/rondo/v1/workspaces/{id}/members/{user_id}`

Remove a member from the workspace.

**Permission:** Must be workspace owner or admin

---

### Workspace Invites

**GET** `/rondo/v1/workspaces/{id}/invites`

List pending invites for a workspace.

**Permission:** Must be workspace owner or admin

---

**POST** `/rondo/v1/workspaces/{id}/invites`

Create and send an email invitation.

**Permission:** Must be workspace owner or admin

**Body:**
```json
{
  "email": "newuser@example.com",
  "role": "member"
}
```

---

**DELETE** `/rondo/v1/workspaces/{id}/invites/{invite_id}`

Revoke a pending invite.

**Permission:** Must be workspace owner or admin

---

**GET** `/rondo/v1/invites/{token}`

Validate an invite token (public endpoint).

**Permission:** Public (no authentication required)

**Response:**
```json
{
  "valid": true,
  "workspace_name": "Team Workspace",
  "invited_by": "John Doe",
  "role": "member"
}
```

---

**POST** `/rondo/v1/invites/{token}/accept`

Accept an invite and join the workspace.

**Permission:** Must be logged in

---

### Direct Sharing (People)

**GET** `/rondo/v1/people/{id}/shares`

Get list of users a person is shared with.

**Permission:** Must be post owner

**Response:**
```json
[
  {
    "user_id": 123,
    "display_name": "Jane Smith",
    "email": "jane@example.com",
    "avatar_url": "https://...",
    "permission": "view"
  }
]
```

---

**POST** `/rondo/v1/people/{id}/shares`

Share a person with another user.

**Permission:** Must be post owner

**Body:**
```json
{
  "user_id": 123,
  "permission": "view"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Shared successfully."
}
```

---

**DELETE** `/rondo/v1/people/{id}/shares/{user_id}`

Remove sharing from a user.

**Permission:** Must be post owner

**Response:**
```json
{
  "success": true,
  "message": "Share removed."
}
```

---

### Direct Sharing (Teams)

**GET** `/rondo/v1/teams/{id}/shares`

Get list of users a team is shared with.

**Permission:** Must be post owner

**Response:** Same format as People shares.

---

**POST** `/rondo/v1/teams/{id}/shares`

Share a team with another user.

**Permission:** Must be post owner

**Body:** Same format as People shares.

---

**DELETE** `/rondo/v1/teams/{id}/shares/{user_id}`

Remove sharing from a user.

**Permission:** Must be post owner

---

### User Search

**GET** `/rondo/v1/users/search`

Search for users to share with.

**Permission:** Logged in users only

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `q` | string | Yes | Search query (minimum 2 characters) |

**Response:**
```json
[
  {
    "id": 123,
    "display_name": "Jane Smith",
    "email": "jane@example.com",
    "avatar_url": "https://..."
  }
]
```

Note: The current user is automatically excluded from search results.

---

### Admin User List

**GET** `/rondo/v1/users`

Returns provisioned app users (users linked to a person record) for admin management screens.

**Permission:** Admin only

**Response:**
```json
[
  {
    "id": 12,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "registered": "2026-02-20 09:15:00",
    "last_active": "2026-02-24 08:42:10",
    "linked_person_id": 345,
    "linked_person_name": "Jane Doe"
  }
]
```

`last_active` is `null` when no tracked activity exists yet.

---

### Mention Notifications Preference

**POST** `/rondo/v1/user/mention-notifications`

Update the user's preference for @mention notifications.

**Permission:** Logged in users only

**Body:**
```json
{
  "preference": "digest"
}
```

**Valid values:**
- `digest` - Include mentions in daily digest (default)
- `immediate` - Send email notification immediately when mentioned
- `never` - Do not notify me of mentions

**Response:**
```json
{
  "success": true,
  "mention_notifications": "digest"
}
```

The preference is also returned by GET `/rondo/v1/user/notification-channels` as part of the response:
```json
{
  "channels": ["email"],
  "notification_time": "09:00",
  "mention_notifications": "digest"
}
```

---

### Workspace Member Search

**GET** `/rondo/v1/workspaces/members/search`

Search for workspace members for @mention autocomplete.

**Permission:** Logged in users only

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workspace_ids` | string | Yes | Comma-separated workspace IDs |
| `query` | string | Yes | Search query for member names |

**Response:**
```json
[
  {
    "id": 123,
    "name": "Jane Smith",
    "email": "jane@example.com"
  }
]
```

---

### Invoice Endpoints

Invoice reads require the `financieel_read` capability; writes require `financieel`, which implies it.

---

**GET** `/rondo/v1/invoices/statistics`

Returns rolling 7- and 30-day payment totals, average payment lead time, installment-plan counts, 30 daily income buckets, 12 monthly income buckets, and two current-season contribution distributions. `membership_payment_status` counts fully paid, partially paid through installments, and open contribution invoices. `membership_amount_status` returns the collected, outstanding, and total contribution principal. Installment administration fees are excluded from this principal split. Both distributions exclude drafts, cancelled invoices, and credits. Pass `invoice_type=membership|discipline|manual|volunteer_fine` to filter the other statistics by invoice type. Credit invoices are excluded because they are not income.

---

**GET** `/rondo/v1/invoices`

List invoices with optional filters. Fully paid invoices include `paid_at` as an RFC 3339 timestamp. For installment plans this is the latest payment timestamp once every installment is paid.

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `status` | string | (all) | Filter by status: `draft`, `sent`, `paid`, `overdue` |
| `person_id` | int | 0 | Filter by person |
| `type` | string | (all) | Filter by type: `membership`, `discipline` |
| `payment_plan` | string | (all) | Filter by plan: `full`, `quarterly_3`, `monthly_8` |

---

**GET** `/rondo/v1/invoices/{id}`

Get a single invoice with full details including line items, installment data, person summary, and the canonical `paid_at` timestamp. Each paid installment also exposes its own `paid_at` timestamp.

---

**POST** `/rondo/v1/invoices`

Create a new invoice (typically used for discipline case invoices).

---

**DELETE** `/rondo/v1/invoices/{id}`

Delete an invoice.

---

**POST** `/rondo/v1/invoices/{id}/status`

Update invoice status.

**Body:**
```json
{
  "status": "paid"
}
```

---

**POST** `/rondo/v1/invoices/{id}/generate-pdf`

Generate or regenerate PDF for an invoice.

---

**GET** `/rondo/v1/invoices/{id}/pdf`

Download the generated PDF file.

---

**POST** `/rondo/v1/invoices/{id}/send`

Send invoice email to the linked person. Updates status to `sent` and records `sent_date`.

Optional body field:
- `recipient` — send a test mail to this address instead of the normal recipients. BCC is skipped and draft invoices remain in `draft`.

---

**POST** `/rondo/v1/invoices/{id}/resend`

Resend a previously sent invoice email.

Optional body field:
- `recipient` — send the resend as a test mail to this address only.

---

**POST** `/rondo/v1/invoices/{id}/regenerate-payment-link`

Regenerate the Mollie payment link for an invoice.

---

**GET** `/rondo/v1/invoices/{id}/qr`

Download the QR code image for the invoice payment link.

---

**POST** `/rondo/v1/invoices/{id}/reset-payment-state`

Reset payment state for an invoice (test/debug mode only).

---

**POST** `/rondo/v1/invoices/{id}/toggle-installments`

Enable or disable installments for a specific invoice.

**Body:**
```json
{
  "disabled": true
}
```

---

**GET** `/rondo/v1/invoices/invoiced-cases`

Get discipline case IDs that already have invoices for a given person.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `person_id` | int | Yes | Person to check |

---

### Bulk Invoice Creation

**POST** `/rondo/v1/fees/bulk-create-invoices`

Start a bulk invoice creation job for all uninvoiced members.

**Permission:** Admin only

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `season` | string | No | Season key (e.g., `2025-2026`); defaults to the current season |
| `confirmed` | boolean | Yes | Must be `true`; unconfirmed bulk invoice requests return HTTP 400 |

---

**GET** `/rondo/v1/fees/bulk-invoice-job`

Get progress of the current bulk invoice job.

**Permission:** Admin only

**Response:**
```json
{
  "status": "running",
  "total": 150,
  "processed": 45,
  "created": 42,
  "skipped": 3,
  "errors": []
}
```

---

**POST** `/rondo/v1/fees/create-membership-invoice`

Create a membership invoice for a single person.

**Permission:** Admin only

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `person_id` | int | Yes | Person to invoice |
| `season` | string | No | Season key (defaults to current) |

---

### Mollie Webhook

**POST** `/rondo/v1/mollie/webhook`

Public webhook endpoint called by Mollie when payment status changes. No authentication required — validates via Mollie API callback.

**Permission:** Public (`__return_true`)

---

## Response Enhancements

### Fee List Invoice Enrichment

The `GET /rondo/v1/fees` endpoint enriches each member's fee data with invoice information when invoices exist:

```json
{
  "id": 123,
  "first_name": "Jan",
  "final_fee": 172.50,
  "invoice_id": 456,
  "invoice_status": "sent"
}
```

The `invoice_id` and `invoice_status` fields are `null` when no invoice exists for the member.

### Fee Settings Installment Fields

The `GET /rondo/v1/membership-fees/settings` response includes installment plan flags for each season:

```json
{
  "current_season": {
    "key": "2025-2026",
    "categories": { ... },
    "family_discount": { ... },
    "installment_plan_3_enabled": true,
    "installment_plan_8_enabled": true
  }
}
```

These can be updated via `POST /rondo/v1/membership-fees/settings` by including `installment_plan_3_enabled` and/or `installment_plan_8_enabled` boolean parameters.

### Add a parent/guardian

**POST** `/rondo/v1/people/{person_id}/parents`

Requires `ledenadministratie` or administrator access. The child must be an active person with a KNVB ID and fewer than two parent relationships.

Link an existing person:

```json
{ "mode": "existing", "parent_id": 456 }
```

Create and link a new parent/guardian:

```json
{
  "mode": "new",
  "name": "Noor van Dijk",
  "email": "noor@example.org",
  "phone": "06 12345678"
}
```

The response includes `child_id`, `parent_id`, `created`, and `status: "pending"`.

### Update parent synchronization status

**POST** `/rondo/v1/people/{person_id}/parent-sync-status`

Administrator-only integration callback used by `rondo-sync` after a verified Sportlink write. Payload fields are `parent_id`, `state` (`pending`, `synced`, or `error`), optional `slot` (`1` or `2`), and optional `message`. Person responses expose the resulting list as top-level `parent_sync_statuses`.

### Person Relationships Expansion

The `rest_prepare_person` filter automatically expands relationship data in person responses:

```json
{
  "acf": {
    "relationships": [
      {
        "related_person": 123,
        "person_name": "Jane Doe",
        "person_thumbnail": "https://...",
        "relationship_type": 5,
        "relationship_name": "Spouse",
        "relationship_slug": "spouse",
        "relationship_label": ""
      }
    ]
  }
}
```

### ACF Fields on Relationship Types

Relationship type taxonomy terms include ACF fields in their REST response:

```json
{
  "id": 5,
  "name": "Parent",
  "slug": "parent",
  "acf": {
    "inverse_relationship_type": 6,
    "is_gender_dependent": false,
    "gender_dependent_group": ""
  }
}
```

---

## Error Responses

All endpoints return standard WordPress REST error format:

```json
{
  "code": "rest_forbidden",
  "message": "You do not have permission to access this item.",
  "data": {
    "status": 403
  }
}
```

Common error codes:

| Code | Status | Description |
|------|--------|-------------|
| `rest_forbidden` | 403 | Access denied |
| `rest_not_found` | 404 | Resource not found |
| `rest_invalid_param` | 400 | Invalid parameter |
| `not_logged_in` | 401 | Authentication required |

---

### Functie-Capability Map (Admin Only)

Manage the mapping between Sportlink "functies" (club-level roles) and Rondo permission roles.

**GET** `/rondo/v1/functie-capability-map`

Returns the current functie-to-role mapping.

**Permission:** Admin only

**Response:**
```json
{
  "map": {
    "Voorzitter": { "rondo_bestuur": true },
    "Penningmeester": { "rondo_financieel": true },
    "Wedstrijdsecretaris mDWF": { "rondo_wedstrijdzaken": true }
  }
}
```

---

**POST** `/rondo/v1/functie-capability-map`

Update the functie-to-role mapping.

**Permission:** Admin only

**Body:**
```json
{
  "map": {
    "Voorzitter": { "rondo_bestuur": true },
    "Penningmeester": { "rondo_financieel": true }
  }
}
```

**Response:**
```json
{
  "success": true,
  "map": { ... }
}
```

---

### Commissie-Capability Map (Admin Only)

Manage the mapping between current commissie memberships and Rondo permission roles.

**GET** `/rondo/v1/commissie-capability-map`

Returns `{ map, commissies, roles }`. Map keys are commissie post IDs and values are objects of
role slugs to booleans.

**POST** `/rondo/v1/commissie-capability-map`

Replaces the mapping. The body uses this shape:

```json
{
  "map": {
    "2668": { "rondo_fairplay": true },
    "2669": { "rondo_financieel": true }
  }
}
```

Scheduled and on-demand capability syncs combine this mapping with the functie mapping. Ended
commissie memberships no longer grant their mapped roles.

---

### User Provisioning (Admin Only)

Create WordPress user accounts from person records and manage provisioning settings.

**POST** `/rondo/v1/people/{person_id}/provision`

Provision a WordPress user account for a person. Creates a user with the Rondo User role, links it bidirectionally to the person record, and optionally sends a welcome email.

**Permission:** Admin only

**Response:**
```json
{
  "success": true,
  "user_id": 42,
  "person_id": 789,
  "welcome_email_sent": true
}
```

---

**GET** `/rondo/v1/provisioning/settings`

Returns current provisioning settings including the welcome email template.

**Permission:** Admin only

**Response:**
```json
{
  "welcome_email_subject": "Welkom bij Rondo",
  "welcome_email_body": "Beste {{naam}},\n\nJe account is aangemaakt...",
  "auto_send_welcome_email": true
}
```

---

**POST** `/rondo/v1/provisioning/settings`

Update provisioning settings.

**Permission:** Admin only

**Body:**
```json
{
  "welcome_email_subject": "Welkom bij Rondo",
  "welcome_email_body": "Beste {{naam}},\n\nJe account is aangemaakt...",
  "auto_send_welcome_email": true
}
```

---

### Volunteer Role Classification (Admin Only)

Manage how Sportlink job titles are classified for volunteer status calculation.

**GET** `/rondo/v1/volunteer-roles/available`

Returns all distinct `job_title` values from `work_history` across all person posts.

**Permission:** Admin only

**Response:** Array of strings (role names), sorted alphabetically.

---

**GET** `/rondo/v1/volunteer-roles/settings`

Returns current and default role classification arrays.

**Permission:** All authenticated users (read access for team detail page player/staff split)

**Response:**
```json
{
  "player_roles": ["Aanvaller", "Keeper", ...],
  "excluded_roles": ["Donateur", "Erelid", ...],
  "default_player_roles": ["Aanvaller", "Keeper", ...],
  "default_excluded_roles": ["Donateur", "Erelid", ...]
}
```

---

**POST** `/rondo/v1/volunteer-roles/settings`

Update role classifications. Triggers volunteer status recalculation for all people.

**Permission:** Admin only

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `player_roles` | array | Role names classified as player (not volunteer) |
| `excluded_roles` | array | Role names excluded from volunteer count entirely |

**Response:**
```json
{
  "player_roles": ["Aanvaller", ...],
  "excluded_roles": ["Donateur", ...],
  "people_recalculated": 245
}
```

**WordPress Options:**
- `rondo_player_roles` - Array of player role names
- `rondo_excluded_roles` - Array of excluded role names

When no option is set, hardcoded defaults from `VolunteerStatus` class are used.

---

## Related Documentation

- [Access Control](../features/access-control.md) - How permissions work
- [User Provisioning](../features/user-provisioning.md) - Provisioning user accounts
- [Data Model](../data-model.md) - Post types and fields
- [VOG Filtered People](./vog-filtered-people.md) - VOG tab endpoint with KNVB IDs and volunteer filters


---

### Membership Passes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/rondo/v1/membership-passes/people/{person_id}/qr-token` | Issue signed membership pass QR token |
| POST | `/rondo/v1/membership-passes/verify` | Validate scanned membership pass token |

Detailed reference: `api/membership-passes.md`.
