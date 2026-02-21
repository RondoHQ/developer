---
title: "Architecture"
description: "High-level architecture of the Rondo Club WordPress theme."
---

Rondo Club is a React-powered WordPress theme for sports club management.

## Backend

**Entry point:** `functions.php`

The theme initializes on `after_setup_theme` and `plugins_loaded`, loading 65+ classes from `includes/`, organized by domain:

**Core:**

| Class | Responsibility |
|-------|---------------|
| `PostTypes` | Registers Person, Team, Commissie, Todo, Feedback, Discipline Case, Invoice CPTs |
| `Taxonomies` | Registers relationship types and seizoen taxonomy |
| `AutoTitle` | Auto-generates post titles |
| `AccessControl` | Row-level user data filtering |
| `UserRoles` | Registers custom "Rondo User" role |
| `ClubConfig` | Club-level configuration (Sportlink credentials, etc.) |
| `CredentialEncryption` | Encrypts sensitive stored credentials |
| `Reminders` | Daily digest reminder system |
| `CommentTypes` | Notes and Activities system |
| `Mentions` / `MentionNotifications` | @mention parsing and notification delivery |
| `VolunteerStatus` | Computes `huidig-vrijwilliger` from work history |
| `InverseRelationships` | Bidirectional relationship sync |
| `UserProvisioning` | Creates WordPress accounts from person records |
| `FunctieCapabilityMap` | Maps Sportlink functies to Rondo roles |

**REST API:**

| Class | Responsibility |
|-------|---------------|
| `RestApi` | Main `/rondo/v1/` endpoints (dashboard, search, fees, settings) |
| `RestPeople` | Person-specific REST enhancements (computed fields, filtering) |
| `RestTeams` | Team-specific REST enhancements |
| `RestInvoices` | Invoice CRUD, PDF, email, payment, installment endpoints |
| `RestCommissies` | Commissie REST enhancements |
| `RestTodos` | Todo REST enhancements |
| `RestFeedback` | Feedback REST endpoints |
| `RestCustomFields` | User-defined custom fields REST endpoints |
| `RestGoogleSheets` | Google Sheets export endpoints |
| `RestImportExport` | Demo import/export endpoints |

**Finance & Payments:**

| Class | Responsibility |
|-------|---------------|
| `MembershipFees` | Fee calculation, categories, family discounts, snapshots |
| `FeeCacheInvalidator` | Clears fee snapshots when relevant data changes |
| `FinanceConfig` | Finance settings (email templates, payment terms, installment config) |
| `InvoiceNumbering` | Sequential invoice numbers with type-specific prefixes |
| `InvoicePdfGenerator` | PDF generation for invoices |
| `InvoiceEmailSender` | Invoice email delivery |
| `BulkInvoiceCreator` | Batch invoice creation from fee calculations |
| `MollieClient` | Mollie payment gateway client |
| `MolliePayment` | Payment creation and management |
| `MollieWebhook` | Public webhook for payment status updates |
| `PublicPaymentPage` | Public payment page (no auth required) |
| `QrCodeGenerator` | QR codes for payment links |
| `InstallmentPaymentService` | Installment plan management |
| `InstallmentEmailSender` | Installment reminder emails |
| `InstallmentScheduler` | Scheduled installment processing |
| `RabobankOauth` / `RabobankPayment` | Rabobank payment integration |

**Integrations:**

| Class | Responsibility |
|-------|---------------|
| `IcalFeed` | iCal calendar feed generation |
| `CarddavServer` | CardDAV server for contact sync |
| `CaldavProvider` | CalDAV calendar provider |
| `CalendarMatcher` | Matches calendar events to people |
| `GoogleOauth` / `GoogleSheetsConnection` | Google API integration |
| `VogEmail` | VOG request email sending |
| `VcardExport` | vCard contact export |

**Demo System:**

| Class | Responsibility |
|-------|---------------|
| `DemoAnonymizer` | Anonymizes data for demo exports |
| `DemoExport` / `DemoImport` | Demo data export/import |
| `DemoProtection` | Prevents destructive operations in demo mode |

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
