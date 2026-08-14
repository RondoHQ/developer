---
title: "Frontend Architecture"
---


This document describes the React Single Page Application (SPA) that powers the Rondo Club frontend.

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18 | UI library |
| React Router | 6 | Client-side routing |
| TanStack Query | Latest | Server state management and caching |
| Axios | Latest | HTTP client |
| Tailwind CSS | 3.4 | Styling |
| Vite | 5.0 | Build tool and dev server |

## Directory Structure

```
src/
├── api/
│   └── client.js         # Axios instance and API helpers
├── components/
│   ├── import/           # Import wizard components
│   └── layout/           # Layout wrapper component
├── constants/
│   └── app.js            # Application-wide constants
├── hooks/                # Custom React hooks
├── pages/                # Route page components
│   ├── Commissies/       # Committee list and detail
│   ├── Contributie/      # Fee overview, member list, not-yet-invoiced
│   ├── DisciplineCases/  # Discipline cases list
│   ├── Feedback/         # Feedback list and detail
│   ├── Finance/          # Invoice list, invoice detail, finance settings
│   ├── People/           # People list and detail
│   ├── Settings/         # App settings, relationship types, custom fields
│   ├── Teams/            # Team list and detail
│   ├── Todos/            # Todo list
│   └── VOG/              # VOG certificate tracking
├── utils/                # Utility functions
├── App.jsx               # Main routing component
├── main.jsx              # Application entry point
└── index.css             # Global styles (Tailwind imports)
```

## Global Styling Conventions

Shared visual styles are defined in `src/index.css` to keep page components consistent.

- **Heading typography**
  - `h1` and `h2` default to Montserrat with a stronger title weight.
  - Brand gradient heading treatment is applied through `h1.text-brand-gradient`, `h2.text-brand-gradient`, or `.brand-heading`.
  - Use `.heading-plain` to explicitly opt out of gradient text on detail/legal contexts.
- **Cards**
  - Use the shared `.card` class for standard content containers.
  - `.card` includes the light neutral surface, subtle border/shadow, and a 3px brand gradient top accent.
  - Hover states are defined centrally so card interactions remain consistent across pages.
- **Wide data tables**
  - The people list uses `FloatingHorizontalScrollbar` to mirror its native horizontal scroll position while the bottom of the table is outside the viewport.
  - The floating scrollbar observes both the table size and the nested desktop `<main>` scroll container, and automatically disappears when the native scrollbar becomes visible.
  - Horizontal table containers use `data-horizontal-scroll="true"` for shared momentum scrolling and pull-to-refresh coordination.
  - Do not restrict these containers to `touch-action: pan-x`: mobile pages use document-level vertical scrolling, so a vertical gesture that starts on a table must remain available to the page.

## Entry Points

### `src/main.jsx`

Application bootstrap:
- Creates React root with StrictMode
- Configures TanStack Query client
- Wraps app in BrowserRouter and QueryClientProvider

```jsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});
```

### `src/App.jsx`

Main routing component:
- Defines all application routes
- Implements `ProtectedRoute` wrapper for authentication
- Wraps protected routes in `Layout` component

### `src/components/layout/Layout.jsx`

Application shell behavior:
- Uses document-level scrolling on mobile and a fixed viewport-height shell with a scrollable `<main>` region on desktop.
- Uses dynamic viewport units (`dvh`) and subtracts a CSS admin-bar offset variable (`--rondo-admin-bar-offset`) so mobile pages can scroll to the real end even when the WordPress admin bar is visible.
- Applies `min-h-0` on nested flex containers to prevent content clipping in long detail pages.
- Applies extra mobile bottom padding on `<main>` (including `env(safe-area-inset-bottom)`) so pages with long content remain reachable above mobile browser chrome and fixed bottom UI elements.

## Routing

### Route Structure

