# Releasing

Versions follow [semver](https://semver.org): `vMAJOR.MINOR.PATCH`.

- **Continuous deploy** — every push to `main` redeploys the live site
  (https://solo.kdc.sh/dune-war-for-arrakis) via `.github/workflows/deploy.yml`.
- **A release** is a versioned snapshot: a git tag + a GitHub Release with notes and a built
  `dist/` zip, produced by `.github/workflows/release.yml`.

## Cut a release

From a clean `main` with green tests:

```bash
git checkout main && git pull
npm test                       # sanity check locally

npm version minor              # patch | minor | major — bumps package.json, commits, tags vX.Y.Z
git push origin main --follow-tags
```

`npm version` creates the commit and the `vX.Y.Z` tag. `--follow-tags` pushes both. That:

1. triggers **deploy.yml** (push to `main`) → live site updates;
2. triggers **release.yml** (the new tag) → builds, tests, and publishes the **GitHub Release**
   with auto‑generated notes + `dune-war-for-arrakis-vX.Y.Z.zip`.

Then add a dated section to [CHANGELOG.md](CHANGELOG.md) (or fold it in before bumping).

## Choosing the bump

- **patch** — bug/UX fixes, no behavior change for users.
- **minor** — new features, backward‑compatible (most of our changes).
- **major** — breaking changes to saved‑game format or workflow.

> Saved games are versioned in their JSON envelope; bump **major** if a change makes older saves
> unreadable, and note the migration in the changelog.

## Re‑run a release

If a release job fails, fix forward and either push a new tag, or re‑run from the Actions tab
(**Release → Run workflow**) passing the existing tag.

## Custom domain

The site is served at `solo.kdc.sh/dune-war-for-arrakis` (moved 2026-07-05 from the dedicated
`dune-war-for-arrakis.kdc.sh`). The domain lives on the **org Pages site**, not this repo: with
`solo.kdc.sh` set as the custom domain there, every project's Pages site is served under
`solo.kdc.sh/<repo>/` automatically — this repo must have NO custom domain of its own in
Settings → Pages, and no `public/CNAME` (removed). The app builds with relative asset paths
(`base: './'` in vite.config.ts), so it works at any subpath without config changes.
