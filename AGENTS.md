# Rondo Developer documentation

This Astro/Starlight repository contains the documentation published at `https://developer.rondo.club`.

## Daily documentation run

Maintain the developer docs in one daily run rather than during every source-code change.

1. Work in this repository. Inspect its Git status and preserve existing changes; never include someone else's work in a commit or deployment. If existing work conflicts with the update, report the blocker.
2. Fetch the current remote default branches of the sibling repositories `rondo-club`, `rondo-sync`, `rondo-player`, `freescout-rondo-integration`, and `website`. Read their applicable instructions. Inspect all changes integrated into those branches during the previous 24 hours, including merge diffs. Use a fixed UTC cutoff for the run; do not rely only on commit titles or original author dates. Do not switch, pull, edit, or deploy the source repositories, and never run sync pipelines.
3. Read the changed code and tests at the fetched revisions. Compare their actual behavior with the existing documentation under `src/content/docs/`. Update only documentation affected by those changes, including new systems, changed APIs, configuration, workflows, and removed behavior. Do not document unmerged or uncommitted work as released functionality. If source retrieval fails, report incomplete coverage rather than assuming no changes.
4. Preserve the existing language, structure, and Starlight frontmatter (`title:` is required). Keep PRDs in the source repositories. Change navigation only when needed for new documentation.
5. Run `npm run build` and `git diff --check`. Review the final diff for accuracy and accidental inclusion of secrets or personal production data.
6. If documentation changed, commit only this run's files with a descriptive `docs:` message, push to the developer repository's default branch, and publish using the repository's configured deployment workflow. Check that the affected pages on `https://developer.rondo.club` show the update before claiming publication. Never publish unrelated working-tree changes; use a clean checkout of the committed revision when necessary.
7. Report the reviewed time window and source revisions, updated pages, validation, and publication result concisely. If no documentation changes are needed, make no commit or deployment.

## Commands

- `npm run build`: Astro checks and production build.
- `npm run dev`: Local preview.
- `npm run deploy`: Build and publish through the configured Cloudflare Pages project; load the Wrangler skill before using Wrangler.