| Path | Component | Description | Access |
|------|-----------|-------------|--------|
| `/login` | `Login` | Public login page | Public |
| `/` | `Dashboard` | Home dashboard | Auth |
| `/people` | `PeopleList` | Leden, ouders en externe contacten | Auth |
| `/people/:id` | `PersonDetail` | View contact | Auth |
| `/teams` | `TeamsList` | Team list | Auth |
| `/teams/:id` | `TeamDetail` | View team | Auth |
| `/commissies` | `CommissiesList` | Committee list | Auth |
| `/commissies/:id` | `CommissieDetail` | Committee detail | Auth |
| `/todos` | `TodosList` | Todo list | Auth |
| `/feedback` | `FeedbackList` | Feedback list | Auth |
| `/feedback/:id` | `FeedbackDetail` | Feedback detail | Auth |
| `/vog` | `VOG` | VOG certificate tracking | VOG capability |
| `/vog/:tab` | `VOG` | VOG tab view | VOG capability |
| `/tuchtzaken` | `DisciplineCasesList` | Discipline cases | Fairplay capability |
| `/financien/contributie` | `Contributie` | Fee overview | Financieel capability |
| `/financien/contributie/:tab` | `Contributie` | Fee tab view | Financieel capability |
| `/financien/facturen` | `Facturen` | Invoice list | Financieel capability |
| `/financien/facturen/:id` | `FactuurDetail` | Invoice detail | Financieel capability |
| `/financien/instellingen` | `FinanceSettings` | Finance configuration | Financieel capability |
| `/settings` | `Settings` | Settings page | Auth |
| `/settings/:tab` | `Settings` | Settings tab | Auth |
| `/settings/relationship-types` | `RelationshipTypes` | Manage relationship types | Auth |
| `/settings/custom-fields` | `CustomFields` | Custom field management | Auth |
| `/settings/feedback` | `FeedbackManagement` | Feedback settings | Auth |

**Capability-based route guards:** Routes under `/financien/` require `financieel` capability, `/vog` requires VOG capability, and `/tuchtzaken` requires fairplay capability. These are enforced by `CapabilityRoute` wrapper components (`FinancieelRoute`, `VOGRoute`, `FairplayRoute`).

### Authentication

The `ProtectedRoute` component checks authentication state:
- Shows loading spinner while checking
- Redirects to `/login` if not authenticated
- Renders children if authenticated

```jsx
function ProtectedRoute({ children }) {
  const { isLoggedIn, isLoading } = useAuth();
  
  if (isLoading) return <LoadingSpinner />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  
  return children;
}
```

## API Client

### `src/api/client.js`

Configures Axios for WordPress REST API communication.

**Configuration:**
```jsx
const api = axios.create({
  baseURL: config.apiUrl || '/wp-json',
  headers: {
    'Content-Type': 'application/json',
    'X-WP-Nonce': config.nonce || '',
  },
});
```

**Interceptors:**
- **Request:** Updates nonce from `window.rondoConfig` before each request
- **Response:** Handles 401 (redirect to login) and 403 (log error)

### API Helpers

Two exported objects wrap common API calls:

**`wpApi`** - WordPress standard endpoints:
```js
wpApi.getPeople(params)
wpApi.getPerson(id, params)
wpApi.createPerson(data)
wpApi.updatePerson(id, data)
wpApi.deletePerson(id)
// ... similar for teams, dates, taxonomies
```

**`prmApi`** - Custom PRM endpoints:
```js
prmApi.getDashboard()
prmApi.search(query)
prmApi.getReminders(daysAhead)
prmApi.getCurrentUser()
prmApi.sideloadGravatar(personId, email)
prmApi.uploadPersonPhoto(personId, file)
// ... and more
```

## WordPress Configuration

The app receives configuration from WordPress via `window.rondoConfig`:

```js
window.rondoConfig = {
  apiUrl: '/wp-json',
  nonce: 'abc123...',
  isLoggedIn: true,
  userId: 1,
  loginUrl: '/wp-login.php',
  logoutUrl: '/wp-login.php?action=logout',
  siteName: 'My CRM',
};
```

This is injected by `functions.php` during page load.

## Custom Hooks

### `useAuth` (`src/hooks/useAuth.js`)

Returns authentication state from WordPress config:
```js
const { isLoggedIn, userId, loginUrl, logoutUrl, isLoading } = useAuth();
```

### `usePeople` (`src/hooks/usePeople.js`)

People data hooks with TanStack Query:

| Hook | Purpose |
|------|---------|
| `usePeople(params)` | Fetch all people (paginated) |
| `usePerson(id)` | Fetch single person |
| `usePersonTimeline(id)` | Fetch person's timeline |
| `usePersonDates(id)` | Fetch person's dates |
| `useCreatePerson()` | Create person mutation |
| `useUpdatePerson()` | Update person mutation |
| `useDeletePerson()` | Delete person mutation |
| `useCreateNote()` | Create note mutation |
| `useDeleteNote()` | Delete note mutation |
| `useCreateActivity()` | Create activity mutation |
| `useDeleteDate()` | Delete date mutation |

**Query Key Structure:**
```js
peopleKeys = {
  all: ['people'],
  lists: () => [...all, 'list'],
  list: (filters) => [...lists(), filters],
  details: () => [...all, 'detail'],
  detail: (id) => [...details(), id],
  timeline: (id) => [...detail(id), 'timeline'],
  dates: (id) => [...detail(id), 'dates'],
};
```

