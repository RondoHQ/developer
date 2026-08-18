---
title: Vrijwilligersplicht
description: How Rondo derives who owes volunteer diensten, how the duty is scaled, and how completed shifts are attributed.
---

Rondo derives the volunteer obligation on demand. **No boolean is stored per person.** The whole
eligibility set is recomputed from three inputs on the `person` CPT:

- `leeftijdsgroep` — the Sportlink `AgeClassDescription`, e.g. `"Onder 11"`, `"Senioren"`
- `relationships` — the parent-of / child-of repeater
- `addresses` — first address, used as a gezin fallback when relations are missing

The logic lives in `Rondo\Volunteer\VolunteerEligibilityService`.

## Obligation units

An obligation belongs to a **unit**, not to a person. There are two kinds.

| Kind | Trigger | Who is responsible |
|---|---|---|
| `speler` | An O17+ player | The player themselves |
| `gezin` | One or more JO16- players in a household | The parents, together |

A JO16- player owes nothing personally — their parents carry the duty. `age_group_number()` parses
the integer out of `"Onder N"`; adult buckets (`Senioren`, `Veteranen`, `Recreanten`,
`Champions league`, `Walking`) map to `99`.

A gezin unit is keyed by, in order of preference:

1. the sorted parent IDs from `relationships` (best)
2. the youth player's address key, `POSTALCODE-HOUSENUMBER` (fallback)
3. the youth player's own ID — an **orphan** unit, surfaced as a data-quality issue rather than
   silently dropping the obligation

Children who share parents or an address collapse into one gezin.

## The two duties are cumulative

An O17+ player who is *also* the parent of a JO16- player owes **both** the spelersplicht and the
ouderplicht. They are not alternatives.

`get_eligible_units_for_person()` returns every unit a person is responsible for — zero, one, or
two. The `speler` unit always comes first, and that ordering is load-bearing: **completed shifts
fill the speler duty before spilling into the gezin duty.**

```
Lennart plays Senioren and has two JO16- children.

  speler unit   required 2
  gezin unit    required 3   (2 children, multi-child scaling)
                ─────────
                total    5
```

:::caution[Deprecated accessor]
`get_eligible_unit_for_person()` (singular) returns only the *first* unit and therefore hides the
gezin duty of a playing parent. It is kept solely because `VolunteerFineGenerator` uses it to walk a
household roster. Do not use it to answer "what does this person owe".
:::

## Multi-child scaling

Bestuursbesluit 2026-05-26. The base obligation is **2 diensten**. Each subsequent child
contributes less, mirroring the contributie discount:

| Child | Factor | Contributes |
|---|---|---|
| 1st | 100% | 2 |
| 2nd | 75% | 1.5 |
| 3rd and beyond | 50% | 1 each |

The total is floored: a gezin with 2 youth children owes `floor(2 + 1.5) = 3`, with 3 children
`floor(2 + 1.5 + 1) = 4`.

Scaling is applied **after** all children are merged into the unit, never per child — otherwise a
parent of three would see one dienst instead of four.

The admin dashboard at `/vrijwilligers` shows **Inschrijftaken vereist** by summing `required_count`
across all units. Do not use the number of units as the total workload: a multi-child gezin remains
one unit but can require three or more diensten.

The two adjacent planning cards count capacity slots instead of shift posts. **Inschrijftaken totaal**
sums each non-cancelled shift's capacity in the selected sports season, so a shift with capacity four
counts four times. **Inschrijftaken ingeroosterd** sums the assigned person count on those same shifts.
Completed shifts remain in the season totals; cancelled shifts and shifts outside the season do not.
Both values come back as `shift_capacity.total_slots` and `shift_capacity.assigned_slots` in
`GET /rondo/v1/volunteer-eligibility`.

The dashboard also shows **Accounts aangemaakt**. This is the number of WordPress users with a
non-empty `rondo_linked_person_id`, matching the definition used by Rondo's account management.
Administrators and service users without a linked person are not included. The value is returned as
`rondo_account_count` by the same eligibility endpoint, so loading the card adds no extra request.

## Owing versus being allowed

These are different questions, and conflating them turns willing helpers away.

