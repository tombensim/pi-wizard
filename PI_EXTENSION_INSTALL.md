# Install as a Pi extension

This repository can be installed into Pi directly from GitHub.

## Prerequisites

- Pi is installed and working
- the machine running Pi has GitHub access to `tombensim/pi-wizard`
- for a private repository, make sure your Git credentials already work for private clones

Useful checks:

```bash
gh auth status
git ls-remote git@github.com:tombensim/pi-wizard.git
```

## Install globally in Pi

```bash
pi install git:github.com/tombensim/pi-wizard
```

This makes the extension available in Pi generally.

## Install only for the current project

```bash
pi install -l git:github.com/tombensim/pi-wizard
```

Use this when you want the package enabled only in the current workspace.

## Verify the package is installed

```bash
pi packages
```

You should see `pi-wizard` in the installed package list.

## Use the demo command

After installation, start Pi and run:

```text
/wizard
```

That launches the built-in demo wizard from this extension.

## Notes for private repositories

- Pi installs the package through Git, so your local Git credentials need access to the private repository.
- If HTTPS access is not enough on your machine, configure SSH access for GitHub first.
- This repository keeps the Pi extension entrypoint under `.pi/extensions/wizard`, so Pi can load it directly from source.
