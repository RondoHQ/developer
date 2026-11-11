---
title: "Production deployment"
description: "How Rondo Club builds, deploys, verifies, and rolls back production releases with GitHub Actions."
---

Rondo Club deploys automatically when a commit reaches the `main` branch and
the required continuous-integration checks pass. Production releases do not
depend on a developer workstation.

## Pipeline

The `CI and deploy` workflow separates release preparation from deployment:

1. `Plan checks` decides whether the exact code has reusable successful PR checks.
2. When fresh checks are needed, run JavaScript lint, browser error/performance
   privacy and REST session-recovery tests, build, PHP coding standards,
   Capacitor spike checks, and three parallel PHP test groups. See [monitoring source verification](/architecture/error-monitoring/#source-verification) for the browser test command.
3. On `main`, `_build-production.yml` prepares the exact commit while checks run:
   - Validate the full lowercase 40-character SHA and its ancestry in `main`.
   - Run `npm ci` and `npm run build`, including the required GlitchTip source-map
     upload; reject leftover `.map` files.
   - Install production PHP dependencies and package the isolated Linux VOG reader.
   - Package tracked source plus `dist` and `vendor` as `rondo-club-{run_id}`,
     retained for 30 days.
4. After the check plan, required validation and release build succeed,
   `_deploy-production.yml` downloads that run's release artifact and deploys it
   to the production account on srv1 over SSH. Production deployments are serialized.
5. Prepare and validate an inactive release, activate it atomically, refresh rewrite
   rules and caches, then verify the theme version through WP-CLI and HTTP.
   Record the deployed commit only after those checks succeed.

Pull requests run validation without production deployment. Pushes confined to
`docs/prd/**` do not start the workflow. The artifact name stays stable across
attempts, allowing a deploy-only rerun to reuse the original build. A full rerun
replaces the artifact.

### Parallel PHP tests

`tests/ci/split_php_tests.py` discovers every `tests/Wpunit/**/*Test.php` file and
assigns complete files deterministically to three groups using recorded duration
weights from `php-test-durations.json`. New files receive a default weight;
renamed or removed files cannot silently disappear through a timing allowlist.
Each group has its own MySQL 8.4 service and WordPress 7.1 test install, and runs
without field plugins. Group 1 also runs the opt-in mobile adapter test in a local
environment.

The splitter validates each JUnit report against its selected files. Reports and
file selections are uploaded as `php-tests-group-{group}` artifacts for seven
days, including on failure. `fail-fast: false` lets every group finish. The stable
**PHP tests** status aggregates all groups and blocks deployment on failures or
unexpected skips. Local `composer test` still runs the complete suite.

### Reusing verified PR checks

`tests/ci/reuse_pr_checks.py` can reuse checks only for a push to `main` associated
with a merged PR from the same repository whose merge SHA is that exact commit.
It requires a completed successful `ci.yml` PR run for the PR's current head,
a non-expired `ci-tree-{attempt}-{pr}-{tree}` artifact matching the current full
Git tree, and exactly one successful instance of every required job, including
all three PHP groups. PR tree markers are retained for seven days. A green overall
run with skipped or missing jobs is insufficient.

With valid proof, JavaScript, PHP standards, mobile and PHP group jobs are skipped
on the main push; the stable PHP status validates that decision. The production
release still builds for the main commit and deployment waits for it. Changed
trees, missing evidence, API failures and direct pushes without qualifying PR
proof run all checks. PRs and manual `workflow_dispatch` runs always check again.
The check-plan summary links to the reused run or records that fresh checks run.
The Python tests cover grouping/report coverage and rejection of incomplete reuse
evidence.

## Hosting and deployment targets

Production and demo share `srv1.rondo.club` (SSH port 22) and run under separate
service accounts. Each uses `wp-content/themes/rondo-club` under its WordPress root.

| Site | SSH account | WordPress root |
|---|---|---|
| `rondo.svawc.nl` | `rondo-prod` | `/srv/rondo-prod/public_html` |
| `demo.rondo.club` | `rondo-demo` | `/srv/rondo-demo/public_html` |

`bin/deploy-demo.sh` uses the demo target and accepts exported `DEPLOY_DEMO_*`
overrides for rehearsals. It supplies its own host, port, account, paths, URL and
SSH options to the common deploy script. CI tests that production environment
variables cannot redirect the demo wrapper.

WordPress cron runs from the `rondo-wp-cron@prod.timer` and
`rondo-wp-cron@demo.timer` systemd timers. Request-triggered cron is disabled.
Include `ops/nginx/wordpress-protection.conf` before generic PHP and static
regex locations. It preserves private file and upload protections while
allowing OAuth discovery and the Apple association file.

The former production and demo origins are frozen rollback copies. Before
reactivating an old origin, stop writes on srv1 and transfer the latest data back.
The legacy `stadion.svawc.nl` site remains on SiteGround.

## PHP and Redis on srv1

Production and demo each run a separate PHP-FPM service and a separate Redis
Object Cache instance. Redis listens on a private Unix socket per site. It serves
FPM, WP-CLI and scheduled WordPress jobs for that site. Both caches use
`allkeys-lru` and disable disk persistence.

| Site | FPM service | Maximum workers | Redis service | Redis dataset limit |
|---|---|---:|---|---:|
| Production | `rondo-php@prod.service` | 6 | `rondo-redis-prod.service` | 512 MiB |
| Demo | `rondo-php@demo.service` | 3 | `rondo-redis-demo.service` | 128 MiB |

Each FPM service allocates 256 MiB of OPcache and a 32 MiB interned-string buffer
via startup flags. To verify the installation, check `wp redis status` as the
site account, read a temporary WP-CLI cache key from the same site's FPM, and
inspect `opcache_get_status(false)` in FPM. The theme deploy leaves these host
settings and the Redis drop-in in place. A cache flush can expire transient
state such as temporary login links and in-progress OAuth exchanges.
[Production runbook](https://github.com/RondoHQ/rondo-club/blob/main/ops/production/README.md)
· [Demo runbook](https://github.com/RondoHQ/rondo-club/blob/main/ops/demo/README.md)

The postmeta index migration advances `rondo_postmeta_index_version` to `2`.
It keeps `rondo_meta_key_value` and adds `rondo_post_id_meta_key` on
`(post_id, meta_key(191))` for people-list joins and pagination counts.
It requests online DDL with `ALGORITHM=INPLACE, LOCK=NONE`. If index creation
fails, the version stays at its previous value so a later run can retry.

## Atomic release activation

`bin/deploy.sh` uploads a complete archive with SCP. `bin/atomic-release.py`
prepares the candidate under `.rondo-releases/rondo-club`, beside the WordPress
web root. It verifies SHA-256, rejects links and unsafe archive paths, checks
required theme files and every manifest asset, and validates Composer class paths.
The `--prune` option replaces controlled `includes`, `bin`, `src` and `vendor`
directories in staging, so removed code does not survive in a new release.

The live theme path becomes a symlink to one complete release. Normal activation
replaces that link atomically. The first conversion from a directory uses Linux
`renameat2(RENAME_EXCHANGE)` and retains the original directory. If atomic
bootstrap is unavailable, deployment fails before changing the live theme.
Runtime `.env` and `certs` stay linked to their retained location; archives exclude
them and the `CLAUDE.md` documentation symlink.

The early `rondo-00-release.php` MU plugin clears PHP's realpath cache and pins
each request's template and stylesheet paths to one resolved release. Error
monitoring uses the same path. Theme version reads use that release's `style.css`.
A request therefore keeps its PHP classes and version together during activation.

A filesystem lock and durable per-release JSON state protect prepare, activate,
rollback and finish. Retries after a lost SSH reply inspect that state; stale
transactions cannot overwrite a different live release. Failed verification
restores the previous target, refreshes rewrite rules and clears caches.

On srv1, `bin/deploy.sh` gracefully reloads the site's FPM service after
activating a release. Each deployment account has permission to reload only its
own service. This clears shared OPcache entries for old release paths. A reload
failure aborts deployment and triggers rollback, which attempts the reload again
after restoring the previous target. The reload applies to the srv1 accounts
`rondo-prod` and `rondo-demo`.

Deployment and rollback flush the WordPress cache, then purge the SiteGround
cache only when WP-CLI provides `sg purge`. HTTP checks cover the production URL, OIDC discovery and a uniquely queried
`/wp-json/rondo/v1/version`, whose version must match the release.

Successful cleanup keeps at least three completed releases, releases retired in
the past hour, and the active and immediately previous releases. Legacy runtime
paths are never pruned. `tests/python/test_atomic_release.py` exercises real
archives, request pinning, bootstrap, stale activation and health-check rollback.
CI runs it alongside the frontend update and retention tests.

## Frontend asset retention

`bin/deploy.sh` inventories the new build with `bin/retain-assets.php`.
Staging carries forward the previous release's assets and retention state, then
validates and prunes the candidate before activation. New manifests and workers
become live together with the complete release. The incoming archive excludes
`.asset-retention.json`, preserving the server's retirement history.

After the complete release is present, the pruning step compares the actual
assets with `.asset-inventory.json`. Files absent from the new inventory get a
seven-day grace period starting when a deployment first marks them obsolete,
regardless of their build modification time. Later deployments remove them once
that period expires. Assets reused by a rollback become current again and lose
their retirement marker. This allows already-open apps to fetch old lazy chunks
while users finish their work and [choose when to reload](/architecture/frontend/#version-checks-and-explicit-updates).

Missing current assets, corrupt retention state, symlinks and empty inventories
fail validation before pruning. Inventory/state writes use a temporary file and
rename. Rollback also copies missing assets from the failed candidate to the
previous release so tabs opened during verification can still load their chunks.
CI runs `appUpdate.test.mjs`, `assetRetention.test.mjs` and the Python atomic-release
suite to check update behavior, retirement timing and rollback protection.

## Production environment

GitHub's `production` environment holds one secret:

- `DEPLOY_SSH_PRIVATE_KEY` — a dedicated, revocable production SSH key used
  only by GitHub Actions.

The environment also holds the non-secret deployment variables:

- `DEPLOY_SSH_HOST`
- `DEPLOY_SSH_PORT`
- `DEPLOY_SSH_USER`
- `DEPLOY_REMOTE_WP_PATH`
- `DEPLOY_REMOTE_THEME_PATH`
- `DEPLOY_PRODUCTION_URL`
- `DEPLOY_SSH_KNOWN_HOSTS`

Only the deployment job references the environment. Build and pull-request
jobs never receive deployment credentials.

## Rollback

Run the **Roll back production** workflow and supply a full 40-character commit
SHA. The workflow refuses commits that are not contained in `main`, rebuilds
the selected revision from its lockfiles, and follows the normal production
deployment and verification path.

## Emergency local deployment

`bin/deploy.sh` remains available as a break-glass fallback. Export the
deployment variables or configure the local `.env`, install dependencies, and
run:

```bash
bin/deploy.sh --prune
```

Normal releases should always use GitHub Actions so the deployed artifact,
commit, logs, and verification result are recorded centrally.