- `get_eligible_units_for_person()` answers **what is required of you**.
- `may_volunteer()` answers **whether you may claim a shift at all**, and is true for any person who
  is not a `former_member`.

A sponsor, a grandparent, or a parent whose children have aged out owes nothing and may still sign
up. `GET /rondo/v1/my-shifts/available` only refuses oud-leden.

The member page at `/vrijwillig` shows completed, scheduled, and still-unscheduled inschrijftaken
separately. The number in **Plan nog … in** is `required_count - completed_count - pending_count`,
clamped at zero. When completed and pending shifts together cover the obligation, the page confirms
that all required shifts have been scheduled; pending shifts do not yet fill the completed-only
progress bar.

When a member selects a shift that overlaps an existing assignment, the signup endpoint returns an
`overlap_warning` with the candidate `shift_id`, the conflicting `overlap_shift`, and
`can_force: true`. The member may cancel or repeat the signup with `force_overlap: true`; the forced
request skips only the overlap warning and still applies all eligibility, capacity, and status
checks.

`VolunteerObligationCalculator` caches each unit-and-season tally for five minutes. Cache keys
include the site-wide `rondo_vobligation_cache_generation` option. Every mutation that changes an
assignment, completion, cancellation or no-show must call
`VolunteerObligationCalculator::invalidate_cache()` after the write. Advancing the generation makes
the next `GET /rondo/v1/my-shifts` recompute immediately and works with both database transients and
persistent object caches; do not delete transient database rows directly.

## Inschrijftaken on person profiles

The **Profiel** tab of a person detail page shows a read-only, single-column **Inschrijftaken** card.
Above the shift list it shows the current season's personal and/or shared family obligation. The
family row uses the same merged gezin unit and multi-child discount as the volunteer dashboard. On
a JO16- player's profile, the card resolves the family duty triggered by that child; it does not
incorrectly present that duty as a personal duty. Exempt units are labelled as exempt and contribute
zero to the displayed effective total.

Below the obligation summary, the card lists every active future shift in chronological order and at
most the two most recent shifts whose start time has passed. Cancelled future shifts are omitted;
cancelled historical shifts remain visible with their status.

The card uses `GET /rondo/v1/people/{person_id}/shifts`. Its permission callback delegates to the
normal person visibility check, so age-group and relationship scoping stay aligned with the rest of
the person detail page. The response contains `season`, a privacy-trimmed `obligations` array, and
`upcoming` and `recent` arrays with shift details. Obligation entries expose only their kind,
required count, child count, and possible exemption. The response never contains unit membership
IDs, assignee person IDs, fellow-volunteer names, phone numbers, or WhatsApp links.

### Temporary parent identity on a child account

A parent who is not yet a separate Sportlink person may temporarily use an account linked to their
JO16- child. Once they identify themselves by name, `GET /rondo/v1/my-shifts` resolves the gezin
unit triggered by that child instead of showing the child's empty personal obligation. Shift
requirements such as VOG, IVA and pool access continue to be evaluated against the currently linked
child until membership administration changes the account link.

Every signup made in this phase stores the acting WordPress user alongside the normal person-based
assignment. On **Accountkoppeling wijzigen**, only assignments attributed to that account move from
the child to the newly synced parent. VOG and IVA fields—including the certificate attachment,
approval and VOG process dates—move at the same moment. Existing, different VOG/IVA data on the
target blocks the operation instead of being overwritten. Email confirmation, reminder, survey,
cancellation and no-show markers follow the moved assignment.

While the claim is pending, member-facing shift lists, fellow-volunteer details and manager shift
editing show the parent's supplied name. The underlying person ID remains the child's until the
relink operation succeeds.

## Seeing fellow volunteers

Both `GET /rondo/v1/shifts/available` and `GET /rondo/v1/my-shifts` include a
`fellow_volunteers` array on every shift. It contains the display names of the other published
`person` records assigned to that shift, excluding the caller. The member interface shows these
names so volunteers know who they will work with before signing up and in their own schedule.

`GET /rondo/v1/my-shifts` additionally includes `fellow_volunteer_contacts`. Each item contains a
display name and, when `mobile_1` is available and valid, a normalized `https://wa.me/...` URL. The
personal **Mijn diensten** tab renders the name as a WhatsApp link. The available-shifts response
deliberately omits this contact array: members can contact one another only after signing up for the
same shift.

