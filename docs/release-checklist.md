# Release Checklist

## Going public on GitHub (one-time)

- [ ] `npm test` green; `scripts/roundtrip.sh` green against current ds-mcp
- [ ] Goldens regenerated at the pinned epoch; `git status` clean after
      `npm run generate:fixture`
- [ ] Governance files present: LICENSE, CONTRIBUTING, SECURITY,
      CODE_OF_CONDUCT, issue/PR templates
- [ ] README quick-start verified from a **fresh clone** (not the dev checkout)
- [ ] No secrets/local paths in history (`git log -p | grep -iE "token|secret|/Users/"` spot-check)
- [ ] Create `aestheticfunction/dspack-export` (public), push `main`
- [ ] Repository settings: description + topics (mirror package.json
      keywords), Discussions on, wiki off
- [ ] Same-day funnel PRs:
  - [ ] ds-mcp README: "Don't have a dspack file?" quick-start section +
        no-path error message mention
  - [ ] dspack README: list dspack-export as a producer implementation
- [ ] Tag `v0.1.0-alpha.0`

## npm publish (separate, later decision — not part of going public)

- [ ] Remove `"private": true`; add `"files"` whitelist (dist/, src/emit/schema/,
      README, LICENSE, SECURITY.md)
- [ ] Verify `npx @aestheticfunction/dspack-export init` works in a clean repo
- [ ] Confirm GENERATOR_VERSION === package.json version (golden regen if bumped)
- [ ] `npm publish --access public --tag next` (alpha tag until stable)
- [ ] Update README install instructions from clone-based to npx-based

## Every release thereafter

- [ ] Version bump in package.json **and** `src/generate.ts` GENERATOR_VERSION
- [ ] `npm run generate:fixture` (goldens embed the version) + commit
- [ ] `npm test` + roundtrip green
- [ ] Re-run one real-repo trial (docs/trials.md) as a smoke check
- [ ] Tag; changelog entry in the GitHub release notes
