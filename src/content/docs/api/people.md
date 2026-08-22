---
title: "Leden (People) API Documentation"
---


This document describes how to use the Rondo Club REST API to add and update "leden" (people/contacts).

## Base URL

All endpoints are relative to your WordPress installation:
```
https://your-site.com/wp-json/
```

## Authentication

The API supports two authentication methods:

### Method 1: Application Password (Recommended for External Integrations)

Use HTTP Basic Authentication with a WordPress Application Password. This is the recommended method for scripts, external services, and API integrations.

1. Generate an Application Password in WordPress: **Users → Profile → Application Passwords**
2. Use your WordPress username and the generated password (with spaces)

```bash
curl -X GET "https://your-site.com/wp-json/wp/v2/people" \
  -u "username:xxxx xxxx xxxx xxxx xxxx xxxx"
```

Or with the `Authorization` header:

```bash
curl -X GET "https://your-site.com/wp-json/wp/v2/people" \
  -H "Authorization: Basic $(echo -n 'username:xxxx xxxx xxxx xxxx xxxx xxxx' | base64)"
```

### Method 2: Session + Nonce (Browser Use)

For requests from the Rondo Club frontend (same browser session), use the REST nonce:

```
X-WP-Nonce: {nonce_value}
```

The nonce is available in `window.rondoConfig.nonce` when logged in to Rondo Club.

### Remote Utility Script

For fast remote operations from your terminal, use:

```bash
bin/person-values.sh find --query "jan"
bin/person-values.sh get --id 123 --field first_name
bin/person-values.sh set --id 123 --field former_member --value true --type boolean
```

The script uses these `.env` variables:
- `RONDO_API_URL`
- `RONDO_API_USER`
- `RONDO_API_PASSWORD`

It updates people via REST only (no WP-CLI dependency) and supports `fields`, `acf`, and `meta` sources (`--source auto` by default).

---