Neither response exposes person IDs, email addresses, raw phone fields, or other profile fields.
Stale or invalid assignee references are omitted.

The member-facing shift cards deliberately omit the diensttype colour marker because the task name
already identifies the shift. The management list at `/vrijwilligers/diensten` retains that marker
to make scanning and comparing different task types easier for coordinators.

## Filtering member shifts by diensttype

The member page at `/vrijwillig` builds its diensttype filter from the `dienst_type_id` and
`dienst_type_name` already included in the available and personal shift responses. The filter
applies to both the **Beschikbaar** and **Mijn diensten** tabs.

The selected post ID is stored in the `diensttype` URL parameter. For example,
`/vrijwillig?diensttype=123` opens the page with diensttype post `123` selected. Removing the filter
also removes the parameter; unrelated URL parameters are preserved.

## Club-specific information in the page intro

Administrators can add optional club-specific guidance to the member-facing `/vrijwillig` page in
**Settings → Club → Informatie op vrijwilligerspagina**. The rich-text value is stored in the
`rondo_volunteer_signup_info` WordPress option and supports links, lists, and basic formatting.
The guidance is shown directly below the page title and does not render as a separate information
block. Links open in a new browser tab. Leaving the editor empty hides the introduction entirely.

`Rondo\Config\ClubConfig` sanitizes the HTML with `wp_kses_post()` on both write and read. The safe
value is exposed as `volunteer_signup_info` by `GET /rondo/v1/config` and injected into the initial
JavaScript config as `volunteerSignupInfo`, so rendering the introduction does not add another request to
the member page.

## Shift coverage calendar

The user interface calls both `dienst_type` definitions and scheduled `dienst_shift` records
**inschrijftaken**. This is a presentation-only terminology choice: post type names, REST routes,
query parameters and template variables such as `{dienst}` keep their existing technical names.

The admin detail screen resolves every ID in `assigned_persons` through the people REST endpoint and
shows the person's post title. It only falls back to `Persoon {id}` when the linked person cannot be
resolved.

The standalone shift editor asks for one calendar date plus a separate start and end time. Both ACF
datetime values are composed with that same date when saving, so managers never have to enter the
date twice and a standalone shift cannot accidentally span two dates. The native date input has a
maximum of `9999-12-31`; this keeps Chromium-based browsers to a four-digit year instead of their
default six-digit year segment.

Both `/vrijwilligers/diensten` and the member-facing `/vrijwillig` page use the shared
`ShiftCoverageCalendar` component. The manager view shows the rest of the club year through 30
June. The member view uses that same range, but hides a signup period in its entirety while that
period is still closed. For example, January through June only appear after the configured opening
date for the second season half:

- **Green** means every relevant `dienst_shift` on that date has reached its capacity.
- **Red** means at least one relevant shift still has an open place.
- **Neutral** means no relevant shifts are scheduled on that date.

Cancelled and completed shifts are excluded. Selecting a date opens its individual shifts in a
viewport-aware popover beside the selected date; it can be closed with its close button, Escape, or
a click outside. The manager view links each shift to its edit screen, while the signup view exposes
the existing signup and cancellation actions. Colour is always accompanied by text, an icon and an
accessible label.

On `/vrijwilligers/diensten`, the dienst type catalog is no longer permanently shown below the
calendar. Managers open it through the **Inschrijftaken** button beside **Sjablonen**. Its popover
contains the existing create and edit links, requirements, colours, and default capacities.

The `diensttype` URL parameter filters the calendar as well as the personal shifts list. With no
filter, a date is green only when every diensttype on that date is full. With a filter, only shifts
of the selected type determine the date status.

### Copying a complete planning day

Volunteer managers can open a populated date in the unfiltered manager calendar and choose
**Dagplanning kopiëren**. The confirmation dialog lists every active shift and its capacity before
the manager selects a future target date. The action calls:

`POST /rondo/v1/shifts/copy-day`

