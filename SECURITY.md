# Security Policy

## Supported versions

Security fixes are applied to the latest published release line.

## Reporting a vulnerability

Do not open a public issue for security vulnerabilities.

Instead:

1. use GitHub private vulnerability reporting if it is enabled for the repository
2. otherwise contact the maintainers privately through the repository contact channel

Please include:

- affected version
- impact
- reproduction steps
- any proof of concept needed to understand the issue

## Sensitive data handling

This project aims to avoid leaking secrets through:

- wizard completion summaries
- framework logging
- delegated task reporting

If you find a path where secret values are displayed or persisted, report it as a security issue.
