---
title: "Access Control"
---


This document describes the access control system in Rondo Club.

## Overview

Rondo Club uses a mostly shared access model: authenticated users can see and edit all people and teams, with task-specific visibility rules for todos. On top of this, a role-based permission system controls access to administrative features and specific sections of the application.

**Key principles:**

1. **Authenticated users share core data** - Once logged in, users can view and edit all people, teams, and dates
2. **Todo visibility is scoped** - Users only see todos they created or todos assigned to them
3. **Trashed posts are hidden** - Posts in the trash are not accessible via the frontend
4. **WP Admin is blocked** - Non-admin users are redirected away from wp-admin
5. **Roles map from Sportlink** - Sportlink "functies" are mapped to Rondo permission roles via the Functie-Capability Map

## Implementation

The access control system is implemented in `includes/class-access-control.php` via the `AccessControl` class.

### Controlled Post Types

Access control applies to these post types:

- `person` - Contact records
- `team` - Team/company records
- `rondo_todo` - Todo items

Standard WordPress posts and pages are not affected.

### Hook Points

The class intercepts data access at multiple levels:

| Hook | Purpose |
|------|---------|
| `pre_get_posts` | Blocks unauthenticated users from seeing any posts |
| `rest_{post_type}_query` | Blocks unauthenticated users from REST API list queries |
| `rest_prepare_{post_type}` | Verifies authentication for single item REST access |

### Todo Visibility Rule

For post type `rondo_todo`, list and single-item access use this rule:

- Creator visibility: `post_author = current_user`
- Assignee visibility: post meta `assigned_user_id = current_user`

This lets a user assign a todo to another user while still keeping the todo visible for themselves.

### Access Check Methods

**Check if user can access a specific post:**

```php
$access_control = new Rondo\Core\AccessControl();
$can_access = $access_control->user_can_access_post( $post_id, $user_id );
// Returns false if: user not logged in, post trashed, or post doesn't exist
```

**Get permission level:**

```php
$permission = $access_control->get_user_permission( $post_id, $user_id );
// Returns: 'owner' (if user created the post), 'editor' (if logged in but not author), or false
```

## Bypassing Access Control

Internal system code can bypass access control using `suppress_filters`:

```php
$query = new WP_Query([
    'post_type' => 'person',
    'suppress_filters' => true, // Bypasses pre_get_posts
]);
```

## Person visibility

`AccessControl::can_view_person( $person_id, $user_id )` is the **single authority** on who may see
which person. Three tiers:

| Tier | Who | Sees |
|---|---|---|
| Management | A capability in `AGE_GROUP_BYPASS_CAPS` | Everyone |
| Coordinator | A role with a non-empty `rondo_age_group_access` entry | Their configured age groups |
| Scoped member | Everyone else | Themselves, plus their children under 18 |

Every enforcement point routes through it — the REST collection filter (`rest_person_query`), the
single-item filter (`rest_prepare_person`), the raw-SQL `/rondo/v1/people/filtered` endpoint, and
`user_can_access_post()`. **Do not re-derive the rule anywhere else.** The narrowing itself lives in
one private helper, `person_scope()`, used by both the REST and `pre_get_posts` paths.

:::caution[The React router is navigation, not authorization]
`KaderOrVrijwilligRedirect` in `router.jsx` decides what a user is *shown*. It decides nothing about
what they can *fetch*. Any new person-facing surface must be gated server-side as well.
:::

A child falls out of their parent's view at 18. A person with no usable birthdate is treated as an
adult: the check fails closed rather than exposing a record on a missing field. Note that ACF
`date_picker` stores `Ymd`, not `Y-m-d`.

### Field scope

A scoped member reads an **allowlisted** subset of the ACF payload
(`MEMBER_VISIBLE_ACF_FIELDS`) — name, contact details, address, membership dates, leeftijdsgroep,
VOG date. Withheld: `financiele-blokkade`, `wacht_op_overschrijving`, `freescout-id`. The list is an
allowlist on purpose, so an ACF field added later is private until someone consciously exposes it.