with `{ "source_date": "YYYY-MM-DD", "target_date": "YYYY-MM-DD" }`. The endpoint requires
`manage_options` or `vrijwilligers` and uses `dienst_shift` posts plus post meta; it does not use a
separate table.

Copied shifts are new standalone posts. The dienst type, local start and end times, capacity, IVA
override and notes are retained. The status is reset to `open`, `assigned_persons` is empty, and
template, signup, notification, cancellation and no-show state is never copied. Local wall-clock
times are replaced onto the target date instead of adding a timestamp difference, so copying across
a CET/CEST transition does not move a shift by one hour.

The operation is idempotent. A target shift with the same dienst type and time window is skipped,
as is a target row already carrying the source shift's `_copied_from_shift_id` provenance. Existing
target rows are never overwritten. If an unexpected insert fails, only posts created by that
request are rolled back. The response reports `source_count`, `created`, `created_ids`, `skipped`
and `skipped_items` so the interface can distinguish a successful copy from a no-op repeat.

Calendar data comes from:

`GET /rondo/v1/shifts/calendar?view=manage|signup&from=YYYY-MM-DD&to=YYYY-MM-DD&dienst_type_id=123`

The requested range is limited to 370 days and interpreted in the WordPress timezone. `view=manage`
requires `manage_options` or `vrijwilligers`. `view=signup` resolves the current user to their linked
person and applies the same VOG, IVA and required-pool gates as the signup endpoint. Full shifts stay
visible so members can understand green dates, but they have `can_signup: false`. Window-closed
shifts remain present in the REST response with `signup_opens_at` and a `locked` day state, while the
member interface hides their complete signup period until it opens. Person IDs and contact details
are never returned by the calendar endpoint. Its `block_reasons` only reports a missing VOG or IVA
certificate when at least one shift in the requested range and selected diensttype is actually
hidden for that reason. The signup endpoint still enforces the certificate requirement independently,
including for direct requests.

Below the manager calendar, **Recente aanmeldingen** lists at most 10 shifts ordered by their latest
current self-service signup. Each row shows the shift moment, the names of the people who signed up,
and the latest signup time. The shift name opens its editor and each person's name opens their
profile. The data comes from
`GET /rondo/v1/shifts/recent-signups`, which requires `manage_options` or `vrijwilligers` and derives
the ordering from the `_shift_signup_at_{person_id}` post-meta values. A person removed from
`assigned_persons` is not returned, and manager-added assignees without a signup timestamp are not
treated as self-service signups.

The **Alle aanmeldingen** link opens `/vrijwilligers/aanmeldingen`. That page lists shifts with
current assignees, including legacy assignments without signup timestamps. Cancelled shifts and
their assignments remain stored for audit history, but the page hides them by default and excludes
them from its assignment and shift totals. A status filter can show only cancelled shifts or all
statuses; cancelled rows are labelled explicitly. Its default order shows the nearest upcoming
shift first, followed by past shifts from newest to oldest. Coordinators can sort the table by task
name or shift moment. Data comes from `GET /rondo/v1/shifts/signups`, which accepts `status=active`
(default), `status=cancelled`, or `status=all` and has the same `manage_options` or `vrijwilligers`
permission requirement as the recent overview. The recent-signups endpoint also excludes cancelled
shifts.

Signup overlap detection compares parsed datetimes and treats each shift as a half-open interval:
the start is included and the end is excluded. Two consecutive shifts can therefore share the same
boundary minute, including when one stored value includes seconds and the other does not. A genuine
overlap still returns the forceable `overlap_warning` response.

## Signup confirmations and calendar attachments

After a successful member signup, `ShiftEmailScheduler::queue_signup_confirmation()` stores a
pending marker on the `dienst_shift` and schedules the single WP-Cron event
`rondo_send_shift_signup_confirmation` for that person ten minutes later. Further signups within
that window reuse the same event. When it runs, one HTML email lists every still-active signup and
attaches one `.ics` calendar containing a `VEVENT` for each shift. Shift datetimes are stored as
Dutch local wall-clock values. The calendar therefore uses `TZID=Europe/Amsterdam` plus an embedded
`VTIMEZONE` definition with CET/CEST transitions, so Apple Calendar, Google Calendar, Outlook, and
other iCalendar clients preserve the planned time throughout the year.

