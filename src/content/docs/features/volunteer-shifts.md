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

`open` is both the registered default and the value submitted by the ad-hoc shift form.
The native field layer materializes an explicitly submitted scalar default as post meta,
because `WP_Query` cannot filter a registry-only default. The member and management
calendar queries also treat a missing status row as `open`, so older affected shifts stay
visible.

The diensttype form labels `required_pool` as **Vereiste commissie** and lists all
published commissies alphabetically. When selected, member-facing shift endpoints hide
that type's shifts from everyone who has no current `work_history` entry for the commissie;
coordinators retain visibility in the management calendar.

### Assignments are meta, not an entity

There is no assignment post type. A shift's `assigned_persons` meta holds an array of
`person` post IDs, with per-person side meta alongside it:

| Meta key | Meaning |
|---|---|
| `_shift_signup_at_{person_id}` | When the assignment was made. Drives the 30-minute cancellation grace and the "recente aanmeldingen" overview. |
| `_shift_signup_user_{person_id}` | Which WordPress account made it — a parent using a child's account, for instance. |
| `_shift_assigned_by_{person_id}` | The coordinator who assigned this person, when it was not a self-signup. Survives cancellation. |
| `_shift_assigned_at_{person_id}` | When that assignment happened. |
| `_shift_assignment_mode_{person_id}` | `assigned` for an explicit duty; `signup` or missing preserves normal self-cancellation rules. |
| `_shift_email_assignment_sent_{person_id}` | Successful delivery time of the duty assignment notice. |
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

1. **Closed shifts stay in the calendar response.** The window is not part of
   `member_shift_block_reason()`, whose callers all `continue` and thereby hide a
   shift. A calendar day whose shifts are all closed gets the `locked` state rather
   than the red that means "sign up here". The member interface hides the complete
   signup period containing those locked days until that period opens; the manager
   calendar continues to show the whole season.
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

The capability also grants the full `dienst_shift` capability map. Coordinators can therefore edit
a concrete shift regardless of which user originally created it. The standalone editor derives the
stored post title from the selected diensttype and local start time on every save, so changing a
shift time cannot leave the old time behind in its title.

Holders of the `vrijwilligers` capability manage the programme. Beyond the CPTs, they can:

| Endpoint | Purpose |
|---|---|
| `GET /rondo/v1/shifts/{id}/assignable-people?search=` | Candidates for this shift, with a `block_reason` on anyone who cannot take it. Blocked people are listed rather than filtered out — a coordinator who cannot find someone concludes the search is broken. |
| `POST /rondo/v1/shifts/{id}/assignees` | Put a person on the shift. All member-facing rules still apply; there is no certificate override. |
| `DELETE /rondo/v1/shifts/{id}/assignees/{person_id}` | Remove an assignee after the member deadline. |
| `POST /rondo/v1/shifts/{id}/cancellation` | Cancel the whole shift, with audited credit rules and notifications. |

### Statistics dashboard

The coordinator page at `/vrijwilligers/statistieken` provides one season-level overview without
exposing person names. It combines five headline metrics with the assignment share and fill rate per
task type, the cumulative signup trend, assignment distribution, obligation progress, and upcoming
shifts with open spots. The season selector is stored in the `seizoen` URL parameter, so a filtered
view can be bookmarked.

The page uses one aggregated request:

`GET /rondo/v1/volunteer-statistics?season=YYYY-YYYY`

The endpoint requires `manage_options` or `vrijwilligers`. It queries published `dienst_shift`
posts inside the selected 1 July–30 June season, excludes shifts whose status is `geannuleerd`, and
counts only the person IDs still present in `assigned_persons`. Task-type colours and names come
from the linked `dienst_type`. Signup trend dates prefer `_shift_signup_at_{person_id}` and fall back
to `_shift_assigned_at_{person_id}`; assignments without either timestamp are reported separately.
Upcoming shortages are limited to active shifts in the next 30 days. The response contains only
counts and shift identifiers for drill-down, never names or contact details.

The `account_trend` series contains `{ date, count, cumulative }` points for all existing site
accounts, across all seasons and roles. It uses WordPress `user_registered` (UTC), groups
registrations by calendar day in the site timezone, and excludes invalid or future dates. Deleted
accounts no longer contribute. The season selector does not filter this series; the panel states
its all-time scope. The chart shares the signup chart component and shows both the cumulative
total and the number created today. No account IDs, names, or email addresses are returned.