Writes stay closed: `restrict_person_editing()` maps `edit_post` to `do_not_allow` for anyone
failing `can_edit_people()`, and members never pass it.

### Notes, activities and timeline

`user_can_access_post()` backs the permission callback for `/rondo/v1/people/{id}/notes`,
`/activities` and `/timeline`. Until 33.30.0 it returned `true` for any logged-in user on any
person, so those routes were effectively unguarded. They now obey `can_view_person()`.

## Age-group narrowing

`AccessControl::get_permitted_age_groups()` returns one of three things, and the distinction
matters:

| Return | Meaning | Who |
|---|---|---|
| `null` | No restriction — sees everyone | Users with a management capability (`manage_options`, `fairplay`, `vog`, `financieel`, `toegangscontrole`, `manage_clothing`) |
| `[]` | Scoped to their own household | Any other user, including plain members |
| `['Onder 11', …]` | Sees only these age groups | A role listed in the `rondo_age_group_access` option, e.g. a coordinator |

Non-management users **default to deny**: an unconfigured role reaches no people beyond its own
household.

:::caution[Granting a coordinator `vog` or `fairplay` voids their age-group scoping]
Both are in `AGE_GROUP_BYPASS_CAPS`, so `get_permitted_age_groups()` returns `null` and the
coordinator sees every person in the club. Their `rondo_age_group_access` entry becomes dead
configuration. Check the capability matrix before assuming a coordinator is scoped.
:::

### `suppress_age_group`

The Kaderlijst rebuild passes `?suppress_age_group=1` to `/wp/v2/people` so a coordinator can see
kader outside their own age group. This is honoured **only for users whose permitted list is
non-empty** — that is, configured coordinators. Guard with
`AccessControl::can_suppress_age_group()`.

:::danger[Never gate this on `is_user_logged_in()`]
Until 33.28.2 the flag was granted to any logged-in user. Because non-management users default to
`[]` ("see nobody"), the flag inverted default-deny into "see everybody": a plain member could read
all person records, with ACF, in one request. Regression-tested in `AgeGroupAccessTest`.
:::

Management users are unrestricted already, so `can_suppress_age_group()` returns `false` for them —
there is nothing to suppress.

## User Roles

Rondo Club creates a custom user role called **"Rondo User"** (`rondo_user`) on theme activation.

**Capabilities:**

- `read` - Required for WordPress access
- `edit_posts` - Create and edit posts
- `publish_posts` - Publish posts
- `delete_posts` - Delete posts
- `edit_published_posts` - Edit published posts
- `delete_published_posts` - Delete published posts
- `upload_files` - Upload files (photos, logos)

**What Rondo Users cannot do:**

- Manage other users
- Access WordPress admin settings
- Install plugins or themes

The role is removed on theme deactivation (users are reassigned to Subscriber).

## WP Admin Blocking

Non-admin users are blocked from accessing the WordPress admin panel (`/wp-admin/`). When a user without `manage_options` capability navigates to any wp-admin URL, they are immediately redirected to the app home page.

### How It Works

A function hooked to `admin_init` checks whether the current user has the `manage_options` capability. If not, the user is redirected via `wp_safe_redirect()`.

### Exemptions

The following request types are exempt from the redirect:

| Request Type | Detection | Why Exempt |
|-------------|-----------|------------|
| AJAX | `wp_doing_ajax()` | admin-ajax.php serves frontend AJAX requests and lives under /wp-admin/ |
| WP-CLI | `defined( 'WP_CLI' )` | CLI commands should never be redirected |
| Cron | `defined( 'DOING_CRON' )` | Scheduled tasks must run unimpeded |
| Administrators | `current_user_can( 'manage_options' )` | Admins need full wp-admin access |

### REST API

The WordPress REST API is **not affected** by admin blocking. REST requests do not go through `admin_init` (they use `rest_api_init` instead), so no exemption is needed.

### Implementation

The blocking function is `rondo_block_wp_admin()` in `functions.php`, hooked to `admin_init`.

