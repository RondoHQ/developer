---
title: "User Provisioning"
description: "Creating WordPress user accounts from Rondo Club person records"
---

User provisioning allows administrators to create WordPress user accounts directly from person records, establishing a bidirectional link between the person and the WP user.

## Overview

When an administrator provisions a user account for a person:

1. A WordPress user is created with the **Rondo User** role
2. The person record is linked to the WP user (and vice versa)
3. The member's KNVB ID is stored on the WP user
4. A configurable welcome email can be sent with login instructions

## Person-User Linking

Provisioning creates a bidirectional link between person records and WordPress users:

| Storage | Meta Key | Value |
|---------|----------|-------|
| Person post meta | `_rondo_wp_user_id` | WordPress user ID |
| WP user meta | `rondo_linked_person_id` | Person post ID |
| WP user meta | `_rondo_knvb_id` | KNVB member ID |

This linking enables:
- Showing the linked user account on person detail pages (AccountCard component)
- Showing the linked person name in the WordPress users list
- Cross-referencing between member data and user accounts

## REST Endpoints

### Provision a User

**POST** `/rondo/v1/people/{person_id}/provision`

Creates a WordPress user account for the specified person and links them.

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

### Provisioning Settings

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

## API Response Fields

### Person Response

When retrieving a person via the REST API, provisioning-related fields are included:

| Field | Type | Description |
|-------|------|-------------|
| `linked_user_id` | int\|null | WordPress user ID linked to this person |
| `welcome_email_sent_at` | string\|null | ISO timestamp of when the welcome email was sent |

### Users List

The WordPress users list includes additional fields for linked persons:

| Field | Type | Description |
|-------|------|-------------|
| `linked_person_id` | int\|null | Person post ID linked to this user |
| `linked_person_name` | string\|null | Display name of the linked person |

## Welcome Email

The welcome email template is configurable in **Settings > Beheer > Welkomstmail** tab (WelkomstmailTab component).

**Available template variables:**

| Variable | Description |
|----------|-------------|
| `{{naam}}` | Person's full name |
| `{{voornaam}}` | Person's first name |
| `{{email}}` | Person's email address |
| `{{site_url}}` | URL of the Rondo Club site |

Administrators can also manually trigger or resend the welcome email from the AccountCard component on a person's detail page.

## UI Components

### AccountCard

The **AccountCard** component is displayed on person detail pages for administrators. It shows:

- Whether the person has a linked WordPress user account
- The linked user's email and role
- Button to provision a new account (if no linked user)
- Button to send/resend the welcome email
- Timestamp of when the welcome email was last sent

## Implementation

**Class:** `Rondo\Users\UserProvisioning`

| Method | Description |
|--------|-------------|
| `provision( $person_id )` | Create WP user and link to person |
| `send_welcome_email( $user_id )` | Send the welcome email to a provisioned user |
| `get_settings()` | Get current provisioning settings |
| `update_settings( $settings )` | Update provisioning settings |

## Related Documentation

- [Access Control](./access-control.md) - Roles and permissions
- [Multi-User System](./multi-user.md) - User management overview
- [People API](../api/people.md) - Person REST endpoints
- [REST API](../api/rest-api.md) - Full API reference
