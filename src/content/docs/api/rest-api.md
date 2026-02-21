---
title: "REST API"
---


This document describes all REST API endpoints available in Rondo Club, including both WordPress standard endpoints and custom endpoints.

## Authentication

All API requests require authentication via WordPress session with REST nonce.

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
  "profile_url": "https://.../wp-admin/profile.php",
  "admin_url": "https://.../wp-admin/"
}
```

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

All invoice endpoints require the `financieel` capability.

---

**GET** `/rondo/v1/invoices`

List invoices with optional filters.

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `status` | string | (all) | Filter by status: `draft`, `sent`, `paid`, `overdue` |
| `person_id` | int | 0 | Filter by person |
| `type` | string | (all) | Filter by type: `membership`, `discipline` |
| `payment_plan` | string | (all) | Filter by plan: `full`, `quarterly_3`, `monthly_8` |

---

**GET** `/rondo/v1/invoices/{id}`

Get a single invoice with full details including line items, installment data, and person summary.

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

---

**POST** `/rondo/v1/invoices/{id}/resend`

Resend a previously sent invoice email.

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

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `season` | string | current | Season key (e.g., `2025-2026`) |

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
    "Voorzitter": ["admin"],
    "Penningmeester": ["financieel"],
    "Secretaris": ["admin"],
    "Wedstrijdsecretaris": ["wedstrijdzaken"]
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
    "Voorzitter": ["admin"],
    "Penningmeester": ["financieel"]
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

