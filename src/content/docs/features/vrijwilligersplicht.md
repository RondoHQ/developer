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

## Owing versus being allowed

These are different questions, and conflating them turns willing helpers away.

- `get_eligible_units_for_person()` answers **what is required of you**.
- `may_volunteer()` answers **whether you may claim a shift at all**, and is true for any person who
  is not a `former_member`.

A sponsor, a grandparent, or a parent whose children have aged out owes nothing and may still sign
up. `GET /rondo/v1/my-shifts/available` only refuses oud-leden.

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

## Filtering member shifts by diensttype

The member page at `/vrijwillig` builds its diensttype filter from the `dienst_type_id` and
`dienst_type_name` already included in the available and personal shift responses. The filter
applies to both the **Beschikbaar** and **Mijn diensten** tabs.

The selected post ID is stored in the `diensttype` URL parameter. For example,
`/vrijwillig?diensttype=123` opens the page with diensttype post `123` selected. Removing the filter
also removes the parameter; unrelated URL parameters are preserved.

## Shift coverage calendar

Both `/vrijwilligers/diensten` and the member-facing `/vrijwillig` page use the shared
`ShiftCoverageCalendar` component. It shows the current calendar month and the next two months:

- **Green** means every relevant `dienst_shift` on that date has reached its capacity.
- **Red** means at least one relevant shift still has an open place.
- **Neutral** means no relevant shifts are scheduled on that date.

Cancelled and completed shifts are excluded. Selecting a date reveals its individual shifts. The
manager view links each shift to its edit screen; the signup view exposes the existing signup and
cancellation actions. Colour is always accompanied by text, an icon and an accessible label.

The `diensttype` URL parameter filters the calendar as well as the personal shifts list. With no
filter, a date is green only when every diensttype on that date is full. With a filter, only shifts
of the selected type determine the date status.

Calendar data comes from:

`GET /rondo/v1/shifts/calendar?view=manage|signup&from=YYYY-MM-DD&to=YYYY-MM-DD&dienst_type_id=123`

The requested range is limited to 100 days and interpreted in the WordPress timezone. `view=manage`
requires `manage_options` or `vrijwilligers`. `view=signup` resolves the current user to their linked
person and applies the same VOG, IVA and required-pool gates as the signup endpoint. Full shifts stay
visible so members can understand green dates, but they have `can_signup: false`. Person IDs and
contact details are never returned by the calendar endpoint.

The template expander keeps 93 days of concrete shifts available. This covers every possible
three-calendar-month view, including three consecutive 31-day months.

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
cron runs cannot send duplicates. Failed sends remove their marker and can be retried. Cancelled
assignees are no longer in `assigned_persons` and therefore receive no later messages. No-shows do
not receive the post-shift survey.

The `dienst_type` edit page stores `reminder_email_subject`, `reminder_email_body`,
`survey_email_subject`, `survey_email_body`, and `survey_url`. Empty reminder fields use the built-in
Dutch defaults. The survey is disabled until a valid Google Forms URL is configured. Subjects and
bodies support `{naam}`, `{dienst}`, `{datum}`, `{tijd}`, `{eindtijd}`, and
`{medevrijwilligers}`. The survey URL is rendered as a branded **Vul de enquête in** button.

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
| `skipped_no_leeftijdsgroep` | active members with no spelactiviteit; a Sportlink sync issue |
| `skipped_former_members` | oud-leden, correctly excluded |

Orphan gezinnen need a `relationships` entry before the obligation can ever be discharged. Current
volunteers, honorary members (Donateur, Erelid, Lid van Verdienste, Verenigingslid voor het leven)
and parents with a direct `Kind` relation are deliberately kept out of the
`skipped_no_leeftijdsgroep` bucket — they are *supposed* to have no spelactiviteit.

### Drill-downs

The dashboard's **Datakwaliteit** card links each count to a drill-down that lists the personen
behind it, so a beheerder can fix the underlying records. All drill-downs share one endpoint:

`GET /rondo/v1/volunteer-data-quality/{category}`

| Category | Personen returned |
|---|---|
| `orphan` | JO16- spelers zonder ouder-relatie én zonder volwassen huisgenoot |
| `address_fallback` | spelers + ouders van een gezin dat alleen via adres-overeenkomst is afgeleid |
| `missing_leeftijdsgroep` | actieve leden zonder `leeftijdsgroep`-meta |
| `former_members` | als ex-lid gemarkeerde personen |
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
card instead of an obligation, and may still volunteer voluntarily. Contributie-vrijstelling is
deliberately *not* an exemption ground here; that runs through the resolver or an honorary role.
