---
title: Work history and inactive roles
---

Rondo stores a person's team and committee roles in the native `work_history` repeater. REST uses canonical `team_id`, `job_title`, `start_date`, `end_date` and `is_current`; the storage layer keeps the compatible `team` key and compact dates.

## Inactive roles without an end date

An explicit `is_current: false` with an empty or null `end_date` means a historical role whose end date is unknown. It is not a current assignment. Keep the team relationship, role title and start date; do not invent an end date or remove the history.

`Rondo\Core\WorkHistory::is_inactive_without_end_date()` applies this exclusion before existing date rules in team and committee rosters, member counts, household teams, My Team, fee matching, volunteer status and exemptions, role lookup, guest-pass eligibility and staff lists. The React Kaderlijst applies the same rule. Consumers retain their existing handling of explicitly dated roles, including their end-day boundaries. Callers creating a current undated role must explicitly supply `is_current: true`.

Sportlink may return `Status: INACTIVE` with no `RelationEnd`, particularly for club-team memberships. Rondo Sync preserves that inactive status. Its reconciliation signature includes `is_current`, so a status-only correction updates the existing period and a second import makes no further change.

Fee and staff-list caches are versioned to prevent old current-role results surviving this rule change. Existing invoices are not rewritten.