The `by_team` array powers **Overzicht per team** in the **Per team** tab on the same page.
The default **Algemeen** tab contains the existing aggregate statistics and charts.
`tab=teams` selects the team tab in the URL; changing tabs preserves `seizoen`, and
changing seasons preserves the active tab. The table hides rows with `people_count=0`
and shows an empty state when no populated teams remain. Rondo Bestuur,
Rondo Vrijwilligers and administrators can read it through the existing statistics
permission; full Teams access is not required. Rows expose only `id`, `name`,
`people_count`, `account_count`, `required_count` and `assignment_count`, ordered
naturally by team name. The API still includes published teams without members with zeroes; the table filters them out.

- `people_count` counts current players and staff plus their linked parents, each
  person once per team. Duplicate roles, siblings with the same parents and a parent
  who is also on the roster do not inflate this count. Former/deceased team members,
  unpublished people, ended or future memberships, and inactive undated memberships
  do not contribute as team members. Existing parent records can still count even
  when the parent is a former club member.
- `account_count` counts distinct existing WordPress accounts linked to those people.
  Both `_rondo_wp_user_id` and `rondo_linked_person_id` are supported; duplicate
  links and deleted accounts do not inflate the count.
- `required_count` sums the season obligation of each roster member after the shared
  exemption policy. A child's family obligation counts in full for that child, even
  when siblings are in the same team. This is the total requirement, not the remainder.
- `assignment_count` sums current non-cancelled season assignments for those roster
  members or their associated family obligation. Completed assignments and no-shows
  remain registrations; withdrawn assignments and cancelled shifts do not count.
  Exempt members' registrations still count. Family registrations can repeat for
  each child, so team rows must not be summed into a unique club total.

Team membership, parent links and accounts are always current; only the duties and
registrations use the selected season. This scope is stated on the page. The browser
receives no person or account IDs, and team names do not link to restricted team pages.

The coordinator editor offers **Indelen** (record an agreement using the normal signup rules)
and **Dienst toewijzen** (an explicit duty that the member cannot cancel themselves).
`POST /rondo/v1/shifts/{id}/assignees` accepts `assignment_mode: "signup" | "assigned"`,
defaulting to `signup` for existing callers. Both modes enforce capacity, certificate and pool
requirements, overlap checks and coordinator permissions. Existing assignments are not converted
by retrying the endpoint in another mode; remove and re-add deliberately instead.

Both modes write `_shift_signup_at_` for reporting. For `assigned`, member cancellation returns
`409 shift_assignment_required`, even before the 21-day deadline or during the 30-minute grace
period. Member list and calendar responses expose `is_duty_assigned` and `can_cancel: false`,
and the UI directs replacements and swaps to the accommodatiemanager. Coordinators can still
remove the person; removal clears the mode and any pending confirmation. Ordinary signups and
all existing assignments retain their cancellation rights. Person merges and guardian relinking
preserve the mode; an explicit duty takes precedence over a regular signup.

The shift editor response includes `duty_assigned_person_ids` alongside `assigned_person_names`
so coordinators can distinguish the two kinds of assignment.

`assigned_persons` cannot be written through the generic REST route: it is REST-exposed,
but `prevent_direct_assignee_writes()` refuses any change to it, because that path skips
capacity, certificates, the write lock, the confirmation mail, the `vol` status flip,
and detaches template-managed shifts from their sjabloon.

## Notifications

`ShiftEmailScheduler` sends a batched confirmation ten minutes after signup (so three
quick claims produce one mail), with an iCal attachment; reminders at 14, 7 and 2 days;
cancellation notices; and a post-shift survey when the diensttype configures one.
Templates live on the `dienst_type`.

Explicit duty assignments use `assignment_email_subject` and `assignment_email_body` under
canonical `fields`, editable in the task-type form's **Toewijzingsmail** section. Variables:
`{naam}`, `{dienst}`, `{datum}`, `{tijd}`, `{eindtijd}`, `{medevrijwilligers}`. Empty values use the
registry defaults, which explain the member's responsibility, arranging cover or a swap, notifying
the accommodatiemanager, and the absence of self-cancellation. Content is rendered as escaped
plain text inside the shared branded email template.

