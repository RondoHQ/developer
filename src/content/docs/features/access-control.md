---
title: "Access Control"
---


This document describes the access control system in Rondo Club.

## Overview

Rondo Club uses a **shared access model**: all authenticated users can see and edit all data. On top of this, a role-based permission system controls access to administrative features and specific sections of the application.

**Key principles:**

1. **Authenticated users see everything** - Once logged in, users can view and edit all people, teams, dates, and todos
2. **Trashed posts are hidden** - Posts in the trash are not accessible via the frontend
3. **WP Admin is blocked** - Non-admin users are redirected away from wp-admin
4. **Roles map from Sportlink** - Sportlink "functies" are mapped to Rondo permission roles via the Functie-Capability Map

## WP Admin Blocking

Non-admin users are blocked from accessing the WordPress admin dashboard. This is implemented in `functions.php` via `rondo_block_wp_admin()`.

**Behavior:**
- Non-admin users requesting `/wp-admin/` are redirected to the site homepage
- Exemptions: AJAX requests, WP-CLI, and cron jobs pass through
- Administrators (`manage_options` capability) are never blocked

```php
// Simplified logic
function rondo_block_wp_admin() {
    if ( is_admin() && ! current_user_can( 'manage_options' ) ) {
        // Exempt AJAX, WP-CLI, and cron
        if ( wp_doing_ajax() || defined( 'WP_CLI' ) || wp_doing_cron() ) {
            return;
        }
        wp_safe_redirect( home_url( '/' ) );
        exit;
    }
}
```

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

## Functie-Capability Map

The Functie-Capability Map connects Sportlink "functies" (club-level roles like "Voorzitter", "Penningmeester") to Rondo permission roles. This enables role-based access to specific features without manual user management.

**Class:** `Rondo\Config\FunctieCapabilityMap`

**Methods:**

| Method | Description |
|--------|-------------|
| `get_map()` | Returns the current functie-to-role mapping |
| `update_map( $map )` | Updates the mapping (admin only) |
| `get_roles_for_functie( $functie )` | Returns Rondo roles for a given Sportlink functie |

**REST Endpoints:**

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/rondo/v1/functie-capability-map` | Admin | Get current mapping |
| POST | `/rondo/v1/functie-capability-map` | Admin | Update mapping |

**UI:** Configured in **Settings > Beheer > Functies** tab (FunctiesTab component).

**Example mapping:**

```json
{
  "Voorzitter": ["admin"],
  "Penningmeester": ["financieel"],
  "Secretaris": ["admin"],
  "Wedstrijdsecretaris": ["wedstrijdzaken"]
}
```

When a member is synced from Sportlink with an active functie, the system looks up the corresponding Rondo roles and applies the appropriate capabilities to their WordPress user account.

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