### `useDashboard` (`src/hooks/useDashboard.js`)

Dashboard and utility hooks:

| Hook | Purpose |
|------|---------|
| `useDashboard()` | Fetch dashboard summary |
| `useReminders(daysAhead)` | Fetch upcoming reminders |
| `useSearch(query)` | Global search (min 2 chars) |

### `useDocumentTitle` (`src/hooks/useDocumentTitle.js`)

Document title management:

| Hook | Purpose |
|------|---------|
| `useDocumentTitle(title)` | Set specific page title |
| `useRouteTitle(customTitle)` | Auto-set title based on route |

### `useWorkspaces` (`src/hooks/useWorkspaces.js`)

Workspace and sharing hooks for multi-user collaboration:

| Hook | Purpose |
|------|---------|
| `useWorkspaces()` | Fetch all workspaces for current user |
| `useWorkspace(id)` | Fetch single workspace with members |
| `useCreateWorkspace()` | Create workspace mutation |
| `useUpdateWorkspace()` | Update workspace mutation |
| `useDeleteWorkspace()` | Delete workspace mutation |
| `useAddWorkspaceMember()` | Add member to workspace |
| `useRemoveWorkspaceMember()` | Remove member from workspace |
| `useUpdateWorkspaceMember()` | Update member role |
| `useWorkspaceInvites(workspaceId)` | Fetch pending invites |
| `useCreateWorkspaceInvite()` | Create and send invite |
| `useRevokeWorkspaceInvite()` | Revoke pending invite |
| `useValidateInvite(token)` | Validate invite token (public) |
| `useAcceptInvite()` | Accept invite and join workspace |

**Query Key Structure:**
```js
['workspaces']                          // List all workspaces
['workspaces', id]                      // Single workspace
['workspaces', workspaceId, 'invites']  // Workspace invites
['invite', token]                       // Invite validation
```

### `useSharing` (`src/hooks/useSharing.js`)

Direct sharing hooks for sharing individual posts with specific users:

| Hook | Purpose |
|------|---------|
| `useShares(postType, postId)` | Fetch users a post is shared with |
| `useAddShare()` | Share post with a user mutation |
| `useRemoveShare()` | Remove share from a user mutation |
| `useUserSearch(query)` | Search users for sharing (min 2 chars) |

**Query Key Structure:**
```js
['shares', postType, postId]  // Shares for a specific post
['users', 'search', query]    // User search results
```

**Usage Example:**
```js
const { data: shares } = useShares('people', personId);
const addShare = useAddShare();
const removeShare = useRemoveShare();
const { data: users } = useUserSearch('john');

// Add a share
await addShare.mutateAsync({
  postType: 'people',
  postId: 123,
  userId: 456,
  permission: 'view' // or 'edit'
});

// Remove a share
await removeShare.mutateAsync({
  postType: 'people',
  postId: 123,
  userId: 456
});
```

### `useVersionCheck` (`src/hooks/useVersionCheck.js`)

Version checking for PWA/mobile app cache invalidation:

```js
const { hasUpdate, currentVersion, latestVersion, reload, checkVersion } = useVersionCheck({
  checkInterval: 15 * 60 * 1000, // Check every 15 minutes (default)
});
```

| Property | Type | Description |
|----------|------|-------------|
| `hasUpdate` | boolean | True when a new version is available |
| `currentVersion` | string | Version loaded with the current page |
| `latestVersion` | string | Latest version from server (when update available) |
| `reload` | function | Triggers a page reload to get new version |
| `checkVersion` | function | Manually trigger a version check |

**Check triggers:**
- Initial fallback check 60 seconds after mount
- Periodic check every 15 minutes (configurable)
- When the tab becomes visible and the configured interval has elapsed
- Concurrent checks are deduplicated

**Backend endpoint:** `/rondo/v1/version` returns `{ version: "1.42.0" }`

## Utility Functions

### `src/utils/formatters.js`

| Function | Purpose |
|----------|---------|
| `decodeHtml(html)` | Decode HTML entities |
| `getTeamName(team)` | Get decoded team name |
| `getPersonName(person)` | Get decoded person name |
| `getPersonInitial(person)` | Get first initial for avatars |
| `sanitizePersonAcf(acfData, overrides)` | Sanitize ACF data for API |

## Constants

### `src/constants/app.js`

```js
export const APP_NAME = 'Rondo Club';
```

## State Management

### Server State (TanStack Query)

All server data is managed via TanStack Query:
- **Automatic caching** - 5 minute stale time by default
- **Cache invalidation** - Mutations explicitly invalidate or refresh related queries
- **Background refetching** - Data stays fresh
- **Loading/error states** - Handled consistently

