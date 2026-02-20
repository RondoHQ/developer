---
title: "Access Control"
---


This document describes the access control system in Rondo Club.

## Overview

Rondo Club uses a simple **shared access model**: all authenticated users can see and edit all data. This makes it ideal for teams that collaborate on the same contact database.

**Key principles:**

1. **Authenticated users see everything** - Once logged in, users can view and edit all people, teams, dates, and todos
2. **Trashed posts are hidden** - Posts in the trash are not accessible via the frontend

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

## Security Considerations

1. **All access control is enforced server-side** - Never trust client-side checks
2. **REST API is protected** - Unauthenticated users receive 403 errors

## Related Documentation

- [Multi-User System](./multi-user.md) - User management
- [Data Model](./data-model.md) - Post types and field definitions
- [REST API](./rest-api.md) - API endpoints
