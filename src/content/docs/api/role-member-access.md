---
title: "Role member access"
---

`GET /rondo/v1/settings/age-group-access` and `POST /rondo/v1/settings/age-group-access` require `manage_options`.

The response contains `roles` (role slug → age-group strings), `available_age_groups`, `team_roles` (role slug → team IDs) and `available_teams` (published teams as `{ id, name }`).

```json
{
  "roles": { "rondo_coordinator-o13": ["Onder 13"] },
  "team_roles": { "rondo_coordinator-o13": [123, 456] }
}
```

The IDs and role slug above are illustrative. Submit existing Rondo role slugs and positive integer IDs of published `team` posts. Invalid team references return HTTP 400 before either access configuration is saved. Duplicate IDs are removed. Selections on management or isolated Kaderlijst roles do not grant team access.

Each submitted map replaces the stored map. Omit `team_roles` to preserve existing team configuration for legacy clients; submit an empty map to clear it. The existing `roles` parameter is required. An empty role selection grants no additional person access.

Team membership and age-group matching are combined with OR. The result determines which people may be read, not which fields or writes are permitted. Configure role capabilities separately through the existing capability matrix.
