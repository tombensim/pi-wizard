# Contributing

## Scope

This project provides:

- a reusable wizard framework under `src/`
- a Pi extension under `.pi/extensions/wizard/`
- reference workflows under `examples/`

Keep those boundaries explicit when contributing.

## Local setup

```bash
npm install
npm run typecheck
npm run build
```

## Development guidelines

- prefer small, focused changes
- keep the public API stable unless the change explicitly updates documentation
- redact or avoid logging user-provided values, task output, and secrets
- avoid introducing host-specific assumptions into the core framework
- update `README.md` when the install path, public API, or extension behavior changes

## Pull requests

Before opening a pull request:

1. make sure the repository still typechecks
2. make sure the project still builds
3. document any public API change
4. call out any privacy, logging, or security tradeoffs
5. update `CHANGELOG.md` for user-visible changes

## Issue reports

Please include:

- what you expected
- what happened instead
- reproduction steps
- environment details:
  - Node version
  - Pi version
  - operating system

## Security-sensitive changes

Changes that touch form collection, task reporting, logging, summaries, or extension tool output should be reviewed with extra care. The framework is expected to avoid leaking sensitive values by default.
