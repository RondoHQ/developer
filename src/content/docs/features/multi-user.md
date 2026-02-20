---
title: "Multi-User System"
---


This document describes Rondo Club's multi-user setup, user management, and provisioning.

## Overview

Rondo Club uses a **shared access model**: all authenticated users can see and edit all data. This makes it ideal for teams collaborating on a shared contact database.

**Key features:**

- Multiple users can access the same Rondo Club installation
- All logged-in users see all contacts, teams, dates, and todos
- Users can be created manually by administrators or provisioned from person records
- User activity is tracked via post author and note author fields
- Person records and WordPress users are bidirectionally linked

## User Roles

### Rondo User Role

Rondo Club creates a custom WordPress role called **"Rondo User"** (`rondo_user`).

**Capabilities:**

- Create, edit, and delete people, teams, dates
- Upload files (photos, logos)
- Access the Rondo Club frontend

**Restrictions:**

- Cannot access WordPress admin settings
- Cannot manage other users
- Cannot install plugins or themes

### Administrator Access

WordPress administrators (`manage_options` capability):

- Full access in both frontend and WordPress admin
- Can manage other users
- Can provision new user accounts from person records

### Role-Based Access via Functies

Sportlink "functies" (club-level roles) can be mapped to Rondo permission roles via the [Functie-Capability Map](./access-control.md#functie-capability-map). This allows specific members to access features like financial settings without being full administrators.

## User Provisioning

Administrators can create WordPress user accounts directly from a person's detail page. This links the person record to a WP user account and optionally sends a welcome email.

See [User Provisioning](./user-provisioning.md) for full details.

**Key concepts:**

- **Bidirectional linking** - Person records store `_rondo_wp_user_id`, WP users store `rondo_linked_person_id`
- **AccountCard** - Admin-only UI component on person detail pages for managing the linked user account
- **Welcome email** - Configurable email template sent when provisioning a new user
- **KNVB ID** - Stored on the WP user as `_rondo_knvb_id` for cross-referencing

### Person-User Data in API Responses

**Person response** includes:

| Field | Type | Description |
|-------|------|-------------|
| `linked_user_id` | int\|null | WordPress user ID linked to this person |
| `welcome_email_sent_at` | string\|null | ISO timestamp of when welcome email was sent |

**Users list** includes:

| Field | Type | Description |
|-------|------|-------------|
| `linked_person_id` | int\|null | Person post ID linked to this user |
| `linked_person_name` | string\|null | Display name of the linked person |

## Collaborative Features

### Shared Data

All users share:

- **People** - All contact records
- **Teams** - All team/company records
- **Todos** - All todo items
- **Notes** - Shared notes on contacts (private notes remain private)

### Note Privacy

Notes can be marked as private or shared:

- **Shared notes** - Visible to all users viewing the contact
- **Private notes** - Only visible to the author

Toggle visibility when creating or editing a note.

### Activity Tracking

The system tracks:

- **Post author** - Who created a contact, team, or date
- **Note author** - Who wrote a note
- **Activity timestamps** - When changes were made

This information is visible in the UI for accountability.

## Daily Digest

The daily reminder email includes:

- Upcoming birthdays
- Overdue todos
- Recent activity on contacts (notes added in last 24 hours)

Configure digest delivery in **Settings > Notifications**.

## Related Documentation

- [Access Control](./access-control.md) - Permission system and functie-capability map
- [User Provisioning](./user-provisioning.md) - Creating user accounts from person records
- [Data Model](../data-model.md) - Post types and field definitions
- [REST API](../api/rest-api.md) - API endpoints
