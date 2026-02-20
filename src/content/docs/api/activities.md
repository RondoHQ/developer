---
title: "Activities API"
---

Activities track interactions with people (calls, meetings, emails, etc.). They are stored as WordPress comments with type `rondo_activity` and exposed through custom REST endpoints.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/rondo/v1/people/{person_id}/activities` | List activities for a person |
| POST | `/rondo/v1/people/{person_id}/activities` | Create an activity |
| PUT | `/rondo/v1/activities/{id}` | Update an activity |
| DELETE | `/rondo/v1/activities/{id}` | Delete an activity |

---

## Activity Types

| Type | Label |
|------|-------|
| `email` | Email |
| `chat` | Chat |
| `call` | Telefoon |
| `video` | Videogesprek |
| `meeting` | Vergadering |
| `coffee` | Koffie |
| `lunch` | Lunch |
| `dinner` | Diner |
| `note` | Overig |

---

## List Activities

**GET** `/rondo/v1/people/{person_id}/activities`

Returns all activities for a person, sorted by creation date (newest first).

**Permission:** User must have access to the person.

**Response:**
```json
[
  {
    "id": 123,
    "type": "activity",
    "content": "<p>Discussed membership renewal</p>",
    "person_id": 789,
    "author_id": 1,
    "author": "Jan de Vries",
    "created": "2026-02-12 14:30:00",
    "modified": "2026-02-12 14:30:00",
    "activity_type": "call",
    "activity_date": "2026-02-12",
    "activity_time": "14:30",
    "participants": [456, 789]
  }
]
```

---

## Create Activity

**POST** `/rondo/v1/people/{person_id}/activities`

**Permission:** User must have access to the person.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `content` | string | Yes | Activity description. Safe HTML allowed (bold, italic, links, lists). |
| `activity_type` | string | No | One of the activity types listed above. |
| `activity_date` | string | No | Date in `YYYY-MM-DD` format. |
| `activity_time` | string | No | Time in `HH:MM` format. |
| `participants` | int[] | No | Array of person IDs involved in the activity. |

**Example request:**
```json
{
  "content": "Besproken dat lidmaatschap verlengd wordt voor volgend seizoen.",
  "activity_type": "call",
  "activity_date": "2026-02-12",
  "activity_time": "14:30",
  "participants": [456]
}
```

**Response:** The created activity object (same format as list response).

**Errors:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `empty_content` | Content field is required and cannot be empty. |
| 500 | `create_failed` | Failed to insert the activity into the database. |

---

## Update Activity

**PUT** `/rondo/v1/activities/{id}`

**Permission:** User must own the activity or be an administrator.

**Parameters:** Same as create. All fields are optional — only provided fields are updated.

**Example request:**
```json
{
  "content": "Updated description of the call.",
  "activity_type": "meeting"
}
```

**Response:** The updated activity object.

---

## Delete Activity

**DELETE** `/rondo/v1/activities/{id}`

**Permission:** User must own the activity or be an administrator.

**Response:**
```json
{
  "deleted": true
}
```

---

## Activity Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Unique activity ID. |
| `type` | string | Always `"activity"`. |
| `content` | string | HTML content with rendered @mentions and clickable links. |
| `person_id` | int | ID of the person this activity belongs to. |
| `author_id` | int | User ID of the creator. |
| `author` | string | Display name of the creator. |
| `created` | string | Creation timestamp (`YYYY-MM-DD HH:MM:SS`). |
| `modified` | string | Modification timestamp. |
| `activity_type` | string | Type of activity (see table above). |
| `activity_date` | string | Date of the activity (`YYYY-MM-DD`), or empty string. |
| `activity_time` | string | Time of the activity (`HH:MM`), or empty string. |
| `participants` | int[] | Array of person IDs, or empty array. |

---

## Automated Activity Creation

Activities can be created automatically by external integrations:

- **FreeScout conversations** - The [FreeScout pipeline](../sync/pipeline-freescout.md) downloads helpdesk conversations and creates activities on the matching person records. This provides a unified timeline of member interactions without manual data entry.

---

## Timeline Integration

Activities also appear in the combined timeline endpoint:

**GET** `/rondo/v1/people/{person_id}/timeline`

This returns activities alongside notes, emails, and todos, sorted by date descending. Each item includes a `type` field to distinguish between them.
