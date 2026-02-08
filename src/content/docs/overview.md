---
title: "Overview"
description: "Developer documentation for the Rondo platform — a sports club management system."
---

Rondo is a platform for managing sports club members, teams, and operations. It consists of two components:

## Rondo Club

A WordPress theme (PHP + React/Vite) that provides a web application for managing people, teams, and important dates. It exposes a REST API for both its own frontend and external consumers.

**Tech stack:** WordPress 6.0+, PHP 8.0+, ACF Pro, React 18, Vite 5, Tailwind CSS, TanStack Query.

## Rondo Sync

A Node.js CLI tool that syncs member data from Sportlink Club into Rondo Club, Laposta (email marketing), and FreeScout (helpdesk).

**Tech stack:** Node.js 18+, Playwright (Chromium), better-sqlite3, Postmark.

## Data Flow

```
Sportlink Club (external) --> Rondo Sync --> Rondo Club WordPress (REST API)
                                         --> Laposta (email marketing)
                                         --> FreeScout (helpdesk)
```

## Next Steps

- **[Architecture](/architecture/)** — High-level Rondo Club system design
- **[Data Model](/data-model/)** — Custom post types, taxonomies, and fields
- **[REST API](/api/rest-api/)** — Rondo Club API reference
- **[Sync Architecture](/sync/architecture/)** — How Rondo Sync works
