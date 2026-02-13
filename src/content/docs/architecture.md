---
title: "Architecture"
description: "High-level architecture of the Rondo Club WordPress theme."
---

Rondo Club is a React-powered WordPress theme for sports club management.

## Backend

**Entry point:** `functions.php`

The theme initializes on `after_setup_theme` and `plugins_loaded`, loading classes from `includes/`:

| Class | Responsibility |
|-------|---------------|
| `Rondo\Core\PostTypes` | Registers Person, Team, Commissie, and other CPTs |
| `Rondo\Core\Taxonomies` | Registers relationship types and seizoen taxonomy |
| `Rondo\Core\AutoTitle` | Auto-generates post titles |
| `Rondo\Core\AccessControl` | Row-level user data filtering |
| `Rondo\Core\UserRoles` | Registers custom "Rondo User" role |
| `Rondo\REST\Api` | Custom `/rondo/v1/` endpoints |
| `Rondo\Collaboration\CommentTypes` | Notes and Activities system |
| `Rondo\Core\Reminders` | Daily digest reminder system |

ACF field groups are stored as JSON in `acf-json/` for version control.

## Frontend

**Entry point:** `src/main.jsx`

A React SPA with:

- **Routing:** React Router 6 with `ProtectedRoute` wrapper
- **State:** TanStack Query for server state, Zustand for client state
- **API client:** Axios with WordPress nonce injection
- **Two API namespaces:**
  - `/wp/v2/` — Standard WordPress REST (people, teams, commissies)
  - `/rondo/v1/` — Custom endpoints (dashboard, search, timeline)

## Development

```bash
npm run dev      # Vite dev server (port 5173, HMR)
npm run build    # Production build to dist/
npm run lint     # ESLint (max-warnings: 0)
```

The theme auto-detects the Vite dev server when `WP_DEBUG` is enabled. In production, assets load from `dist/` via `manifest.json`.

## Deeper Dives

- **[Frontend Architecture](/architecture/frontend/)** — React app structure, hooks, routing
- **[PHP Autoloading](/architecture/php-autoloading/)** — Class loading system
- **[Relationship System](/architecture/relationship-system/)** — Bidirectional sync architecture
