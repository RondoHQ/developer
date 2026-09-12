---
title: "Training schedules API"
---

Base path: `/wp-json/rondo/v1/training`.

## Permissions and caching

Schedule read endpoints (`GET /schedules`, `GET /schedules/{id}`, and `GET /active`) are always public,
including when the `training` feature toggle is `admin_only` or `off`. They need no login, nonce,
or application password and can be opened directly in a browser or used by the club website.
All saved versions are available, including inactive versions.

Settings and management operations require the `manage_options` capability and remain feature-gated:
`off` denies management access even to administrators; `admin_only` and `on` allow administrators.
Authenticate for these operations using a WordPress session with REST nonce, or an administrator's
application password over HTTPS. The Rondo interface continues to obey the feature toggle.

Responses use `Cache-Control: no-store, private`; consumers that cache must arrange their own refresh
after changes. No calendar dates, personal contact details, or authentication tokens appear in the feed.

## Read endpoints

| Method and path | Response |
|---|---|
| `GET /schedules` | `{active_id, timezone, pitches, schedules}` with **all complete saved versions**. |
| `GET /schedules/{id}` | `{active_id, timezone, pitches, schedule}` for the immutable numeric identifier. |
| `GET /active` | `{timezone, pitches, schedule}`; `schedule` is `null` until a version is activated. |
| `GET /settings` | Admin only: `{settings, teams}` with team directory entries `{id, name}`. |

`pitches` contains `{id, name}` entries. A schedule has this shape:

```json
{
  "id": 12345,
  "name": "Slecht weer",
  "season": "2026/27",
  "revision": 3,
  "blocks": [
    {
      "block_id": "a1743249-90f3-497f-bcdd-994367c57753",
      "label": "",
      "team_ids": [1001, 1002],
      "team_names": ["O13-1", "O13-2"],
      "age_group_id": "",
      "color": "#b3de69",
      "pitch_id": "veld-2",
      "day": 1,
      "start": "18:00",
      "duration": 75,
      "size": 2,
      "offset": 0
    }
  ]
}
```

`day` is ISO weekday 1–7 (Monday–Sunday). `start` is local `HH:mm` in the returned site timezone;
`duration` is 15–360 minutes in multiples of 15. Blocks must end on the same day, at or before 24:00.
`size` is **0.5, 1, 2, 3, or 4 quarters** (eighth, quarter, half, three-quarter, full pitch).
The unit remains quarters for compatibility with existing schedules. `offset` is zero-based and aligned to the allocation: A=0, B=1, C=2, D=3;
halves use 0 (AB) or 2 (CD), three-quarter pitches use 0 (ABC) or 1 (BCD), and a whole pitch uses 0.
Eighth pitches use offsets 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5 (A1, A2, B1, B2, C1, C2, D1, D2). A standalone block has empty `team_ids` and
a nonempty `label`. Multiple team IDs in one block mean those teams deliberately train together.

The schedule ID survives renaming and changing its season. Copying creates a new schedule ID;
block IDs are unique within a version and may be retained by the copy. `team_names` and `color` are read-only convenience data; omit both from writes.
`color` is derived from the first linked team with an age-group assignment, or the explicitly selected
`age_group_id` on the block. Use an empty or omitted `age_group_id` to inherit from teams. This lets
standalone blocks, such as keeper training, select a configured group color too. Missing colors default
to `#cffafe`. Updating a group color affects every version immediately; render with contrasting text.

## Management endpoints

Send JSON with the content type `application/json`.

| Method and path | Body / effect |
|---|---|
| `POST /schedules` | `{name, season, revision: 0, blocks: []}` creates an inactive version. |
| `PUT /schedules/{id}` | `{name, season, revision, blocks}` replaces one entire version after validation. |
| `POST /schedules/{id}/copy` | `{name}` copies the current saved version, retaining its season and blocks. |
| `POST /schedules/{id}/activate` | `{revision}` selects the version for team pages. |
| `DELETE /schedules/{id}` | `{revision}` moves an inactive version to WordPress trash. |
| `PUT /settings` | Complete settings document described below. |

A successful schedule write returns the saved schedule with the new revision. Submit that revision
on the next change. Unknown fields, invalid team references, and invalid times receive HTTP 400.
Unknown or trashed version IDs receive HTTP 404. Resource conflicts, stale revisions, attempts to
delete the active version, and removal of a referenced pitch receive HTTP 409.

An overlap response uses `rondo_training_conflict` and includes both offending IDs in
`data.block_ids`. Validation finishes before changing the version, so rejected moves preserve the
previous schedule.

## Settings document

```json
{
  "revision": 0,
  "pitches": [{"id": "veld-2", "name": "Veld 2"}],
  "age_groups": [{"id": "o13", "name": "O13", "duration": 75, "size": 2, "color": "#b3de69"}],
  "teams": [{"team_id": 1001, "age_group_id": "o13", "duration": 90, "size": null}]
}
```

IDs for pitches, age groups, and blocks are strings of 1–64 letters, digits, underscores, or hyphens.
Pitch and age-group IDs must be unique within their respective lists. Each team may have one override
entry; its age group must exist (or be the empty string). `null` duration or size inherits the age-group
default. Names may contain at most 100 characters, season labels 30. A settings list is limited to
500 entries and a version to 1000 blocks. The response is the saved settings with its incremented revision.

Age-group `color` accepts a six-digit hex value (`#RRGGBB`), normalized to lowercase. Omitted colors
default to `#cffafe`. A group explicitly referenced by a saved block cannot be removed (HTTP 409).
