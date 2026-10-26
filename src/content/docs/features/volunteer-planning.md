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
**Nieuw voorstel / gaten aanvullen** creates an additional proposal on demand.
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
to propose replacements. This creates another reviewable proposal. The person
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
shifts come first, then earlier dates. Candidate scoring prefers the season-half
target, lower fulfilled share, lower personal load and a stable weekly tie-break.
Pending proposals reserve both quota and time across open plans.

VOG, IVA and required-commissie checks reuse `ShiftSignupEligibility`. Existing
assignments and proposals block overlapping intervals. For a current player team,
`PlannerAvailability` also checks the active training schedule and team match feed:

| Source | Blocked time |
|---|---|
| Training | Training duration plus 30 minutes before and after |
| Match with known time and duration | Match duration plus two hours before and after |
| Match with unknown time or duration | The whole match day |
| Provisional matchday | Its recorded date interval |

Missing current player-team data for age groups 17 and older, missing season/team
training, and missing, stale or unmatched current-season match feeds block selection.
Cancelled matches do not block. Parents without a current player-team role do not
inherit their children's team schedule. Unfilled rows show issues and aggregate
blocking reasons; missing information never becomes assumed availability.

If an empty IVA-required shift has no eligible candidate, the planner can propose
conversion to the unique published non-IVA diensttype whose name contains `luik`.
The proposal does not alter the shift. Publication requires explicit
`accept_conversions: true` and rechecks that conversion is still possible.

## Review and publication

Coordinators can choose a currently valid replacement candidate or leave a pending
row open with `person_id: 0`. Candidate reads and publication rebuild eligibility.
Editing, publishing and closing require the current `revision`; stale revisions
return HTTP 409. A 15-minute option lock serializes planner mutations.

Publication processes at most ten selected rows per request. Each row rechecks the
shift snapshot, current obligation, certificates, availability, capacity and status
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
revision, phase, time range, shift IDs, notice outcomes and publication progress;
`_planner_phase` supports open-plan queries and `_planner_week` prevents a duplicate
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
| POST | `/volunteer-plans` | Generate an additional proposal and return its view |
| GET | `/volunteer-plans/{id}` | Revision, phase, rows, coverage, notice outcomes and `publish_more` |
| GET | `/volunteer-plans/{id}/rows/{index}/candidates` | Current candidates: `person_id`, `name`, opaque `unit`, `remaining` |
| PUT | `/volunteer-plans/{id}/rows/{index}` | Required integer `revision` and nonnegative integer `person_id` |
| POST | `/volunteer-plans/{id}/publish` | Required `revision`; boolean `accept_conversions`, default false |
| POST | `/volunteer-plans/{id}/close` | Required `revision`; retain existing assignments |

Proposal errors use `volunteer_plan_invalid`, normally HTTP 409; missing plans
return 404 and unreadable stored data returns 500. Inaccessible people block a
detail response with 403; listing omits plans that cannot be viewed in full.

`VolunteerPlannerTest.php` covers private drafts, quotas, revisions, conversion,
changed requirements, chunked publication, recovery, notifications and cancellation.
`VolunteerPlannerAvailabilityTest.php` covers training/match margins, unknown
times, stale feeds, missing data and overlaps. `ShiftAssignmentByCoordinatorTest.php`
covers the assigned-duty cancellation deadline.