## Functie-to-Role Mapping

Administrators can configure which Sportlink Functies (job titles from work history) automatically grant which Rondo WordPress roles. This configuration is used by Phase 206 (Capability Sync) during rondo-sync runs to grant or revoke roles.

### Overview

- Admin navigates to **Settings > Beheer > Functies**
- A checkbox matrix shows all known Functies as rows and all Rondo roles as columns
- Checking a cell means "this Functie grants this role"
- A Functie can grant multiple roles simultaneously
- Functies are populated automatically from `work_history.job_title` data in the database — admins never type them manually

### Data Model

Stored in WordPress options as a nested associative array:

```php
// Option key: rondo_functie_capability_map
[
    'Trainer'        => [ 'rondo_user' => true,  'rondo_fairplay' => false, 'rondo_vog' => false, 'rondo_bestuur' => false ],
    'Penningmeester' => [ 'rondo_user' => true,  'rondo_fairplay' => false, 'rondo_vog' => false, 'rondo_bestuur' => true  ],
]
```

Only roles checked `true` are considered granted — entries with `false` are ignored by `get_roles_for_functie()`.

### REST API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/rondo/v1/functie-capability-map` | Admin | Returns `{ map, roles }` — current mapping and all Rondo role definitions |
| `POST` | `/rondo/v1/functie-capability-map` | Admin | Accepts `{ map: {...} }`, persists and returns updated `{ map, roles }` |

**GET response example:**

```json
{
  "map": {},
  "roles": [
    { "slug": "rondo_user",     "label": "Rondo User" },
    { "slug": "rondo_fairplay", "label": "Rondo FairPlay" },
    { "slug": "rondo_vog",      "label": "Rondo VOG" },
    { "slug": "rondo_bestuur",  "label": "Rondo Bestuur" }
  ]
}
```

### PHP Usage

The `FunctieCapabilityMap` class lives in `includes/class-functie-capability-map.php` under the `Rondo\Config` namespace.

```php
// Get the full mapping
$map = \Rondo\Config\FunctieCapabilityMap::get_map();

// Get role slugs granted by a specific Functie
$roles = \Rondo\Config\FunctieCapabilityMap::get_roles_for_functie('Trainer');
// Returns e.g. ['rondo_user', 'rondo_fairplay'] — only truthy entries

// Persist an updated mapping
\Rondo\Config\FunctieCapabilityMap::update_map($map);
```

This is the primary integration point for **Phase 206 (Capability Sync)**: for each user's active Functies, call `get_roles_for_functie()` to determine which roles they should have.

### UI: Settings > Beheer > Functies

The `FunctiesTab` component in `src/pages/Settings/Settings.jsx` renders the checkbox matrix:

- **Rows:** Union of Functies from `/rondo/v1/werkfuncties/available` and keys already in the saved map, sorted alphabetically
- **Columns:** All Rondo roles from `/rondo/v1/functie-capability-map` response
- **Stale Functies:** If a Functie exists in the saved map but is no longer returned by the available endpoint, the row still appears with the label `(niet meer actief)` in gray italic

### Stale Functies

When a Functie is removed from Sportlink (and no longer appears in work history), its row remains visible in the matrix with a `(niet meer actief)` label. This allows admins to review and clean up stale mappings. The mapping itself is preserved until the admin explicitly unchecks and saves.

### Finance Settings Access

Users with the `financieel` role can access **Financien > Instellingen** (financial settings). Previously this was restricted to administrators only.

## Security Considerations

1. **All access control is enforced server-side** - Never trust client-side checks
2. **REST API is protected** - Unauthenticated users receive 403 errors
3. **WP Admin is blocked** - Non-admin users cannot access the WordPress dashboard

## Related Documentation

- [Multi-User System](./multi-user.md) - User management and provisioning
- [User Provisioning](./user-provisioning.md) - Creating WordPress accounts for members
- [Data Model](./data-model.md) - Post types and field definitions
- [REST API](../api/rest-api.md) - API endpoints
