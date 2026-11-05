---
title: Volunteer planning proposals
description: Review weekly shift proposals, check availability and publish assignments after coordinator approval.
---

Volunteer coordinators review proposed assignments at `/vrijwilligers/voorstellen`.
Generating a proposal leaves shifts unchanged and sends no member assignment mail.
Only publication creates assignments and queues their existing confirmation flow.

## Schedule and notifications

`VolunteerPlanner` schedules `rondo_volunteer_planner` for Wednesday at 09:00 in
the WordPress timezone. It creates at most one normal proposal per ISO week.
**Voorstel vernieuwen / gaten aanvullen** combines open drafts and partial proposals
into one current proposal, retaining valid pending choices and manually open slots.
It drops filled, deleted or changed duties and rechecks candidates before retaining
them. Retained choices reserve time and quota before the planner fills new gaps.
Old snapshots remain intact, read as `closed` and expose `superseded_by`; the new
snapshot records `supersedes`. An interrupted publication must finish before refresh.
The selection starts now and ends on the Sunday four calendar weeks ahead:
Monday of the current week plus five weeks is the exclusive cutoff.

The coordinator receives a link to a non-empty proposal. An hourly
`rondo_volunteer_planner_reminders` check sends one reminder when an open proposal
is at least two days old. `rondo_volunteer_planner_email` stores the recipient;
when that option is absent it falls back to the general mailing overview address.
An explicitly empty value disables proposal notices. Configure both addresses on
the [volunteer mailing card](/features/email-delivery/#coordinator-overview-and-dashboard-status).
Notice state is reserved before sending and records `accepted`, `failed` or
`uncertain`; it prevents automatic duplicate sends after a timeout.

Member cancellation schedules `rondo_volunteer_planner_repair` after one minute
to refresh the current reviewable proposal with replacement choices. The person
who declined that shift is excluded from automatic selection for it.
Theme deactivation clears all three planner hooks.

## Candidate selection

The planner uses the existing season obligation calculator and exemption policy.
It subtracts completed, pending and already proposed work from each eligible unit.
Family candidates are responsible adults, excluding the children who trigger the
family duty. A playing parent's personal duty takes precedence over family work.
Candidates need volunteer eligibility, a contactable primary email and access to
every person in their obligation unit when a logged-in manager generates the plan.

Finite-capacity, published future shifts with status `open` or `vol` are considered.
Unlimited shifts produce an unresolved row asking for a capacity first. IVA-required
shifts come first, then earlier dates. Pending proposals reserve both quota and time
across open plans, within the season of the proposed shift.

### Seasonal workload

For July–December shifts, a person must have no completed, scheduled or proposed
duty in that sports season. A scheduled January–June duty also counts.
Each person's count includes both their own and family duties. It includes cancelled
shifts that earned credit and excludes no-shows. Completed work still counts when
a shift has an invalid end time.

From January, candidates with fewer duties come first. At equal personal load,
an IVA-required shift prefers someone with valid IVA, unless that shift waives IVA.
Next come the season-half target, a lower fulfilled share and a stable weekly
tie-break. Editing and publishing use these same rules.

Within the best fairness tier, the planner prefers pairs sharing a current player
team. Parents can match through any eligible child’s team; two adults from the
same family obligation cannot form a pair. It first matches an unpaired existing
assignee or retained candidate, then looks ahead for two teammates when space
allows. Completed pairs do not pull in a third teammate. Eligibility, availability
and quotas still take precedence; otherwise normal ranking fills the place.

### Eligibility and availability

VOG and required-commissie checks reuse `ShiftSignupEligibility`. Missing IVA allows
a proposal, but publication requires the coordinator's explicit approval below.
Members still need IVA to claim an IVA-required shift themselves. Existing assignments
and proposals block overlapping intervals. For a current player team,
`PlannerAvailability` also checks the active training schedule and team match feed:

| Source | Blocked time |
|---|---|
| Training | Training duration plus 30 minutes before and after |
| Match with known time and duration | Match duration plus two hours before and after |
| Match with unknown time or duration | The whole match day |
| Provisional matchday | Its recorded date interval |

Missing current player-team data for age groups 17 and older, missing season/team
training, and missing, stale or unmatched current-season match feeds block selection.
Cancelled matches and dated training cancellations for that team do not block.
Parents without a current player-team role do not
inherit their children's team schedule. Unfilled rows show issues and aggregate
blocking reasons; missing information never becomes assumed availability.

### IVA warnings

Bar proposals keep the same duty type, even when the chosen person still needs IVA.
Such rows return `iva_missing: true` and show **IVA nog nodig voor deze bardienst**.
Before publishing selected assignments with this warning, the coordinator must
check the confirmation for assignments without approved IVA proof. The publish
button stays disabled until that confirmation is checked. The assignment remains
a bardienst.

Confirmation applies to the current proposal, revision, selected duties and flagged
rows. Changing that scope requires fresh approval. Saving a candidate change or
switching proposals also clears the confirmation.
Refreshing an older draft checks its proposed bar-to-luik changes again, using the
shift's actual duty type.

## Review and publication

Coordinators can choose a currently valid replacement candidate or leave a pending
row open with `person_id: 0`. Candidate reads and publication rebuild eligibility.
Editing, publishing and closing require the current `revision`; stale revisions
return HTTP 409. A 15-minute option lock serializes planner mutations.

Select duties before publication: the selection includes every proposed candidate
for each selected duty. All duties start selected; deselected duties keep their
candidates and reservations for later. Older stored conversions still require
`accept_conversions: true` when selected; refresh the proposal to recalculate them.
Omitting `shift_ids` preserves the API’s all-duty behavior.

Publication stores `publish_shift_ids` before making assignments and processes at
most ten selected rows per request. The stored selection cannot change until the
batch finishes. Editing, closing and regenerating are blocked during that work.
After interruption, resume with the saved selection and current revision.

Each row rechecks the
shift snapshot, current obligation, VOG, required pool, availability, capacity and status
inside the existing shift write lock. Successful rows become explicit `assigned`
duties and queue assignment mail. Invalid rows remain pending with an issue;
successful rows stay published. `publish_more` tells the client to continue using
the returned revision. The interface performs those follow-up requests itself.

Phases are `draft`, `partial`, `published` and `closed`; row states are `pending`,
`publishing` and `published`. Stored plan provenance allows an interrupted commit
to finish its confirmation queue without assigning or queuing the person twice.
Closing a proposal releases its unpublished reservations while retaining published
assignments. Explicit duties can be cancelled until 21 days before the start,
with no 30-minute signup grace inside that deadline.

## Storage and access

Proposals are private `rondo_shift_plan` posts. `_planner_data` stores rows,
revision, phase, time range, shift IDs, notice outcomes and publication progress.
Open plans are derived from snapshot phase and replacement links; `_planner_week` prevents a duplicate
normal weekly generation. Per-shift `_shift_plan_id_{person_id}` records provenance.
There are no custom tables or generic WordPress REST routes for this post type.
Its capability map uses `do_not_allow` with meta-cap mapping disabled; access goes
through the dedicated controller and its existing person-visibility checks.

## REST contract

All paths below are relative to `/wp-json/rondo/v1`. They require
`manage_options` or `vrijwilligers` and return `Cache-Control: private, no-store`.

| Method | Path | Contract |
|---|---|---|
| GET | `/volunteer-plans` | Latest 30 visible summaries, `next_at` and `notification_email` |
| POST | `/volunteer-plans` | Refresh one current proposal, retaining valid open choices |
| GET | `/volunteer-plans/{id}` | Revision, phase, rows (including `iva_missing`), coverage, notice outcomes, `publish_more`, `publish_shift_ids` and `superseded_by` |
| GET | `/volunteer-plans/{id}/rows/{index}/candidates` | Current candidates: `person_id`, `name`, opaque `unit`, `remaining` |
| PUT | `/volunteer-plans/{id}/rows/{index}` | Required integer `revision` and nonnegative integer `person_id` |
| POST | `/volunteer-plans/{id}/publish` | Required `revision`; optional nonempty integer array `shift_ids`; `accepted_iva_rows` defaults to `[]`; boolean `accept_conversions`, default false |
| POST | `/volunteer-plans/{id}/close` | Required `revision`; retain existing assignments |

Publication also accepts `accepted_iva_rows`, an array of nonnegative integer row
indices, defaulting to `[]`. Use each row's zero-based `index` from the proposal
response, rather than a person or shift ID. Include every selected pending row
whose `iva_missing` is true. The server checks current IVA status before assigning
any selected row; missing approval returns HTTP 409 `volunteer_plan_invalid`.
If the warning is absent, refresh the proposal before confirming.

Send the approved indices with each continuation request alongside its current
`revision`. The assignment write lock checks IVA approval again. Deselected rows
do not require approval. This approval is separate from `accept_conversions` for
older bar-to-luik proposals.

Proposal errors use `volunteer_plan_invalid`, normally HTTP 409; missing plans
return 404 and unreadable stored data returns 500. Inaccessible people block a
detail response with 403; listing omits plans that cannot be viewed in full.

`VolunteerPlannerTest.php` covers season limits, IVA ranking and warnings, missing
or incorrect approval indices, duty types and old bar-to-luik proposals.
It also covers private drafts, quotas, revisions,
changed requirements, merged drafts and team pairing. Further checks cover
selected-duty publication, recovery, notices and cancellation.
`VolunteerPlannerAvailabilityTest.php` covers training/match margins, unknown
times, stale feeds, missing data and overlaps. `ShiftAssignmentByCoordinatorTest.php`
covers the assigned-duty cancellation deadline.
