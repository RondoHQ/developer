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
| WP user meta | `rondo_contact_email` | The member's real email address |

This linking enables:
- Showing the linked user account on person detail pages (AccountCard component)
- Showing the linked person name in the WordPress users list
- Cross-referencing between member data and user accounts

If the forward link (`_rondo_wp_user_id`) is missing but the reverse link survives, `provision()`
adopts the existing account rather than creating a duplicate.

## Shared household mailboxes

Families share one email address, but WordPress enforces a unique `user_email`. So:

- The **first** member provisioned on an address keeps it as their `user_email`.
- **Later** members get an undeliverable placeholder, `person-{id}@members.rondo.invalid`.
  (`.invalid` is reserved by RFC 2606 and can never resolve.)
- **Every** provisioned user gets `rondo_contact_email` — the address mail must actually go to.

:::danger[Never `wp_mail()` to `user_email`]
Use `UserProvisioning::contact_email( $user_id )`. It returns the real address, falling back to
`user_email` for accounts created before this meta existed, and `null` when only a placeholder
remains.
:::

WordPress core does not know about the meta — `retrieve_password()` addresses the reset link
straight to `user_email`. `ContactEmailRouter` therefore hooks the `wp_mail` filter and rewrites any
synthetic recipient to the member's real address, **dropping** it when none is known. Fail closed: a
mail that cannot reach the right person must not reach the wrong one. Without this, every household
member after the first would have an unrecoverable account.

`is_synthetic_email()` tests for the placeholder domain.

Members who use Magic Login may not know the random password created during provisioning. The
profile therefore offers an authenticated `POST /rondo/v1/user/password-reset` action. It calls
WordPress core's `retrieve_password()` for the current user's exact username and only confirms that
the message was requested; the password can be changed only with the expiring key received by
email. The existing `ContactEmailRouter` ensures this also reaches later members of a household.

## Signing in

Members never see the username Rondo generated for them, and the second member of a household
cannot sign in with the family address — it belongs to the first claimant's account. `LoginResolver`
therefore accepts two extra identifiers and rewrites them to the real `user_login`:

| Identifier | Source | Resolves when |
|---|---|---|
| Username | `user_login` | Always (core) |
| Email | `user_email` | Always (core) |
| KNVB-ID | `_rondo_knvb_id` | Exactly one user matches |
| Contact address | `rondo_contact_email` | Exactly one user matches |

A shared family address matches several members, so it is **ambiguous** and the resolver refuses to
guess — picking one would be impersonation. Those members sign in with their KNVB-ID.

:::caution[The hook fires in `wp_signon()`, not `wp_authenticate()`]
`LoginResolver` hooks the `wp_authenticate` **action**, which passes `$username` by reference so
core still performs the password check and every security filter hanging off `authenticate`. That
action fires inside `wp_signon()` — what `wp-login.php` calls. A test that drives
`wp_authenticate()` directly exercises nothing and passes for the wrong reason.
:::

## Who can be provisioned

`GET /rondo/v1/users/provisionable` requires only that the person is published, is not a
`former_member`, has no account yet, and has a valid `email_1` or `email_2`.

It deliberately does **not** require a `knvb-id`. The parents who carry the ouderplicht are not
Sportlink members and have none — requiring it hid 269 of them from the picker.

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

The welcome email template is configurable under **Settings > Beheer > E-mails > Account aanmaken** (`WelkomstmailTab` component).

The stored template body is plain text with placeholders. `Rondo\Users\UserProvisioning` resolves those placeholders first and then renders the message inside the shared `Rondo\Notifications\EmailTemplate` HTML layout, including a primary CTA button for the password-set link.

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
