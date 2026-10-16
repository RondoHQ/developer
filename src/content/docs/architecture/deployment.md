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
2. When fresh checks are needed, run JavaScript lint/build, PHP coding standards,
   Capacitor spike checks, and three parallel PHP test groups.
3. On `main`, `_build-production.yml` prepares the exact commit while checks run:
   - Validate the full lowercase 40-character SHA and its ancestry in `main`.
   - Run `npm ci` and `npm run build`, including the required GlitchTip source-map
     upload; reject leftover `.map` files.
   - Install production PHP dependencies and package the isolated Linux VOG reader.
   - Package tracked source plus `dist` and `vendor` as `rondo-club-{run_id}`,
     retained for 30 days.
4. After the check plan, required validation and release build succeed,
   `_deploy-production.yml` downloads that run's release artifact and deploys it
   to SiteGround over SSH. Production deployments are serialized.
5. Prune eligible retired assets and deleted release-controlled source files,
   clear WordPress and SiteGround caches, and verify the live theme version and production URL.

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

## Frontend asset retention

`bin/deploy.sh` inventories the new build with `bin/retain-assets.php`, uploads
`dist/assets/` first, and publishes manifests and service-worker metadata only
after the assets are present. Both rsync and the archive fallback overlay these
files without deleting previous chunks. The server's `.asset-retention.json`
is excluded from transfer so an incoming release cannot reset retirement history.

After the complete release is present, the pruning step compares the actual
assets with `.asset-inventory.json`. Files absent from the new inventory get a
seven-day grace period starting when a deployment first marks them obsolete,
regardless of their build modification time. Later deployments remove them once
that period expires. Assets reused by a rollback become current again and lose
their retirement marker. This allows already-open apps to fetch old lazy chunks
while users finish their work and [choose when to reload](/architecture/frontend/#version-checks-and-explicit-updates).

Missing current assets, corrupt retention state, symlinks and empty inventories
fail validation before pruning. Inventory/state writes use a temporary file and
rename. CI runs `appUpdate.test.mjs`, `assetRetention.test.mjs` and
`deployAssetTransfer.test.mjs` to check the update helper, retirement timing,
rollback protection, transfer order and both upload paths.

## Production environment

GitHub's `production` environment holds one secret:

- `DEPLOY_SSH_PRIVATE_KEY` — a dedicated, revocable SiteGround SSH key used
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
