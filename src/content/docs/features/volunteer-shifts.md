---
title: "Volunteer shifts (diensten)"
---

Diensten are the club's volunteer shifts: a bardienst on Saturday morning, a cleaning
round after a tournament, a stint on the terreinonderhoud crew. Members claim them
themselves at `/vrijwillig`; coordinators plan them, fill the gaps, and chase what is
left over.

## Data model

Four post types, in the order they feed each other:

| Post type | Purpose |
|---|---|
| `dienst_type` | Catalogue entry: kantine bar, schoonmaak, terreinonderhoud. Carries the rules — `vog_required`, `iva_required`, `required_pool`, `default_capacity`, colour, and the reminder/cancellation e-mail templates. |
| `shift_template` | A recurring rule: "every Saturday 07:30–12:00, kantine bar, capacity 2", bounded by `active_from` / `active_until`. |
| `dienst_shift` | A concrete shift in time. Either expanded from a template by cron, or created ad hoc. |
| `taakuitleg` | Instructions for a task, linked to one or more diensttypes. See [Taakuitleg](/features/taakuitleg/). |

A `dienst_shift` carries `dienst_type_id`, `template_id`, `capacity`, `start_datetime`,
`end_datetime`, `status` (`open` / `vol` / `voltooid` / `geannuleerd`), `notes` and
`iva_waived`.

### Assignments are meta, not an entity

There is no assignment post type. A shift's `assigned_persons` meta holds an array of
`person` post IDs, with per-person side meta alongside it:

| Meta key | Meaning |
|---|---|
| `_shift_signup_at_{person_id}` | When the assignment was made. Drives the 30-minute cancellation grace and the "recente aanmeldingen" overview. |
| `_shift_signup_user_{person_id}` | Which WordPress account made it — a parent using a child's account, for instance. |
| `_shift_assigned_by_{person_id}` | The coordinator who assigned this person, when it was not a self-signup. Survives cancellation. |
| `_shift_assigned_at_{person_id}` | When that assignment happened. |
| `_no_show_{person_id}` | No-show marker, set by an admin within the 72-hour window after the shift. |
| `_shift_customized` | The shift was edited by hand, so template re-rollout must never overwrite or delete it. |

Because `assigned_persons` is a single serialized value, every mutation runs inside
`MemberShifts::with_shift_write_lock()` — an `add_option()`-based lock. Two members
claiming the last spot at the same moment would otherwise overwrite each other.

## How shifts come into existence

`ShiftTemplateExpander` expands every active template into concrete shifts. It runs
nightly (`rondo_expand_shift_templates`), on template save, and on demand via
`POST /rondo/v1/shift-templates/expand` with an explicit `until` date.

Expansion runs **to the end of the season** — `SeasonKey` defines that as 1 July to
30 June — with a 93-day floor so a run in late June still produces a usable calendar
while next season's templates are being set up. It is idempotent: shifts are de-duped
on (`template_id`, `start_datetime`), so the nightly run creates almost nothing after
the first one.

Re-rolling a template (`rerun_template()`) deletes and regenerates its future shifts,
but preserves any that were customised, cancelled, or already have signups.

## Signup windows

The whole season is planned at once, but it does not all open at once — otherwise the
autumn fills with people who wanted a quiet spring dienst. `ShiftSignupWindow` decides:

- **First half** (July–December): open from the start of the season.
- **Second half** (January–June): opens on a club-configured month-day, default
  `11-01`, stored in `ClubConfig::OPTION_VOLUNTEER_SECOND_HALF_OPENS`. A month-day
  rather than a date, so it holds every season without an annual edit.
- **A future season**: closed outright until that season starts, including its autumn
  half — which would otherwise look open, because July–December always is.

The split itself is not configurable, and deliberately so: `SeasonKey` already puts the
boundary at 1 January by construction, and a second definition of "season half" could
drift from the obligation calculator that shares the same season.

Two properties worth preserving if you touch this:

1. **Closed shifts stay visible.** The window is not part of
   `member_shift_block_reason()`, whose callers all `continue` and thereby hide a
   shift. Members see spring diensten with a "vanaf 1 november" badge; a calendar day
   whose shifts are all closed gets the `locked` state rather than the red that means
   "sign up here".
2. **Coordinators are not gated.** Planning is not racing for a slot, so
   `add_assignee()` ignores the window entirely.

## Signing up

`POST /rondo/v1/shifts/{id}/signup` enforces, in order: active membership
(`VolunteerEligibilityService::may_volunteer()`), VOG validity, IVA validity unless the
shift sets `iva_waived`, pool membership when the diensttype names a `required_pool`,
the signup window, then — inside the lock — capacity and the shift's status.

An overlap with another assignment returns `409 overlap_warning` with `can_force: true`
rather than refusing outright; the member confirms and retries.

Members may cancel until 21 days before the shift, or within 30 minutes of signing up
(`CANCEL_DEADLINE_DAYS`, `CANCEL_GRACE_SECONDS`). After that only a coordinator can
remove them.

## Coordinators

Holders of the `vrijwilligers` capability manage the programme. Beyond the CPTs, they can:

| Endpoint | Purpose |
|---|---|
| `GET /rondo/v1/shifts/{id}/assignable-people?search=` | Candidates for this shift, with a `block_reason` on anyone who cannot take it. Blocked people are listed rather than filtered out — a coordinator who cannot find someone concludes the search is broken. |
| `POST /rondo/v1/shifts/{id}/assignees` | Put a person on the shift. All member-facing rules still apply; there is no certificate override. |
| `DELETE /rondo/v1/shifts/{id}/assignees/{person_id}` | Remove an assignee after the member deadline. |
| `POST /rondo/v1/shifts/{id}/cancellation` | Cancel the whole shift, with audited credit rules and notifications. |

An assignment made by a coordinator writes the same `_shift_signup_at_` timestamp a
self-signup would, so the member keeps their normal cancellation rights — nobody is
trapped in a dienst somebody else planned for them.

`assigned_persons` cannot be written through the generic REST route: it is REST-exposed,
but `prevent_direct_assignee_writes()` refuses any change to it, because that path skips
capacity, certificates, the write lock, the confirmation mail, the `vol` status flip,
and detaches template-managed shifts from their sjabloon.

## Notifications

`ShiftEmailScheduler` sends a batched confirmation ten minutes after signup (so three
quick claims produce one mail), with an iCal attachment; reminders at 14, 7 and 2 days;
cancellation notices; and a post-shift survey when the diensttype configures one.
Templates live on the `dienst_type`.

## Obligation credit

`VolunteerObligationCalculator` reads `assigned_persons` directly and does not care who
wrote it, so a coordinator-made assignment counts exactly like a self-signup. Any
mutation must call `VolunteerObligationCalculator::invalidate_cache()`.
