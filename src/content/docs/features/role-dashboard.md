---
title: "Role-based dashboard"
---

The dashboard at `/` combines the user's board, coordinator and match-secretary responsibilities. It does not grant additional access to people, team records or finances. Birthdays are a dashboard block; there is no separate birthday navigation item.

## Blocks and permissions

| Responsibility | Dashboard content |
| --- | --- |
| Board | Birthdays, membership anniversaries, season membership changes, volunteer shortages in the next 30 days, VOG attention counts and personal tasks |
| Year-group coordinator | Own open tasks, upcoming birthdays within existing person visibility, assigned teams and current player counts, today's training, assigned teams' matches and cancellations |
| Match secretary | Own open tasks and the club programme: home/away fixtures, cancellations, time, pitch, dressing rooms and freshness |
| Multiple roles | A single combined dashboard, with home/away/own-team filters and deduplicated fixtures |

`RoleDashboard::context()` resolves responsibilities on every request. Coordinator access uses `AccessControl::has_coordinator_team_scope()`; match-secretary access uses the separate `wedstrijdzaken` section capability. Role migration 16 grants that capability to administrators and the existing `rondo_wedstrijdzaken` role. Other custom roles can receive it through the capability matrix. It grants no `teams`, `financieel` or person-access capability.

The `/user/me` response includes `can_access_dashboard`, `dashboard_context` and `can_access_club_dashboard`. Existing broader operational roles retain their previous dashboard. Users eligible for both surfaces can open the previous tools through **Overige overzichten** (`/?overzicht=club`). The legacy and role-dashboard preferences are separate.

### Board scope

The exact `rondo_bestuur` role enables board context; management capabilities alone do not imply that role. Role migration 17 grants the existing `jubilarissen` section capability to the board role. It adds no financial or person-record permissions. A second coordinator role remains recognized even when board permissions bypass age-group filtering.

The default block order is birthdays, anniversaries, personal tasks, membership, volunteers and VOG. Match and team blocks are added only for the corresponding additional roles. Birthdays and tasks are never duplicated. Existing saved layouts are retained; new available blocks are appended. The board heading is **Bestuursdashboard**.

- Birthdays use the personal birthday period (three days by default) and existing person visibility. Three compact rows are shown initially; **Toon alle verjaardagen** reveals the rest.
- Anniversaries require `jubilarissen` and include membership milestones from today through day 89. Native compact and ISO membership dates are both supported. The three earliest are shown, with a link to the existing anniversary page. Volunteer milestones are not mixed into this block.
- Membership requires `ledenadministratie`. All three figures count only playing association members: `type_lid` is `Bondslid` (or `Oud bondslid` for historical season events) and `spelactiviteit` is neither empty nor `-`. The block labels this scope as **Alleen spelende bondsleden**. The current total requires `Bondslid` and excludes former members, future membership starts and ended membership dates. Instroom and uitstroom use `lid_sinds` and `lid_tot` from 1 July through today inclusive, including former playing association members for departures. Classification uses the available person fields; it does not reconstruct missing historical playing activity. Season departures of association members with empty or `-` activity are reported in `membership.left_unknown`; they do not inflate the confirmed outflow, and the UI labels that total incomplete with the excluded count. Future departures are not counted yet. These are date-based current records, not a historical snapshot or a net-growth calculation.
- Volunteer shortages require `vrijwilligers`. Only future published, open/full-status shifts with unfilled capacity within 30 days count. Cancelled, completed, past, full and invalid assignments are excluded; duplicate assignments count once. Totals are calculated before the displayed list is limited. No volunteer names are returned. The lightweight `VolunteerStatistics::upcoming_shortages()` reuses the existing shortage rules without calculating the full season statistics.
- VOG requires `vog`. Counts use `VOGRequirement::get_required_person_ids()`, the same role- and committee-exemption resolver as the VOG overview. They cover visible current volunteers with an active VOG-required role only, excluding former members, and distinguish missing/expired not yet requested, missing/expired requested at Justis, and expiring within 30 days. Native dates pass through the field formatter before comparison; the three-year and 30-day cutoffs match the filtered-people endpoint. The legacy dashboard reuses the same counting service.