All human-readable dates in signup confirmations, reminders, and cancellation messages use explicit
Dutch weekday and month names. Their language therefore does not depend on the configured WordPress
locale; calendar event timestamps use the explicit Dutch timezone.

Pending markers are removed when a member or manager cancels the signup, so a shift cancelled
during the ten-minute collection window is not confirmed. A successful message records
`_shift_email_confirmation_sent_{person_id}` on each included shift. Failed `wp_mail()` calls retain
the pending markers and schedule one retry after fifteen minutes; members without a valid `email_1`
or `email_2` address are skipped and their pending markers are cleared.

The template expander keeps 93 days of concrete shifts available. This covers every possible
three-calendar-month view, including three consecutive 31-day months.

The daily cron and saving a `shift_template` both keep using that rolling 93-day window. A manager
can also click **Uitrollen** on `/vrijwilligers/sjablonen`. That manual action requires an end date
and calls `POST /rondo/v1/shift-templates/expand` with `{ "until": "YYYY-MM-DD" }`. The selected date
is inclusive and cannot be before today. Expansion remains idempotent: an existing shift with the
same `template_id` and `start_datetime` is not created again. The idempotency check matches the start
time in both `Y-m-d H:i` and `Y-m-d H:i:s` notation, so an admin edit that rewrites the value through
ACF can never spawn a duplicate on the next run. Each template's `active_from` and optional
`active_until` dates still limit its generated shifts.

### Editing rolled-out shifts and detaching from a template

A rolled-out `dienst_shift` is an independent post: editing a `shift_template` never propagates to
shifts that already exist. Each generated shift carries a `template_id` pointer for provenance.

The first time a manager edits a rolled-out shift through the admin editor (`POST /wp/v2/dienst-shifts/{id}`),
the `rest_after_insert_dienst_shift` hook sets a `_shift_customized` meta flag. The shift keeps its
`template_id` (so the editor still shows where it came from), but it is now excluded from re-rollout.
Member signup and cancellation write meta straight through `rondo/v1` and the expander uses
`wp_insert_post()` directly, so neither path trips this hook — only a genuine admin edit detaches a shift.

The shift editor surfaces this state via a read-only `template_link` REST field
(`{ id, title, customized }`, or `null` for a standalone shift).

To push template changes to already-rolled-out shifts, a manager opens the sjabloon and clicks
**Opnieuw uitrollen**, which calls `POST /rondo/v1/shift-templates/{id}/rerun`. This deletes the
template's future, still-managed shifts and regenerates them over the rolling 93-day window from the
template's current settings. Three categories are preserved untouched and reported back in the
response (`deleted`, `created`, `kept`, `kept_signups`): shifts flagged `_shift_customized`, shifts
that already have assignees, and cancelled shifts (kept for history).

## Automatic IVA verification

Rondo recognizes two generations of official IVA PDF certificates:

- the legacy VWS/NOC*NSF e-learning certificate, identified by the text marker `Voor elkaar`;
- the newer VrijwilligerswerkNL certificate, identified by its `Certificaat IVA -
  VrijwilligerswerkNL` title and TCPDF producer metadata.

Both are TCPDF-generated PDFs whose text layer contains only personalized values. On every PDF
upload to `POST /rondo/v1/iva/upload`, `Rondo\Volunteer\IvaCertificateParser` (backed by
`smalot/pdfparser`) extracts the name and Dutch long-form completion date. Legacy extraction is
pattern-based because values can be glued together and their order varies.

The certificate is **auto-approved** (`iva-approved = 1`, no review email) when both hold:

- the name on the certificate matches the linked person — compared against the post title,
  `first_name + last_name`, and `nickname + last_name`, case/diacritics-insensitively with a
  small typo tolerance (Levenshtein ≤ 2, scaled down for short names). VrijwilligerswerkNL's
  embedded font map can expose only the final character of a given name; for that format only,
  Rondo also accepts an exact multi-word surname from the linked person's title with at most two
  unexplained leading characters. Single-word surname fallbacks remain manual, and
