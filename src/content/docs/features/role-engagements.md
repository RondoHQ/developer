---
title: Employment and volunteering per role
description: Classify staff roles as employed, paid volunteer or unpaid volunteer, with local storage and counts of current roles.
---

Set a type for each staff role under **Relaties → Rollen**: employee, paid
volunteer or unpaid volunteer. One person can hold several types of role at once.
Roles you have not reviewed stay **Nog niet ingedeeld**.

## Scope and access

A role needs a Rondo team or committee link and a role title. Player roles on teams and configured excluded functions do not qualify.
VOG-exempt committees still qualify. Past roles keep their saved type. Only current roles count in badges and reports.

Administrators, membership administration, volunteer management and users with
finance read access can view role types for people they already have access to.
To change a type, you also need permission to edit that person.
Volunteer or read-only finance access alone does not grant that permission.
The existing former-member editing restrictions still apply.

The profile header shows **Kaderlid** for current classified roles or when the existing
staff flag applies. It adds **Betaald** for an employee role and **Vrijwilligersvergoeding**
for a compensated volunteer role. Both labels can appear together.

## Role keys and storage

`RoleEngagements::role_key()` hashes the linked entity ID, normalized role title
and start date. Reordering or rebuilding Sportlink work-history rows preserves
the saved type. A different role or start date needs a new review.
Duplicate role keys show `can_classify: false`. Resolve the duplicate before you
set a type.

The native `role_engagements` repeater stores `role_key` and `engagement_type`
separately from `work_history`. It is read-only through generic field writes,
including administrator writes. Selecting `unknown` removes that stored mapping.
Changes append `_role_engagement_change` metadata with the actor, timestamp and
before/after values. The source roles remain unchanged.

Rondo does not guess a role’s type from `betaalde_vrijwilliger`. Saving a type
leaves that flag, VOG rules, duty exemptions and payment agreements unchanged.

## REST contract

Authorized person responses include a top-level `role_engagements` object when
`fields.work_history` is present. It contains `roles`, current-category `summary`
counts and an opaque `version` for the history and saved types.
Each role includes its history `index`, `role_key`, `engagement_type`,
`is_current`, `can_classify` and `entity_id`.

Use `PATCH /wp-json/rondo/v1/people/{person_id}/role-engagements` with:

```json
{
  "role_key": "<key from the person response>",
  "engagement_type": "volunteer",
  "version": "<current version from the person response>"
}
```

Types are `unknown`, `employee`, `compensated` and `volunteer`. The response is
the updated role-type object. An Options API lock allows one type change per
person at a time. Invalid types return 400; stale versions, missing or
duplicate roles and busy writes return 409. Refresh and review the role again
after a conflict. A repeated unchanged choice creates no extra audit event.

## Current-role statistics

Volunteer statistics include `role_engagements: {as_of, totals, by_entity}`.
Each category reports both `people` and `roles`; `by_entity` groups these counts
by team or committee. The figures describe current roles, independently of the
season selected for shift statistics, and exclude deceased people.

A person counts once within each category and may appear in several categories.
Adding category person counts therefore does not give a unique club-wide total.
Queries preserve person visibility and return aggregate counts without person IDs.

`RoleEngagementsTest.php` covers role identity, source changes, duplicate roles,
native storage cleanup, audit, real REST permissions and counts of current roles.