**De club in cijfers** uses only visible board blocks and finite counts from the permission-filtered workspace response. It shows playing association members, season arrivals, open volunteer places and missing/expired VOG totals when available. Hiding a block hides its summary count too; missing values are not displayed as zero.

### Layout and branding

The sidebar, top bar and mobile drawer on every page using `Layout` share local Figtree fonts, Rondo logo assets and light/dark colors in `app-shell-brand.css`. Dashboard content styling remains scoped to the role dashboard at `/` through `dashboard-brand.css`, excluding `?overzicht=club`.

With the default board order, two columns group volunteer/VOG attention, tasks and matches on the left and celebrations, membership and teams on the right. Smaller screens collapse the columns. A saved custom order uses one ordered grid, preserving visual and reading order. At widths of 1280px and above, each block occupies half the grid and aligns to its own content height; smaller screens retain responsive layouts. **Aanpassen** can reorder or hide available blocks and choose 1–30 birthday days, including today; the default is three. Preferences use `rondo_role_dashboard_layout` user metadata, separate from the legacy dashboard preferences. Revoked permissions remove unavailable blocks.

Revoking a section capability removes its data and saved layout IDs on the next request. The dashboard grants no access through a preference or hidden block.

### Anniversary access outside the board

Every role-dashboard user with the existing `jubilarissen` section permission can show the membership-anniversary block, including coordinators and match secretaries. The block uses the same 90-day source and existing `AccessControl::can_view_person()` checks as the board view. Granting this section permission does not grant board membership or broaden person visibility; the block may therefore be empty. Removing the permission removes both its data and its available layout entry.

### Coordinator scope

Birthdays include today and the following two club-local dates by default. **Aanpassen → Verjaardagen: aantal dagen** accepts 1–30 days including today. The preference is saved per user, also applies to board birthdays, and resets to three days through **Herstel standaard**. Match windows remain seven days. Each person passes `AccessControl::can_view_person()`, and former members are excluded by the existing reminders source. Person visibility retains the union of allowed age groups and current players in explicitly assigned teams. Birthday links use existing person pages.

Team summaries, training and team-match requests use only `AccessControl::get_permitted_team_ids()`. Household teams are not silently added. An age-group assignment alone does not create team permissions: an administrator must explicitly assign the relevant teams in the existing role configuration.

Player counts exclude former members, historical roles and non-player roles. A person is counted once per team. Shared training blocks return only the permitted team IDs and allowlisted scheduling fields; free-form labels and other teams' names are omitted.

### Tasks

The dashboard returns up to ten open tasks authored by or assigned to the current user, sorted by due date before limiting. Related-person summaries are separately permission checked. Completing or editing a task invalidates both dashboard caches. Activity creation is offered only when the task contains an accessible related person.

## Match data

The club programme reads the existing independently refreshed Sportlink Club.Data cache; team programmes reuse `TeamMatches` and its on-demand cache.

**Wedstrijden deze week** covers today through six days later in the club timezone. Secretaries get home/away tabs with counts; coordinators get **Mijn teams**. A combined role retains club-wide cancellation alerts when the match tab changes.

`DashboardMatchList` filters by day and by words in either team name, ignoring case and accents. Six matches appear per page, with counts and previous/next controls; paging never truncates the underlying week. Changing a filter resets the page. Rows expand to show pitch, location, dressing rooms, result and status. Unknown kickoff times show **N.t.b.**, missing room data shows **Nog niet ingevuld**, and cancellations remain explicit.

The club-week feed merges programme, results and cancellations by match ID. Played matches stay in today's overview when Sportlink moves them from programme to results. Result rows retain available programme pitch/room details; cancellations take precedence. All cached results can contribute to this week, while Club TV still receives at most twelve recent results.