- the completion date on the certificate is at most 2 years old and not in the future
  (`IvaCertificateParser::AUTO_APPROVE_MAX_AGE_YEARS`; stricter than the 5-year validity —
  older certificates always go through manual review).

When parsing succeeds, the date printed on the certificate overrides the member-entered
`datum_iva`. Images are deliberately not OCR'd: JPG/PNG uploads, screenshots, Sociale Hygiëne
certificates, non-official PDFs and unrecognized layouts use the manual review flow below. The
member UI therefore asks for the original PDF where possible. The upload response exposes the
outcome as `auto_verified` (boolean); the member UI shows "automatisch geverifieerd" instead of
the pending-review message.

Note this is consistency checking, not cryptographic verification — the source PDFs carry no
signature or verification URL, so a deliberately forged PDF can pass. The manual review path and
the private certificate file remain the audit trail.

## IVA approval notification

After a successful `POST /rondo/v1/iva/upload`, Rondo sends a review request to every unique,
deliverable address belonging to a user with `rondo_iva_approve` (administrators are included).
The message links to `/vrijwilligers/iva?review={person_id}`. That deep link limits the IVA overview
to the newly uploaded certificate, where the approver can open the private file and approve it. The
certificate itself remains behind the authenticated REST endpoint; the email never contains a
public file or approval token. Review-request emails are logged on the person's timeline with
template type `iva_review_requested`. Shared contact addresses receive only one message.

The upload succeeds even when there is no deliverable approver address or mail delivery fails. The
upload response exposes the notification result as `notification.status`, plus the `sent` and
`failed` counts.

### Member notification after approval

When `POST /rondo/v1/iva/{person_id}/approve` changes an unapproved certificate into a valid IVA
status, Rondo emails the first valid `email_1` or `email_2` address. The message explains that the
member can now sign up for IVA-restricted shifts and links to `/vrijwillig`. The sent message is
logged on the person's timeline with template type `iva_approved`.

Administrators can edit the subject and plain-text body under **Settings → Beheer → E-mails →
IVA-goedkeuring**. The templates support `{first_name}`, `{full_name}` and `{club_name}`. Rondo
always adds the CTA to `/vrijwillig`, so changing the message cannot remove the signup link.

Repeated approval of the same state does not send a duplicate. Revoking and later approving again
does send a new notification. An expired or otherwise non-valid certificate is never sent the
eligibility message, even if its approval flag is set.

## Cancellation policy

Members can cancel their own signup until 21 days before `start_datetime`. A signup timestamp is
stored as `_shift_signup_at_{person_id}`. Inside the 21-day window, that timestamp opens a 30-minute
grace period so an accidental click can still be corrected. The REST endpoint enforces the rule;
the interface mirrors it through `can_cancel` and warns before a signup that falls inside the
deadline.

Users with `manage_options` or the configurable `vrijwilligers` capability can always remove an
assignee through:

`DELETE /rondo/v1/shifts/{shift_id}/assignees/{person_id}`

This manager action removes the signup timestamp and reopens a full shift. The built-in
Administrator, Rondo Vrijwilligers, Rondo Bestuur and Rondo IVA Goedkeurder roles currently carry
the required capability; administrators can assign it to other roles in the capability matrix.

### Cancelling an entire shift

A shift with assignees is never hard-deleted. A manager with `manage_options` or `vrijwilligers`
uses:

`POST /rondo/v1/shifts/{shift_id}/cancellation`

The optional JSON field `reason` is included in the notification email. The backend calculates the
policy variant from the WordPress timezone and the shift start; the manager cannot override it:

| Notice before `start_datetime` | Variant | Counts as completed | Member action |
|---|---|---|---|
| 48 hours or more | `early` | No | Choose a replacement shift |
| Less than 48 hours | `last_minute` | Yes | No replacement needed |

Exactly 48 hours is the early variant. Cancellation sets the shift status to `geannuleerd` and
stores the timestamp, acting user, policy variant, credit decision, notice duration and optional
reason as post meta. The `assigned_persons` array is deliberately retained for audit history and
credit attribution. The operation uses the same per-shift write lock as signup changes and is
idempotent.

