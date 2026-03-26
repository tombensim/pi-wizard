import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createWizard } from "../../../src/wizard";
import type { WizardDefinition } from "../../../src/types";

const DEMO_DEFINITION: WizardDefinition = {
	title: "Pi Wizard Demo",
	steps: [
		{
			type: "info",
			id: "welcome",
			title: "Welcome",
			body: "# Pi Wizard Demo\n\nThis is a demonstration of the pi-wizard framework.\n\nIt supports multiple step types:\n- Info: display text\n- Form: collect user input\n- Action: run commands with progress\n- Summary: review collected data\n\nPress ? at any time to pause and chat.\n\nPress Enter to start the demo.",
		},
		{
			type: "form",
			id: "config",
			title: "Configuration",
			fields: [
				{
					type: "text",
					id: "name",
					label: "Project Name",
					placeholder: "my-project",
					required: true,
				},
				{
					type: "select",
					id: "template",
					label: "Template",
					options: [
						{ value: "basic", label: "Basic", description: "Minimal project setup" },
						{ value: "full", label: "Full", description: "All features included" },
						{ value: "minimal", label: "Minimal", description: "Bare bones" },
					],
					default: "basic",
				},
				{
					type: "confirm",
					id: "typescript",
					label: "Use TypeScript?",
					default: true,
				},
			],
		},
		{
			type: "action",
			id: "setup",
			title: "Setting Up",
			tasks: [
				{
					id: "create",
					label: "Create project directory",
					run: "echo 'Creating project...' && sleep 1 && echo 'Done'",
				},
				{
					id: "deps",
					label: "Install dependencies",
					run: "echo 'Installing deps...' && sleep 1 && echo 'Installed 42 packages'",
				},
			],
		},
		{
			type: "summary",
			id: "review",
			title: "Review",
		},
	],
};

export function registerDemoCommand(
	pi: ExtensionAPI,
	getOrCreateSession: (id: string, def: WizardDefinition) => ReturnType<typeof createWizard>,
	sessions: Map<string, ReturnType<typeof createWizard>>,
) {
	pi.registerCommand("wizard", {
		description: "Run a demo wizard to test the framework",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Wizard requires interactive UI", "error");
				return;
			}

			const sessionId = "__demo__";
			const session = getOrCreateSession(sessionId, DEMO_DEFINITION);

			const result = await session.run(ctx, pi);
			if (result.completed) {
				ctx.ui.notify("Demo wizard completed!", "info");
			} else if (result.paused) {
				const contextLines = [
					`Wizard paused at step "${result.currentStepTitle}" (${(result.currentStepIndex ?? 0) + 1}/${result.totalSteps}).`,
				];
				if (result.pauseReason) contextLines.push(`Reason: ${result.pauseReason}`);
				contextLines.push("", "Help the user, then they can type /wizard to resume.");

				pi.sendMessage(
					{
						customType: "wizard-pause",
						content: contextLines.join("\n"),
						display: true,
					},
					{ triggerTurn: true },
				);
			} else {
				sessions.delete(sessionId);
				ctx.ui.notify("Demo wizard cancelled", "warning");
			}
		},
	});
}