Programme and results requests use a 500-row bound. Reaching it is treated as incomplete and preserves the previous cache. Legacy result caches without `complete: true` require refresh even before their old TTL expires. Week freshness uses all three feeds: `updated_at` is the oldest fetch time, `stale` includes missing completeness, and `expired` means missing data or a fetch older than 24 hours. Failures, unmatched teams and stale feeds produce visible warnings; they do not establish that no games exist.

Overlapping team feeds are deduplicated by match ID in the client. An empty dressing-room value is **Nog niet ingevuld**; an explicit source value such as **0 - geen kleedkamer** is preserved.

## REST API

Workspace and layout routes require an authenticated board member, coordinator or the `wedstrijdzaken` capability; match routes retain their separate role checks. All routes return `Cache-Control: no-store, private`.

| Route | Contract |
| --- | --- |
| `GET /rondo/v1/dashboard/workspace` | `context`, `teams`, `birthdays`, `training`, `has_training_schedule`, `pitches`, `today`, `day`, `end_date`, `tasks`, `layout`, plus section-gated `anniversaries` and permission-gated board fields `membership`, `volunteers`, `vog` |
| `GET /rondo/v1/dashboard/matches` | Club programme; additionally requires `wedstrijdzaken` |
| `GET /rondo/v1/dashboard/matches?team_id=123` | Seven-day programme for an explicitly assigned coordinator team; rejects out-of-scope IDs with 403 and invalid IDs with 400 |
| `POST /rondo/v1/dashboard/layout` | JSON object with `order` and `hidden`, arrays of unique available block IDs, and optional integer `birthday_days` (1–30); invalid preferences receive 400 |

Block IDs are `attention`, `birthdays`, `anniversaries`, `membership`, `volunteers`, `vog`, `matches` and `teams`; availability follows the role and section checks above. The layout response includes `defaults` for the role-specific reset order; it also includes `birthday_days`, defaulting to 3 for existing and new users. Writes that omit `birthday_days` preserve the saved value. Null, strings, fractions and values outside 1–30 return `invalid_birthday_days` without modifying preferences. Preferences live in the user meta `rondo_role_dashboard_layout`. Reads intersect stored IDs with current available blocks and append newly available blocks. Hiding every block is supported. Role revocation removes unavailable data and layout IDs on the next request. Preferences never authorize data access.

The client keys workspace data by user, uses a one-minute stale time, polls club fixtures every minute and team fixtures every five minutes. **Verversen** reloads the workspace and selected match feeds. External fixture requests are separate from the personal workspace request.

Confirmed task changes cancel older in-flight workspace queries and update the cached task list before refresh. Completed or awaiting tasks disappear immediately; an old response or failed refresh cannot restore the confirmed open task. Open-task edits preserve relation metadata and do not insert unrelated tasks. `dashboardTasks.test.mjs` covers these cache races.

## Verification

`BoardDashboardTest` covers board role combinations, capability revocation, membership and anniversary date boundaries, VOG dates, role and committee exemptions, parity with the VOG list counts, and shortage totals. `RoleDashboardTest` covers role combinations and revocation, record boundaries, birthday visibility and inclusive window boundaries, per-user period persistence and validation, permission-gated coordinator anniversaries, current player counts, shared training, private task relations, match-window boundaries, cancellation freshness and role migration. JavaScript tests cover fixture deduplication, room labels and reordering. `tests/fixtures/dashboard-preview.html` renders the real dashboard with clearly labelled synthetic data for narrow-screen, dark-mode, saved-layout and error-state checks.

`roleDashboard.test.mjs` also covers hidden/unknown summary values, saved custom ordering and busy-week pagination with accent-insensitive team filters. `NarrowcastingSportlinkTest` covers full result retention, programme-detail merging, cancellation precedence, freshness and legacy-cache refresh while keeping Club TV limited to twelve results.
