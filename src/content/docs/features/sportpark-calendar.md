---
title: "Sportpark calendar"
---

The **Bestuur → Sportparkkalender** page lets users with the `rondo_bestuur` role and administrators (`manage_options`) maintain whole-day sportpark closures. `UserRoles::can_access_board()` is shared by every calendar REST permission callback and the `can_access_bestuur` flag returned by `/rondo/v1/user/me`. The frontend gates both navigation and direct routes on this flag.

## Storage and dates

`rondo_park_closure` is a private, non-REST-exposed WordPress post type. Title and nullable description use native post columns; `created_by`, `created_at` and `updated_at` derive from the post author and UTC timestamps. Updates preserve the author. `starts_at` and `ends_at` are registered native date fields, compact `Ymd` in post metadata and `YYYY-MM-DD` in REST. Both dates are inclusive, interpreted in the club timezone. Overlapping periods are allowed; removing one never opens a day still covered by another. Deletion uses the WordPress trash.

## API

All routes require board or administrator access:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/rondo/v1/sportpark/closures?year=2032` | All periods overlapping that year |
| POST | `/rondo/v1/sportpark/closures` | Create a period |
| GET | `/rondo/v1/sportpark/closures/{id}` | Read a period |
| PUT / PATCH | `/rondo/v1/sportpark/closures/{id}` | Partially update a period |
| DELETE | `/rondo/v1/sportpark/closures/{id}` | Trash a period |

Writes accept `title`, nullable `description`, and partial canonical dates under `fields`. Invalid dates, reversed intervals and unknown domain fields return HTTP 400. Author and audit timestamps are server-owned.

If any published or draft, non-cancelled shift overlaps the period, the write returns HTTP 409 `closure_conflicts` without saving. The response contains `data.conflicts` (including titles, dates, assignee counts and `can_cancel`) and `data.conflict_token`. The client must resubmit with `existing_tasks: "keep"` or `"cancel"` and that token. Changed dates, task status or task counts require a refreshed confirmation.

Cancellation uses the existing locked `MemberShifts::cancel_shift()` flow, retaining assignments and cancellation/credit audit metadata and sending the standard notifications. Completed or already-started shifts cannot be cancelled and are marked as preserved before confirmation. A saved response returns `closure`, `cancelled`, `failed`, and `notification_warnings`; the UI reports partial failures explicitly. Unreachable recipients are reported without exposing contact details. Manual tasks are included in the review but remain untouched when the user chooses keep.

## Automatic expansion

`ShiftTemplateExpander::expand_template()` loads overlapping closures once per template and skips every closed date. Cron, template-save expansion, manual rollout and rerun all use this method. Closure writes and template expansion share a native option lock; busy expansion returns zero so a later run can retry. Locks older than five minutes recover after a crashed request, matching the existing training-lock convention.

Manual shift or activity creation is not blocked. Deleting a closure allows later template expansion to fill missing dates; it never reopens previously cancelled shifts. The existing template/start-time deduplication preserves cancelled records.

## Verification

`SportparkClosuresTest` covers all endpoint permissions, CRUD, native field storage, leap days, inclusive and overlapping periods, year boundaries, stale conflict confirmation, cancellation history and notifications, overnight shifts, manual shifts and template skipping. JavaScript calendar tests cover Monday-first layout, leap days and highlighting overlapping periods.
