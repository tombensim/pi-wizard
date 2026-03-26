# Branching and PR rules

This repository uses a simple branch-and-PR workflow.

## Default branch

- `main` is the protected branch
- treat `main` as always releasable
- do not push feature work directly to `main`

## Branch naming

Use short, descriptive prefixes:

- `feat/<name>` for features
- `fix/<name>` for bug fixes
- `docs/<name>` for documentation
- `chore/<name>` for maintenance
- `refactor/<name>` for internal cleanup

Examples:

- `feat/delegated-task-retries`
- `fix/password-redaction`
- `docs/pi-install-guide`

## Pull requests

- all non-trivial changes should land through a pull request
- keep pull requests small enough to review in one sitting
- include a clear summary and test plan
- call out skipped validation explicitly
- use squash merge to keep `main` readable

## Branch protection

GitHub is configured so that `main`:

- requires a pull request before merge
- requires CI checks before merge
- requires conversation resolution before merge
- disallows force pushes
- disallows branch deletion
- enforces linear history

## Merge policy

- prefer squash merges
- do not use merge commits
- delete feature branches after merge
