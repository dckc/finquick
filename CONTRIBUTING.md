# Contributing

## Node + direnv (nvm)
- Install nvm and set your Node version with `nvm install`.
- This repo pins Node in `.nvmrc`. With direnv, copy `.envrc.example` to `.envrc`, then run `direnv allow` once per machine.
- `direnv` will run `nvm use` automatically on `cd` into the repo.

## Yarn (boring + stable)
- Use the repo Yarn version: `corepack enable` then `corepack prepare yarn@4.5.3 --activate`.
- Install: `yarn install` (use `yarn install --immutable` in CI).
- Don’t use npm in workspaces (no `package-lock.json`).
- For adding deps: `yarn workspace <pkg> add <dep>` or edit the package and run `yarn install`.
- Dedupe: use `yarn dedupe` (not `npx yarn-deduplicate`, which is Yarn 1).

## Workspaces
- Workspaces are `packages/*`. Each package must have a `package.json`.
- Avoid adding nested lockfiles inside packages.
- Avoid local dev deps that use `workspace:` (e.g., private monorepo packages) unless you also add their workspaces here.
- TODO: Restore optional `@endo/cli` support for `packages/fincaps` without breaking installs (e.g., document a separate Endo monorepo workflow or make it an opt-in dev dependency).
- TODO: Consider `yarn workspaces focus` to avoid Electron (via `packages/ofxies`) when not working on that package.

## Agoric dev versions
- To update `@agoric/*` deps to their current `dev` dist-tags (from npm): `./scripts/update-agoric-dev.js`
- Then run `yarn install` to refresh the lockfile.

## better-sqlite3
- Multiple versions are expected when packages depend on different major ranges.
- If you need a single version, align the package.json ranges and run `yarn install`.
