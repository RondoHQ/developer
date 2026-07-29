---
title: "Production deployment"
description: "How Rondo Club builds, deploys, verifies, and rolls back production releases with GitHub Actions."
---

Rondo Club deploys automatically when a commit reaches the `main` branch and
the required continuous-integration checks pass. Production releases do not
depend on a developer workstation.

## Pipeline

The `CI and deploy` workflow performs these stages:

1. Install locked JavaScript and PHP dependencies.
2. Run JavaScript linting, a production frontend build, and PHP coding
   standards.
3. Rebuild the exact `main` commit as a production release:
   - `npm ci`
   - `npm run build`
   - `composer install --no-dev --prefer-dist --optimize-autoloader`
4. Store the compressed release as a GitHub Actions artifact for 30 days.
5. Deploy the artifact to SiteGround over SSH.
6. Remove deleted files from release-controlled directories.
7. Clear the WordPress object cache and SiteGround cache.
8. Confirm that the live WordPress theme version matches the release and that
   the production URL responds successfully.

Pull requests and feature branches run validation only. They cannot access the
production environment or its SSH key.

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