Every assignee with a valid primary or secondary email receives a personal HTML email immediately.
Per-person send markers prevent duplicates; repeating the endpoint only retries recipients whose
earlier `wp_mail()` call failed. The response reports sent, failed and missing-email counts.
Cancelled shifts receive no reminders or surveys and disappear from the availability calendars.
They remain under **Mijn diensten → Historie**, labelled **telt mee** or **telt niet mee**.

Both cancellation variants are editable per `dienst_type` at
`/vrijwilligers/diensttypes/{dienst_type_id}`. The early variant uses
`cancellation_early_email_subject` and `cancellation_early_email_body`; the last-minute variant uses
`cancellation_last_minute_email_subject` and `cancellation_last_minute_email_body`. Empty values fall
back to the built-in Dutch policy texts. The optional cancellation reason is appended after the
configured body.

Directly setting `status=geannuleerd`, modifying a cancelled shift, or hard-deleting a shift with
assignees/cancellation history is blocked. This ensures notifications, credit and the audit trail
cannot be bypassed through the standard WordPress REST or ACF editors.

## Reminder and survey emails

`Rondo\Volunteer\ShiftEmailScheduler` runs hourly and sends individual, idempotent messages to the
primary valid email (`email_1`, falling back to `email_2`) of every current assignee:

| Delivery | Scheduled time |
|---|---|
| Reminder | 14 days before `start_datetime` |
| Reminder | 7 days before `start_datetime` |
| Reminder | 2 days before `start_datetime` |
| Survey | 1 day after `end_datetime` |

Each send is marked on the `dienst_shift` using a per-delivery, per-person post-meta key, so repeat
cron runs cannot send duplicates. Failed sends remove their marker and can be retried. Individually
removed assignees are no longer in `assigned_persons`. Entirely cancelled shifts retain their
assignees for history, but the scheduler skips the `geannuleerd` status. No-shows do not receive the
post-shift survey.

The `dienst_type` edit page stores the reminder, cancellation and survey subjects and bodies, plus
`survey_url`. Empty reminder and cancellation fields use the built-in Dutch defaults. The survey is
disabled until a valid Google Forms URL is configured. Subjects and bodies support `{naam}`,
`{dienst}`, `{datum}`, `{tijd}`, `{eindtijd}`, and `{medevrijwilligers}`. The survey URL is rendered
as a branded **Vul de enquête in** button.

## Progress and status

`Rondo\Volunteer\VolunteerObligationCalculator::decorate_units()` enriches each unit with
`completed_count`, `pending_count` and `no_show_count`, computed by matching `dienst_shift` posts
whose `assigned_persons` meta intersects the unit's `person_ids` within the season window
(1 July – 30 June).

### Attribution: every shift counts once

A person who carries both duties fills the **speler duty first**; only the surplus counts toward the
gezin. Nothing is stored on the shift — the order is fixed and the speler duty is per-person, so the
split is derivable:

```
speler.completed = min( completed[p], speler.required )
gezin.completed  = Σ over p in gezin.person_ids of max( 0, completed[p] − speler_required(p) )
```

`speler_required(p)` is 2 for an O17+ player and 0 for children and non-playing parents. Pending
shifts are consumed after completed ones. A no-show is a personal failure and is counted once, on
the person's own duty.

Two consequences worth knowing:

- **A player with no youth children has nowhere to spill**, so their speler unit keeps *every*
  shift. Do six diensten and the unit reads `6 / 2`. Capping there would quietly erase real work
  from the club's `total_completed`.
- **Without this, a playing parent who owed 2 + 3 was done after 3 shifts**, because each shift was
  credited to both units. It now takes 5.

`unit_status()` then buckets the unit:

| Status | Condition |
|---|---|
| `voldaan` | `completed >= required`, or nothing is required |
| `op-weg` | `completed + pending >= required` |
| `risico` | nothing completed and nothing planned |
| `geen-actie` | anything else |

## Data-quality diagnostics

`get_eligibility_view()` returns a `diagnostics` block alongside the units:

| Key | Meaning |
|---|---|
| `gezinnen_with_parents` | gezin units keyed on a real `relationships` link |
| `gezinnen_via_address` | keyed on the address fallback |
| `gezinnen_orphan` | **no responsible adult at all** — nobody can fulfil the duty |
| `skipped_no_leeftijdsgroep` | active playing members with `spelactiviteit` but no `leeftijdsgroep`; a Sportlink sync issue |

