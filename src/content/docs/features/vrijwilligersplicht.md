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

## Progress and status

`Rondo\Volunteer\VolunteerObligationCalculator::decorate_units()` enriches each unit with
`completed_count`, `pending_count` and `no_show_count`, computed by matching `dienst_shift` posts
whose `assigned_persons` meta intersects the unit's `person_ids` within the season window
(1 July – 30 June).

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

## Exemptions

`VolunteerExemptionResolver` handles per-season exemptions. An exempt member sees an explanatory
card instead of an obligation, and may still volunteer voluntarily. Contributie-vrijstelling is
deliberately *not* an exemption ground here; that runs through the resolver or an honorary role.