The global query client disables refetching when a cached query remounts. A mutation that changes data shown on another route must therefore refresh that inactive destination query before navigation. For volunteer calendars, use `refreshShiftCalendars(queryClient)` so every cached manager, signup, and task-filter variant is refreshed.

### Client State

Minimal client state via:
- **Component state** - `useState` for form inputs, UI state
- **URL state** - Route parameters, search params
- **Zustand** - Available for complex client state (currently unused)

## Build Configuration

### Development

```bash
npm run dev
```

- Vite dev server at `http://localhost:5173`
- Hot Module Replacement (HMR) enabled
- Theme auto-detects dev server when `WP_DEBUG` is true

### Production

```bash
npm run build
```

- Output to `dist/` directory
- Generates `manifest.json` for WordPress asset loading
- CSS and JS are hashed for cache busting

### Vite Configuration

Key settings from `vite.config.js`:
- Path alias: `@` → `src/`
- Output: `dist/assets/`
- Manifest: Enabled for WordPress integration
- PWA precache: App-shell assets only; lazy route chunks use runtime `CacheFirst` caching

## Styling

### Tailwind CSS

All styling uses Tailwind utility classes. Configuration in `tailwind.config.js`.

### Global Styles

`src/index.css` includes:
- Tailwind directives (`@tailwind base/components/utilities`)
- Custom component classes
- CSS variables for theming

## PWA/Mobile App Support

### Version Check & Cache Invalidation

When the app is installed as a PWA or loaded in a mobile browser (Add to Home Screen), browser caching can prevent users from receiving updates. The version check system addresses this:

1. **Version Endpoint**: `/rondo/v1/version` returns the current theme version
2. **Periodic Checking**: `useVersionCheck` hook polls for new versions
3. **Update Banner**: When a new version is detected, a banner appears at the top of the screen with a "Reload" button

**How it works:**
1. On app load, the current version is stored from `window.rondoConfig.version`
2. Every 15 minutes (and when the user returns after that interval), the hook fetches `/rondo/v1/version`
3. If the server version differs from the loaded version, `hasUpdate` becomes true
4. The `UpdateBanner` component renders at the top of `App.jsx` when an update is available
5. User clicks "Reload" → `window.location.reload(true)` forces a fresh load

**Note:** The version is embedded in both the HTML response (via `rondoConfig`) and the asset filenames (via Vite's hash-based naming), ensuring a reload fetches all new assets.

### PWA asset caching

The service worker precaches only the app shell: the main stylesheet, entry script, shared vendor/runtime chunks, offline page, icons, and fonts. Lazy page chunks are fetched on first use and then stored in the `rondo-assets` runtime cache for up to one year. Hashed filenames make long-lived caching safe.

This keeps first-install traffic predictable during a login wave. Do not broaden `globPatterns` to all JavaScript files: that would make every new user download the complete application, including rarely used finance, editor, and scanner screens.

The generated worker remains in `dist/sw.js`, but WordPress serves it publicly at `/sw.js`. The root URL lets the worker control the complete application without relying on a hosting-provider-specific `Service-Worker-Allowed` header for a static theme file. Vite's PWA base and scope must therefore stay `/`; Workbox must remain inlined, and `modifyURLPrefix` must keep precached resources under `/wp-content/themes/rondo-club/dist/`.

### Dashboard preload

WordPress starts the dashboard REST request from the HTML head so it can overlap with JavaScript startup. This preload only runs for an authenticated request to the site root. Direct links to another SPA route must not preload the dashboard, because the response would be discarded while still consuming PHP and database capacity.

## Volunteer load testing

The repository contains a demo-only k6 journey at `tests/load/volunteer-journey.js`. It creates a real WordPress session for a unique synthetic volunteer, opens `/vrijwillig`, and calls `user/me`, `my-shifts`, and `shifts/available`. Signup mode lets multiple volunteers claim the same synthetic shift at nearly the same time.

Use `bin/load-test-fixtures.php` through `wp eval-file` to seed, reset, verify, or remove the synthetic users, people, dienst types, and shifts. The script refuses every host except `demo.rondo.club` and marks every generated record with `_rondo_load_test_fixture=1`. After a concurrent signup run, always use `verify`; successful HTTP responses alone do not prove that every read-modify-write survived.

Because demo and production share a server, run 5, 25, and 50 virtual-user steps separately. Run 100 only after production remains stable. Full commands and stop criteria are documented in `tests/load/README.md` in the theme repository.

## Related Documentation

- [REST API](./rest-api.md) - Backend API reference
- [Data Model](./data-model.md) - Post types and fields
- [Architecture](./architecture.md) - Overall system architecture