Duty notices use the same ten-minute queue but send one email per duty, including its calendar
attachment, so each task type can supply its own wording. Ordinary signups remain combined in
one separate confirmation. Failed notices remain queued for retry; successful notices and removed
or cancelled assignments leave the queue. This prevents a mixed signup/assignment batch from
sending the wrong template or resending its successful part.

The **Mijn inschrijftaken** tab also links to
`GET /rondo/v1/my-shifts/calendar`. This authenticated endpoint downloads
`mijn-inschrijftaken.ics` with every active or completed assignment for the linked person;
cancelled shifts are omitted. It reuses the signup-confirmation calendar builder, including
`Europe/Amsterdam`, stable per-person event UIDs, and a description and URL back to
`/vrijwillig` in every event.

The personal navigation link opens `/vrijwillig?tab=mine`. That view requests only
`GET /rondo/v1/my-shifts`; the much larger signup calendar request is enabled when the member
opens **Beschikbaar**. The diensttype filter on the personal tab is derived from the member's own
shift response so it does not depend on loading the full calendar.

## Obligation credit

`VolunteerObligationCalculator` reads `assigned_persons` directly and does not care who
wrote it, so a coordinator-made assignment counts exactly like a self-signup. Any
mutation must call `VolunteerObligationCalculator::invalidate_cache()`.

## People list obligation progress

Since 35.87.0, Relaties offers an **Inschrijftaken** filter and optional status,
Ingepland, Afgerond, and Vereist columns for the current sports season. Selecting
a status temporarily shows these columns next to the person's name, without
changing stored column preferences. The CSV export uses the same filter and includes
the counts when these columns or the filter are active.

Access requires the explicit `rondo_bestuur` or `rondo_vrijwilligers` role. The
`can_view_people_shift_progress` current-user flag controls the UI, and
`PeopleShiftProgress::can_view()` also guards the API and available-column metadata.
An administrator or IVA approver without either role does not receive this feature.
Other people-list access rules and filters continue to apply.

`GET /rondo/v1/people/filtered` accepts `include_shift_progress=true` and/or
`shift_status=not_started|insufficient|planned|completed|exempt`. Requesting either
without an authorized role returns HTTP 403. Ordinary list requests omit the
summary entirely. Authorized responses include `shift_season` and each returned
person's `shift_progress` (`required`, `completed`, `planned`, `family`, `status`),
or null when the person carries no obligation.

`PeopleShiftProgress` batches the existing eligibility, obligation calculator,
and exemption resolver. Family duties appear for responsible adults, not their
youth children; both parents see the shared counts, marked “Inclusief gezin”.
These are obligation counts, not independent personal attendance totals: do not
sum family rows to calculate a club total. Exempt duties are excluded from counts;
fully exempt people display “Vrijgesteld” and dashes. People without a duty display
“Geen verplichting” and dashes and do not appear in the five status filters.

- `not_started`: an active duty, with no completed credit or planned assignment.
- `insufficient`: some completed credit or planned work, but an active duty is still
  underbooked.
- `planned`: every active duty is covered by completed credit plus future bookings,
  with some work still to complete.
- `completed`: every active duty has enough completed credit.
- `exempt`: all of the person's duties are exempt.

Coverage is capped separately per duty so surplus on a personal obligation cannot
hide an outstanding family duty. Existing season, no-show, cancellation-credit,
and player-before-family attribution rules remain the source of truth. “Afgerond”
includes credit for late club cancellations. Filters are applied before pagination
and total calculation; only the resulting page receives full person data.

## Weekend recruitment mail scheduling

`WeekendVolunteerMail` schedules a Sunday 19:00 Europe/Amsterdam digest for open
shifts on the weekend thirteen and fourteen days later. Its `init` registration
and `rondo_weekend_volunteer_mail` callback both accept zero WordPress hook
arguments. The optional `DateTimeImmutable` parameter on the underlying methods
is a test clock, not a hook argument: WordPress can pass an empty string for an
action invoked without arguments, which otherwise causes a fatal type error.
Regression tests exercise both registrations through WordPress action dispatch.
