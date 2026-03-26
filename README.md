# pi-wizard

Interactive multi-step wizard framework and Pi extension for guided setup, onboarding, and workflow automation.

`pi-wizard` is built for terminal-first flows where a user may need to:

- read context before acting
- fill structured forms
- run automatic or delegated actions
- pause to ask for help
- resume exactly where they left off

## Status

This repository is being prepared for public open-source release. The current focus is:

- stable public API surface
- safer handling of sensitive values
- contributor documentation and CI

## Features

- `info` steps for headings, prose, and lists
- `form` steps for text, password, select, and confirm inputs
- `action` steps for automatic shell/function execution or LLM-delegated execution
- `summary` steps for review before completion
- pause and resume with `?`
- dynamic step insertion through `wizard_add_steps`
- persisted in-memory session state across pauses
- redacted completion summaries for sensitive keys

## Compatibility

- Node.js `>=18`
- Pi-compatible runtime that loads package extensions from the `pi.extensions` field

## Installation

### In Pi

```bash
pi install pi-wizard
```

### For local development

```bash
npm install
npm run typecheck
npm run build
```

## Quick start

After installation, run the built-in demo:

```text
/wizard
```

## Public API

```typescript
import { createWizard } from "pi-wizard";

const wizard = createWizard({
  title: "My Wizard",
  steps: [
    {
      type: "info",
      id: "welcome",
      title: "Welcome",
      body: "# Getting Started\n\nThis wizard will help configure your project."
    }
  ]
});
```

### Step types

#### `info`

```typescript
{
  type: "info",
  id: "welcome",
  title: "Welcome",
  body: "# Getting Started\n\nThis wizard will help you:\n- Configure your project\n- Install dependencies"
}
```

#### `form`

```typescript
{
  type: "form",
  id: "config",
  title: "Configuration",
  fields: [
    { type: "text", id: "name", label: "Project Name", required: true },
    {
      type: "select",
      id: "template",
      label: "Template",
      options: [
        { value: "basic", label: "Basic" },
        { value: "full", label: "Full" }
      ]
    },
    { type: "password", id: "token", label: "API Token", required: true },
    { type: "confirm", id: "typescript", label: "Use TypeScript?", default: true }
  ]
}
```

#### `action`

```typescript
{
  type: "action",
  id: "setup",
  title: "Setting Up",
  tasks: [
    { id: "create", label: "Create project", run: "mkdir my-project" },
    { id: "deps", label: "Install dependencies", run: "npm install" }
  ]
}
```

```typescript
{
  type: "action",
  id: "configure",
  title: "Configuring",
  mode: "delegated",
  tasks: [
    {
      id: "setup-db",
      label: "Set up database",
      description: "Create the PostgreSQL database and run migrations"
    }
  ]
}
```

#### `summary`

```typescript
{
  type: "summary",
  id: "review",
  title: "Review",
  fields: ["name", "template"]
}
```

## Pi tools

The extension registers three tools:

| Tool | Description |
| --- | --- |
| `wizard` | Create and run a wizard. Call again with the same title to resume. |
| `wizard_update` | Report delegated task success or failure. |
| `wizard_add_steps` | Append steps to a paused or completed wizard. |

### Delegated flow

1. Call `wizard` with an action step in delegated mode.
2. The wizard pauses and returns `pendingTasks`.
3. Execute the tasks externally.
4. Call `wizard_update` for each task.
5. Call `wizard` again with the same title to resume.

## Examples

Example skills live in `examples/`:

- `client-onboard`
- `env-setup`
- `launch`
- `team-onboard`

They are reference workflows for building more complex wizards on top of the framework.

## Development

### Scripts

- `npm run typecheck`
- `npm run build`

### Repository layout

- `src/`: framework implementation and public API
- `.pi/extensions/wizard/`: Pi extension entrypoints and demo command
- `examples/`: reference skill definitions

## Security and privacy

- wizard completion summaries redact sensitive-looking keys
- framework logging avoids writing collected values directly to `.wizard/wizard.log`
- example flows should still avoid echoing secrets in commands, tool output, or task descriptions

See [SECURITY.md](SECURITY.md) for reporting guidance.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