Orphan gezinnen need a `relationships` entry before the obligation can ever be discharged. Current
volunteers, honorary members (Donateur, Erelid, Lid van Verdienste, Verenigingslid voor het leven)
and every profile without `spelactiviteit` are deliberately kept out of the
`skipped_no_leeftijdsgroep` bucket. This excludes non-playing parents, sponsor-only records and
other contacts while still reporting a parent or sponsor who is also registered as a player.
Former members are excluded from the eligibility calculation as normal business logic and are not
reported as a data-quality problem.

### Drill-downs

The dashboard's **Datakwaliteit** card links each count to a drill-down that lists the personen
behind it, so a beheerder can fix the underlying records. All drill-downs share one endpoint:

`GET /rondo/v1/volunteer-data-quality/{category}`

| Category | Personen returned |
|---|---|
| `orphan` | JO16- spelers zonder ouder-relatie én zonder volwassen huisgenoot |
| `address_fallback` | spelers + ouders van een gezin dat alleen via adres-overeenkomst is afgeleid |
| `missing_leeftijdsgroep` | actieve spelers met `spelactiviteit`, maar zonder `leeftijdsgroep`-meta |
| `no_email` | actieve (niet-`former_member`) leden waarvan `email_1` én `email_2` leeg of ongeldig zijn |

The `no_email` category is not derived from the eligibility view — it is a straight scan for members
who cannot be reached by the [self-service activation flow](/features/account-activation/) until
someone collects an address. Because that is a ledenadministratie concern rather than a volunteer
one, it gates on `check_data_quality_permission()`: `no_email` requires the `ledenadministratie`
capability (admins included), while the eligibility categories stay open to every approved user. For
the same reason, `get_eligibility()` only adds a `no_email` count to `diagnostics` for users who
pass that gate, so the metric — and the card that links to it — stays hidden for everyone else.

Every drill-down page (`VrijwilligersDataQuality.jsx`) has an **Exporteer CSV** button
(`@/utils/csvExport`) so the list can be worked off outside Rondo.

## Exemptions

`VolunteerExemptionResolver` handles per-season exemptions. An exempt member sees an explanatory
card instead of an obligation, and may still volunteer voluntarily. For a `gezin` unit,
`resolve_unit()` checks all responsible parents or guardians: an exemption held by either adult
exempts the shared family obligation. This also applies while a parent temporarily uses a child's
account. Triggering children are only checked for orphan units where Rondo cannot resolve an adult.
The member-facing copy for active club roles stays role-neutral, because committee work and team
staff roles both count. Contributie-vrijstelling is deliberately *not* an exemption ground here;
that runs through the resolver or an honorary role.

Active committee and staff roles use `VolunteerStatus::is_position_current()` as their shared date
policy. Work-history dates are normalized from either the compact `YYYYMMDD` storage format or the
canonical `YYYY-MM-DD` wire format before comparison. A role whose end date is today is no longer
current and therefore no longer grants an exemption or access to a committee-restricted shift pool.

The management page at `/vrijwilligers/vrijstellingen` offers filters for committee members, team
staff, and manual exemptions. A user with the `vrijwilligers` capability can search for a person on
that page and create, edit, or withdraw a manual exemption. For a family obligation the exemption
must be assigned to a responsible parent or guardian, because triggering children are not inspected
when adults are available. The season field accepts a consecutive `YYYY-YYYY` value; an empty value
makes the exemption ongoing.

The frontend reads and writes the narrowly scoped policy state through
`GET|PUT /rondo/v1/volunteer-exemption/{person_id}`. The write route accepts `enabled`, `reason`, and
`season`, requires `manage_options` or `vrijwilligers`, and does not grant access to any other person
fields. It stores the native ACF fields `vrijgesteld_handmatig`, `vrijstelling_reden`, and
`vrijstelling_seizoen`, then invalidates eligibility, relationship-quality, and obligation caches.

The resolver still recognizes the legacy `betaalde_vrijwilliger` field for existing data, but the
page does not expose a separate paid-volunteer filter.