**Access Control:** Users can only see and modify people they created themselves. Sharing and workspace visibility can extend access to other users.

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/wp/v2/people` | List all accessible people |
| `GET` | `/wp/v2/people/{id}` | Get single person |
| `POST` | `/wp/v2/people` | Create new person |
| `PUT` | `/wp/v2/people/{id}` | Update person |
| `DELETE` | `/wp/v2/people/{id}` | Delete person |
| `GET` | `/rondo/v1/people/filtered` | Paginated people list with server-side name filtering and sorting |
| `POST` | `/rondo/v1/people/bulk-update` | Update multiple people |
| `POST` | `/rondo/v1/people/{id}/photo` | Upload profile photo |
| `POST` | `/rondo/v1/people/{id}/provision` | Provision WordPress user account (admin only) |
| `GET` | `/rondo/v1/people/{primary_id}/merge-preview?duplicate_id={id}` | Preview a person merge (admin only) |
| `POST` | `/rondo/v1/people/{primary_id}/merge` | Merge a duplicate person into the primary record (admin only) |
| `GET` | `/rondo/v1/people/{id}/merge-target` | Resolve a merged source ID to its published survivor (admin/integration only) |

---

## Name fields in list responses

Person summaries keep `name` as a backwards-compatible full display name and also expose the canonical parts `first_name`, `infix`, and `last_name`. List interfaces should render two data columns:

- **Voornaam:** `first_name`
- **Achternaam:** the displayed value is `infix` plus `last_name`

Sort surname columns by `last_name`, not by the combined display value. This keeps a name such as `de Valk` under V rather than D. Use `first_name` as the secondary sort for equal surnames.

`GET /rondo/v1/people/filtered` accepts `first_name` and `last_name` text filters. The `last_name` filter matches the displayed surname, including the infix. Both `first_name` and `last_name` are valid `orderby` values.

Deceased people are excluded from this endpoint by default, including CSV exports built from it.
Pass `include_deceased=1` to include them; this automatically includes former members as well.
Summary records expose a read-only `is_deceased` boolean. The standard single-person REST response
also exposes `is_deceased`, computed from `fields.datum_overlijden`.

---

## Merge People

Only administrators can preview or execute a merge. The primary person remains published; the duplicate is moved to the WordPress trash with `_rondo_merged_into_person_id`, `_rondo_merged_at`, and `_rondo_merged_by` audit metadata.

### Preview

```http
GET /rondo/v1/people/209/merge-preview?duplicate_id=8010
```

The response contains both person summaries, automatically combined fields, scalar conflicts that require a choice, blocking conflicts, and counts of linked domain records. Different non-empty stable identifiers of the same kind, or two different linked WordPress accounts, block execution.

### Execute

```http
POST /rondo/v1/people/209/merge
Content-Type: application/json
X-WP-Nonce: {nonce}
```

```json
{
  "duplicate_id": 8010,
  "resolutions": {
    "nickname": "primary",
    "company_name": "duplicate"
  },
  "confirmed": true
}
```

Every conflict returned by the preview must have a `primary` or `duplicate` resolution. The service automatically combines unique emails, phones, addresses, relationships, work history, gallery/list values, person and sponsor roles, and empty scalar fields.

References in relationships, shifts, todos, discipline cases, invoices, clothing assignments, comments, attachments, and linked user accounts are moved to the primary person. Per-person shift metadata is renamed as part of the same operation. A successful merge returns the surviving `person_id`.

### Resolve a previous person ID

Trusted integrations that persist WordPress person IDs can resolve an ID that was merged away:

```http
GET /rondo/v1/people/8010/merge-target
```

```json
{
  "person_id": 8010,
  "merged_into_person_id": 209
}
```

The endpoint follows successive merge audit links until it finds the current published person. It returns `404` when the ID has not been merged or no published survivor exists. `rondo-sync` uses this response to repair its local Sportlink-to-WordPress mapping instead of recreating the duplicate.

---

## Field Reference

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `acf.first_name` | string | Person's first name (required for auto-title generation) |

### Basic Information

| Field | Type | Description | Values/Format |
|-------|------|-------------|---------------|
| `acf.first_name` | string | First name | Any string |
| `acf.infix` | string | Tussenvoegsel (e.g., van, de, van der) | Any string. Read-only in UI, synced from Sportlink |
| `acf.last_name` | string | Last name | Any string |
| `acf.nickname` | string | Nickname | Any string |
| `acf.gender` | string | Gender | `male`, `female`, `non_binary`, `other`, `prefer_not_to_say` |
| `acf.pronouns` | string | Pronouns | e.g., "hij/hem", "zij/haar" |
| `acf.birthdate` | string | Birthdate | `Y-m-d` format (e.g., "1982-02-06"). Read-only in UI, synced from Sportlink |
| `fields.datum_overlijden` | string/null | Date of death | `Y-m-d` format. Synced from Sportlink's inactive-member data |

### Membership Status

| Field | Type | Description | Values |
|-------|------|-------------|--------|
| `acf.former_member` | boolean | Whether the person is a former member (oud-lid) | `true`, `false` (default) |

**Note:** This field is managed by rondo-sync. When a member is no longer found in Sportlink data, they are automatically marked as a former member. The field defaults to `false` for all new and active members.

When `datum_overlijden` is set, the person remains available as a read-only historical record.
Rondo keeps the stored contact data, but central communication policy returns no recipient address
for invoices, reminders, onboarding, VOG, IVA, shifts, account provisioning, and manual person-mail
actions. Volunteer eligibility also treats the person as inactive.

### Contact Information

Contact info is stored as a repeater field with multiple entries:

```json
"acf": {
  "contact_info": [
    {
      "contact_type": "email",
      "contact_label": "Werk",
      "contact_value": "jan@bedrijf.nl"
    },
    {
      "contact_type": "mobile",
      "contact_label": "Privé",
      "contact_value": "+31612345678"
    }
  ]
}
```

**Contact Types:**
- `email` - E-mailadres
- `email2` - Tweede e-mailadres (Sportlink `Email2`)
- `phone` - Telefoon (vast)
- `mobile` - Mobiel
- `website` - Website
- `linkedin` - LinkedIn
- `twitter` - Twitter/X
- `bluesky` - Bluesky
- `threads` - Threads
- `instagram` - Instagram
- `facebook` - Facebook
- `calendar` - Agenda link
- `other` - Anders

For Sportlink sync, a second mobile or landline number is stored as an additional `mobile`/`phone` row with `contact_label: "2"`.

### Addresses

Addresses are stored as a repeater field:

```json
"acf": {
  "addresses": [
    {
      "address_label": "Thuis",
      "street": "Hoofdstraat 123",
      "postal_code": "1234 AB",
      "city": "Amsterdam",
      "state": "Noord-Holland",
      "country": "Nederland"
    }
  ]
}
```

### Team History

Link people to teams with their role history:

```json
"acf": {
  "work_history": [
    {
      "team": 42,
      "job_title": "Aanvoerder",
      "description": "Aanvoerder van het eerste elftal",
      "start_date": "2020-08-01",
      "end_date": "",
      "is_current": true
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `team` | integer | Team post ID |
| `job_title` | string | Position/role title |
| `description` | string | Role description |
| `start_date` | string | Start date (Y-m-d) |
| `end_date` | string | End date (Y-m-d), empty if current |
| `is_current` | boolean | Currently in this role |

### Relationships

Link people to other people:

```json
"acf": {
  "relationships": [
    {
      "related_person": 123,
      "relationship_type": 5,
      "relationship_label": ""
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `related_person` | integer | Related person post ID |
| `relationship_type` | integer | Relationship type taxonomy term ID |
| `relationship_label` | string | Custom label override |

### User Linking (Read-Only)

These fields relate to the [user provisioning](../features/user-provisioning.md) system. They are included in the API response when a person has a linked WordPress user account.

| Field | Type | Description |
|-------|------|-------------|
| `linked_user_id` | int\|null | WordPress user ID linked to this person |
| `welcome_email_sent_at` | string\|null | ISO timestamp of when the welcome email was sent |

### Computed Fields (Read-Only)

These fields are automatically calculated and should not be set manually. They are included in the API response but ignored on create/update.

| Field | Type | Description | Values |
|-------|------|-------------|--------|
| `acf.huidig-vrijwilliger` | string | Current volunteer status, auto-calculated from work history | `"1"` (volunteer) or `"0"` (not) |
| `acf.is_deceased` | boolean | Whether the person is deceased | `true`, `false` |
| `acf.birth_year` | string/null | Birth year (derived from birthdate field) | e.g., `"1990"` or `null` |

**Volunteer status logic:** A person is considered a current volunteer (`huidig-vrijwilliger = "1"`) if they have an active position where:
- The position is in a commissie (any role, unless the commissie is exempt), OR
- The position is in a team with a staff role (not a player role like Aanvaller, Keeper, etc.)

Positions with honorary/membership roles (Donateur, Erelid, etc.) are excluded. The status is recalculated automatically whenever the person is saved.

### Visibility

| Field | Type | Description | Values |
|-------|------|-------------|--------|
| `acf._visibility` | string | Who can see this person | `private`, `workspace`, `shared` |
| `acf._assigned_workspaces` | array | Workspace term IDs | `[1, 2, 3]` |

---

## Create a Person

**Request:**
```http
POST /wp/v2/people
Content-Type: application/json
X-WP-Nonce: {nonce}
```

**Body:**
```json
{
  "status": "publish",
  "acf": {
    "first_name": "Jan",
    "last_name": "de Vries",
    "gender": "male",
    "contact_info": [
      {
        "contact_type": "email",
        "contact_label": "Werk",
        "contact_value": "jan.devries@example.nl"
      },
      {
        "contact_type": "mobile",
        "contact_label": "Privé",
        "contact_value": "+31612345678"
      }
    ],
    "addresses": [
      {
        "address_label": "Thuis",
        "street": "Sportlaan 45",
        "postal_code": "1234 AB",
        "city": "Amsterdam",
        "country": "Nederland"
      }
    ],
    "_visibility": "private"
  }
}
```

**Response (201 Created):**
```json
{
  "id": 456,
  "date": "2026-01-25T14:30:00",
  "slug": "jan-de-vries",
  "status": "publish",
  "type": "person",
  "title": {
    "rendered": "Jan de Vries"
  },
  "author": 1,
  "acf": {
    "first_name": "Jan",
    "infix": "",
    "last_name": "de Vries",
    "gender": "male",
    "birthdate": "",
    "former_member": false,
    "contact_info": [...],
    "addresses": [...],
    "work_history": [],
    "relationships": [],
    "huidig-vrijwilliger": "0",
    "is_deceased": false,
    "birth_year": null,
    "_visibility": "private"
  }
}
```

**Note:** The `title` is automatically generated from `first_name`, `infix`, and `last_name`. You don't need to set it manually.

---

## Update a Person

**Request:**
```http
PUT /wp/v2/people/456
Content-Type: application/json
X-WP-Nonce: {nonce}
```

**Body (partial update):**
```json
{
  "acf": {
    "contact_info": [
      {
        "contact_type": "email",
        "contact_label": "Werk",
        "contact_value": "jan@nieuwbedrijf.nl"
      },
      {
        "contact_type": "mobile",
        "contact_label": "Privé",
        "contact_value": "+31612345678"
      }
    ]
  }
}
```

**Important:** When updating repeater fields (contact_info, addresses, work_history, relationships), you must send the complete array. Partial updates will replace the entire field.

**Response (200 OK):**
Returns the full updated person object.

**Example - Mark a member as former (used by rondo-sync):**
```bash
curl -X PUT "https://your-site.com/wp-json/wp/v2/people/456" \
  -u "username:xxxx xxxx xxxx xxxx xxxx xxxx" \
  -H "Content-Type: application/json" \
  -d '{"acf": {"former_member": true}}'
```

---

## Get a Person

**Request:**
```http
GET /wp/v2/people/456
X-WP-Nonce: {nonce}
```

**Response:**
```json
{
  "id": 456,
  "title": { "rendered": "Jan de Vries" },
  "acf": {
    "first_name": "Jan",
    "infix": "",
    "last_name": "de Vries",
    "nickname": "",
    "gender": "male",
    "pronouns": "",
    "birthdate": "",
    "former_member": false,
    "photo_gallery": [],
    "contact_info": [...],
    "addresses": [...],
    "work_history": [],
    "relationships": [],
    "huidig-vrijwilliger": "0",
    "is_deceased": false,
    "birth_year": null,
    "_visibility": "private",
    "_assigned_workspaces": []
  }
}
```

---

## List People

**Request:**
```http
GET /wp/v2/people?per_page=20&page=1
X-WP-Nonce: {nonce}
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `per_page` | int | 10 | Items per page (max: 100) |
| `page` | int | 1 | Page number |
| `search` | string | - | Search in name |
| `orderby` | string | date | Sort by: `date`, `title`, `modified` |
| `order` | string | desc | Sort order: `asc` or `desc` |
| `_fields` | string | - | Limit fields returned (comma-separated) |

**Example - Search for people named "Jan":**
```http
GET /wp/v2/people?search=Jan&per_page=50
```

**Example - Get only IDs and names (faster):**
```http
GET /wp/v2/people?_fields=id,title,acf.first_name,acf.last_name
```

---

## Delete a Person

**Request:**
```http
DELETE /wp/v2/people/456
X-WP-Nonce: {nonce}
```

**Response (200 OK):**
```json
{
  "deleted": true,
  "previous": { ... }
}
```

---

## Bulk Update People

Update multiple people at once (e.g., assign to workspace, add labels).

**Request:**
```http
POST /rondo/v1/people/bulk-update
Content-Type: application/json
X-WP-Nonce: {nonce}
```

**Body:**
```json
{
  "ids": [456, 457, 458],
  "updates": {
    "visibility": "workspace",
    "assigned_workspaces": [5],
    "organization_id": 42
  }
}
```

**Available bulk updates:**

| Field | Type | Description |
|-------|------|-------------|
| `visibility` | string | Set visibility for all |
| `assigned_workspaces` | array | Set workspace IDs |
| `organization_id` | int | Set team association |

**Response:**
```json
{
  "success": true,
  "updated": [456, 457, 458],
  "failed": []
}
```

---

## Upload Profile Photo

**Request:**
```http
POST /rondo/v1/people/456/photo
Content-Type: multipart/form-data
X-WP-Nonce: {nonce}
```

**Form Data:**
- `file`: Image file (JPEG, PNG, GIF, WebP)

**Response:**
```json
{
  "success": true,
  "attachment_id": 789,
  "filename": "jan-de-vries.jpg",
  "thumbnail_url": "https://your-site.com/wp-content/uploads/2026/01/jan-de-vries-150x150.jpg",
  "full_url": "https://your-site.com/wp-content/uploads/2026/01/jan-de-vries.jpg"
}
```

---

## Error Handling

**Common Error Responses:**

**401 Unauthorized:**
```json
{
  "code": "rest_not_logged_in",
  "message": "You are not currently logged in.",
  "data": { "status": 401 }
}
```

**403 Forbidden:**
```json
{
  "code": "rest_forbidden",
  "message": "Sorry, you are not allowed to edit this person.",
  "data": { "status": 403 }
}
```

**404 Not Found:**
```json
{
  "code": "rest_post_invalid_id",
  "message": "Invalid person ID.",
  "data": { "status": 404 }
}
```

**400 Bad Request (validation error):**
```json
{
  "code": "rest_invalid_param",
  "message": "Invalid parameter(s): acf",
  "data": { "status": 400 }
}
```

---

## Code Examples

### JavaScript/TypeScript (fetch)

```javascript
const API_BASE = 'https://your-site.com/wp-json';
const nonce = window.rondoConfig?.nonce || 'your-nonce';

// Create a person
async function createPerson(data) {
  const response = await fetch(`${API_BASE}/wp/v2/people`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': nonce,
    },
    credentials: 'include',
    body: JSON.stringify({
      status: 'publish',
      acf: data,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

// Update a person
async function updatePerson(id, data) {
  const response = await fetch(`${API_BASE}/wp/v2/people/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': nonce,
    },
    credentials: 'include',
    body: JSON.stringify({ acf: data }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

// Usage
const newPerson = await createPerson({
  first_name: 'Jan',
  last_name: 'de Vries',
  gender: 'male',
  contact_info: [
    { contact_type: 'email', contact_label: 'Werk', contact_value: 'jan@example.nl' }
  ],
});

console.log('Created person:', newPerson.id);
```

### PHP (WordPress context)

```php
<?php
// Create a person programmatically
$person_id = wp_insert_post([
    'post_type'   => 'person',
    'post_status' => 'publish',
    'post_author' => get_current_user_id(),
]);

if ($person_id && !is_wp_error($person_id)) {
    // Set ACF fields
    update_field('first_name', 'Jan', $person_id);
    update_field('last_name', 'de Vries', $person_id);
    update_field('gender', 'male', $person_id);

    // Set contact info (repeater)
    update_field('contact_info', [
        [
            'contact_type'  => 'email',
            'contact_label' => 'Werk',
            'contact_value' => 'jan@example.nl',
        ],
    ], $person_id);
}

// Update a person
update_field('nickname', 'Jan-Jan', $person_id);
```

### cURL (with Application Password)

```bash
# Create a person
curl -X POST "https://your-site.com/wp-json/wp/v2/people" \
  -u "username:xxxx xxxx xxxx xxxx xxxx xxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "publish",
    "acf": {
      "first_name": "Jan",
      "last_name": "de Vries",
      "gender": "male"
    }
  }'

# Update a person (change name)
curl -X PUT "https://your-site.com/wp-json/wp/v2/people/456" \
  -u "username:xxxx xxxx xxxx xxxx xxxx xxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "acf": {
      "first_name": "Johannes"
    }
  }'

# List people
curl -X GET "https://your-site.com/wp-json/wp/v2/people?per_page=10" \
  -u "username:xxxx xxxx xxxx xxxx xxxx xxxx"

# Delete a person
curl -X DELETE "https://your-site.com/wp-json/wp/v2/people/456" \
  -u "username:xxxx xxxx xxxx xxxx xxxx xxxx"
```

---

## Notes

1. **Auto-generated Title:** The post title is automatically created from `first_name + infix + last_name` (e.g., "Jan van de Berg"). You don't need to set it.

2. **Repeater Fields:** When updating `contact_info`, `addresses`, `work_history`, or `relationships`, always send the complete array. WordPress will replace the entire field.

3. **Access Control:** Each user only sees people they created. Use visibility settings and sharing to extend access.

4. **Authentication Choice:**
   - **Application Passwords:** Best for external scripts, integrations, and automation. No expiration, revocable per-app.
   - **Nonces:** Best for browser-based requests. Expire after 24 hours.

5. **Rate Limiting:** There's no built-in rate limiting, but be mindful of server resources when making bulk requests.

---

*Documentation generated: 2026-01-25*
