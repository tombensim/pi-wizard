import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text, Container } from "@mariozechner/pi-tui";
import { WizardToolParams, WizardUpdateParams, WizardAddStepsParams } from "../../../src/schema";
import { createWizard } from "../../../src/wizard";
import type { WizardDefinition, WizardResult, WizardStep } from "../../../src/types";
import { listPublicDataEntries } from "../../../src/utils";
import { registerDemoCommand } from "./demo";

export default function wizardExtension(pi: ExtensionAPI) {
	const sessions = new Map<string, ReturnType<typeof createWizard>>();

	function getOrCreateSession(id: string, def: WizardDefinition): ReturnType<typeof createWizard> {
		let session = sessions.get(id);
		if (!session) {
			session = createWizard(def);
			sessions.set(id, session);
		}
		return session;
	}

	pi.registerTool({
		name: "wizard",
		label: "Wizard",
		description:
			"Run an interactive multi-step wizard. Supports: info (text), form (collect input), " +
			"action (delegated tasks — you execute them), summary (review data). " +
			"When the wizard reaches an action step, it pauses and tells you what tasks to execute. " +
			"Execute each task yourself using bash, then call wizard_update to report results. " +
			"After all tasks are reported, call this tool again with the same title to resume. " +
			"Users can also press ? to pause and chat.",
		promptSnippet:
			"Run a multi-step wizard. Action steps are delegated to you for execution.",
		promptGuidelines: [
			"Use this for multi-step setup/configuration/installation processes.",
			"When the wizard pauses with pendingTasks, execute each task yourself using your tools (bash, etc.).",
			"After executing each task, call wizard_update with the taskId and result (success/failure).",
			"After all tasks are reported, call this wizard tool again with the same title to resume.",
			"You can adapt and troubleshoot — if a command fails, try a different approach before reporting failure.",
			"NEVER recreate the wizard with modified steps. Always resume the existing session.",
			"If the wizard completed but more steps are needed, use wizard_add_steps to append them, then call wizard again to resume.",
			"When paused for help (? key), assist the user, then tell them to resume the wizard.",
			"IMPORTANT: Do NOT describe or list the wizard steps in your response text before calling this tool. Just call it directly. The wizard UI will show the steps to the user.",
		],
		parameters: WizardToolParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!ctx.hasUI) {
				return {
					content: [
						{ type: "text", text: "Error: Wizard requires interactive UI" },
					],
					details: {
						completed: false,
						cancelled: true,
						paused: false,
						data: {},
						taskResults: {},
					},
				};
			}

			try {
				const sessionId = params.title;
				const session = getOrCreateSession(sessionId, params as WizardDefinition);
				const result = await session.run(ctx, pi);

				if (result.paused) {
					return {
						content: [
							{
								type: "text",
								text: [
									`Wizard paused at step "${result.currentStepTitle}" (${(result.currentStepIndex ?? 0) + 1}/${result.totalSteps}).`,
									result.pauseReason ? `Reason: ${result.pauseReason}` : "",
									"",
									"The user needs help. Assist them, then call this tool again with the same title to resume.",
								].filter(Boolean).join("\n"),
							},
						],
						details: result,
					};
				}

				if (result.cancelled) {
					sessions.delete(sessionId);
					return {
						content: [
							{ type: "text", text: "User cancelled the wizard." },
						],
						details: result,
					};
				}

				const dataLines = listPublicDataEntries(result.data)
					.map(([key, value]) => `${key}: ${value}`)
					.join("\n");

				return {
					content: [
						{
							type: "text",
							text: dataLines
								? `Wizard completed.\n\nCollected data (sensitive values redacted):\n${dataLines}`
								: "Wizard completed.",
						},
					],
					details: result,
				};
			} catch (err: unknown) {
				return {
					content: [
						{ type: "text", text: `Wizard error: ${err instanceof Error ? err.message : String(err)}` },
					],
					details: {
						completed: false,
						cancelled: true,
						paused: false,
						data: {},
						taskResults: {},
					},
				};
			}
		},

		renderCall(args, theme) {
			const steps = (args.steps as WizardStep[]) || [];
			const sessionId = args.title as string;
			const session = sessions.get(sessionId);
			let text = theme.fg("toolTitle", theme.bold("wizard "));
			text += theme.fg("muted", `"${args.title}" `);
			if (session?.isPaused) {
				text += theme.fg("warning", "(resuming)");
			} else {
				text += theme.fg("dim", `${steps.length} step${steps.length !== 1 ? "s" : ""}`);
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, _options, theme) {
			const details = result.details as WizardResult | undefined;
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? (text as any).text : "", 0, 0);
			}

			const container = new (Container as any)("vertical", 0);

			if (details.paused) {
				let pauseText = theme.fg("warning", "⏸ Wizard paused");
				if (details.currentStepTitle) {
					pauseText += theme.fg("dim", ` at "${details.currentStepTitle}"`);
				}
				container.addChild(new Text(pauseText, 0, 0));
				if (details.pauseReason) {
					container.addChild(
						new Text("  " + theme.fg("muted", details.pauseReason), 0, 0),
					);
				}
				return container;
			}

			if (details.cancelled) {
				container.addChild(
					new Text(theme.fg("warning", "Wizard cancelled"), 0, 0),
				);
				return container;
			}

			container.addChild(
				new Text(theme.fg("success", "✓ Wizard completed"), 0, 0),
			);

			const entries = listPublicDataEntries(details.data);
			if (entries.length > 0) {
				const lines = entries.map(
					([k, v]) =>
						`  ${theme.fg("accent", k)}: ${theme.fg("text", v)}`,
				);
				container.addChild(new Text(lines.join("\n"), 0, 0));
			}

			return container;
		},
	});

	pi.registerTool({
		name: "wizard_update",
		label: "Wizard Update",
		description:
			"Report the result of a delegated wizard task. Use this after executing a task " +
			"that the wizard delegated to you. Report success or failure for each task by ID. " +
			"After reporting all tasks, call the wizard tool again with the same title to resume.",
		promptSnippet:
			"Report a wizard task result (success/failure) after executing a delegated task",
		promptGuidelines: [
			"Call this tool after you execute each task that a wizard delegated to you.",
			"Use the taskId from the pendingTasks list in the wizard's pause result.",
			"After reporting all tasks as done, call the wizard tool again with the same title to resume.",
			"If a task fails, report it with success=false and include the error. The user can then get help.",
		],
		parameters: WizardUpdateParams,

		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const session = sessions.get(params.wizard);
			if (!session) {
				return {
					content: [{ type: "text" as const, text: `No active wizard session "${params.wizard}"` }],
					details: { success: false } as any,
				};
			}
			if (!session.isPaused) {
				return {
					content: [{ type: "text" as const, text: `Wizard "${params.wizard}" is not paused` }],
					details: { success: false } as any,
				};
			}

			const accepted = session.reportTaskResult(params.taskId, {
				success: params.success,
				output: params.output,
				error: params.error,
			});
			if (!accepted) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Task "${params.taskId}" was rejected. Check that the wizard is paused and the task ID matches a pending task.`,
						},
					],
					details: { success: false } as any,
				};
			}

			const status = params.success ? "done" : "failed";
			return {
				content: [
					{
						type: "text" as const,
						text: `Task "${params.taskId}" marked as ${status}.${params.success ? " Call the wizard tool again to resume." : ""}`,
					},
				],
				details: { success: true, taskId: params.taskId, status } as any,
			};
		},

		renderResult(result, _options, theme) {
			const details = result.details as { success?: boolean; taskId?: string; status?: string } | undefined;
			if (!details?.success) {
				return new Text(theme.fg("error", (result.content[0] as any)?.text ?? "Error"), 0, 0);
			}
			const icon = details.status === "done"
				? theme.fg("success", "✓")
				: theme.fg("error", "✗");
			return new Text(`${icon} ${theme.fg("muted", details.taskId ?? "")}: ${details.status}`, 0, 0);
		},
	});

	pi.registerTool({
		name: "wizard_add_steps",
		label: "Wizard Add Steps",
		description:
			"Add new steps to an existing wizard session. Use this when the user says the wizard " +
			"is incomplete or asks to continue with more steps (e.g. 'also set up Tailscale', " +
			"'connect WhatsApp too'). Works on paused or completed wizards. " +
			"New steps are appended after the current last step. " +
			"After adding steps, call the wizard tool with the same title to resume.",
		promptSnippet:
			"Append new steps to a wizard that needs more work (paused or completed)",
		promptGuidelines: [
			"Use when the user says the wizard didn't complete all required steps.",
			"Use when the user asks to add more functionality to an existing wizard flow.",
			"After adding steps, call the wizard tool with the same title to resume at the new steps.",
			"Step IDs must be unique — don't reuse IDs from existing steps.",
		],
		parameters: WizardAddStepsParams,

		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const session = sessions.get(params.wizard);
			if (!session) {
				return {
					content: [{ type: "text" as const, text: `No wizard session "${params.wizard}" found. Create one first with the wizard tool.` }],
					details: { success: false } as any,
				};
			}

			if (!session.isPaused && !session.isCompleted) {
				return {
					content: [{ type: "text" as const, text: `Wizard "${params.wizard}" is still running. Pause it first (? key) or wait for it to complete.` }],
					details: { success: false } as any,
				};
			}

			try {
				session.addSteps(params.steps as WizardStep[]);
				const stepNames = (params.steps as WizardStep[]).map((s) => s.title).join(", ");
				return {
					content: [
						{
							type: "text" as const,
							text: `Added ${params.steps.length} step(s) to "${params.wizard}": ${stepNames}. Call the wizard tool with the same title to continue.`,
						},
					],
					details: { success: true, addedSteps: params.steps.length } as any,
				};
			} catch (err: unknown) {
				return {
					content: [{ type: "text", text: `Failed to add steps: ${err instanceof Error ? err.message : String(err)}` }],
					details: { success: false },
				};
			}
		},

		renderResult(result, _options, theme) {
			const details = result.details as { success?: boolean; addedSteps?: number } | undefined;
			if (!details?.success) {
				return new Text(theme.fg("error", (result.content[0] as any)?.text ?? "Error"), 0, 0);
			}
			return new Text(
				theme.fg("success", `+ ${details.addedSteps} step(s) added`),
				0,
				0,
			);
		},
	});

	registerDemoCommand(pi, getOrCreateSession, sessions);
}
