# Open Source Release Checklist

Use this before making the repository public or publishing a package release.

## Repository metadata

- set the final GitHub repository URL
- add `repository`, `bugs`, and `homepage` fields to `package.json`
- confirm the package name is the one you want to keep publicly

## Security

- scan the working tree for secrets
- scan git history for secrets before the repo goes public
- enable GitHub secret scanning and private vulnerability reporting
- verify example workflows do not include private infrastructure details

## Packaging

- run `npm install`
- generate and commit the package lockfile
- run `npm run typecheck`
- run `npm run build`
- confirm the published package contains `dist/` and the Pi extension entrypoint

## Documentation

- verify installation instructions against the final publish destination
- verify the README examples match the shipped API
- link any additional project website or docs

## Governance

- review `CODE_OF_CONDUCT.md`
- review `CONTRIBUTING.md`
- review `SECURITY.md`
- review issue templates and PR template

## Release

- update `CHANGELOG.md`
- tag the release
- publish release notes
