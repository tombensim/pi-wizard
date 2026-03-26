import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { ActionTaskResult, WizardDefinition, WizardResult, WizardState, WizardStep } from "./types";
import { createWizardComponent } from "./renderer";
import { initLog, wizardLog } from "./log";

function validateSteps(steps: WizardStep[], existingIds?: Set<string>) {
	const ids = existingIds ?? new Set<string>();
	for (const step of steps) {
		if (ids.has(step.id)) {
			throw new Error(`Duplicate step ID: ${step.id}`);
		}
		ids.add(step.id);

		if (step.type === "form" && (!step.fields || step.fields.length === 0)) {
			throw new Error(`Form step "${step.id}" must have at least one field`);
		}
		if (step.type === "action" && (!step.tasks || step.tasks.length === 0)) {
			throw new Error(`Action step "${step.id}" must have at least one task`);
		}
	}
}

export function createWizard(definition: WizardDefinition) {
	if (!definition.steps || definition.steps.length === 0) {
		throw new Error("Wizard must have at least one step");
	}

	validateSteps(definition.steps);

	wizardLog("info", `Wizard created: "${definition.title}" with ${definition.steps.length} steps: ${definition.steps.map((s) => s.id).join(", ")}`);

	let savedState: WizardState | null = null;
	let lastCompletedState: WizardState | null = null;

	function createFreshState(): WizardState {
		return {
			currentStepIndex: 0,
			data: {},
			taskStatuses: new Map(),
			navigationHistory: [],
			completed: false,
			cancelled: false,
			paused: false,
			pauseReason: undefined,
		};
	}

	return {
		async run(ctx: ExtensionContext, pi: ExtensionAPI): Promise<WizardResult> {
			initLog(ctx.cwd);

			if (!ctx.hasUI) {
				wizardLog("warn", "No UI available, returning cancelled");
				return { completed: false, cancelled: true, paused: false, data: {}, taskResults: {} };
			}

			const resuming = savedState !== null;
			const state = savedState ?? createFreshState();
			state.paused = false;
			state.pauseReason = undefined;
			state.completed = false;

			if (resuming) {
				wizardLog("info", `Resuming wizard at step ${state.currentStepIndex} (${definition.steps[state.currentStepIndex]?.id})`);
			} else {
				wizardLog("info", "Starting wizard from step 0");
			}

			const result = await ctx.ui.custom<WizardResult>(
				(tui, theme, _keybindings, done) => {
					return createWizardComponent(definition, state, pi, ctx, tui, theme, done);
				},
			);

			if (result.paused) {
				savedState = state;
				wizardLog("info", `Wizard paused at step "${result.currentStepTitle}": ${result.pauseReason || "user requested"}`);
			} else if (result.completed) {
				savedState = null;
				lastCompletedState = state;
				wizardLog("info", `Wizard completed. Data keys: ${Object.keys(result.data).filter((k) => !k.startsWith("__")).join(", ")}`);
			} else {
				savedState = null;
				lastCompletedState = null;
				wizardLog("info", "Wizard cancelled");
			}

			return result;
		},

		get isPaused(): boolean {
			return savedState !== null;
		},

		get isCompleted(): boolean {
			return lastCompletedState !== null;
		},

		addSteps(steps: WizardStep[]) {
			if (steps.length === 0) return;

			const existingIds = new Set(definition.steps.map((s) => s.id));
			validateSteps(steps, existingIds);

			const oldCount = definition.steps.length;
			definition.steps.push(...steps);
			wizardLog("info", `Added ${steps.length} steps: ${steps.map((s) => s.id).join(", ")} (total: ${definition.steps.length})`);

			if (lastCompletedState) {
				lastCompletedState.currentStepIndex = oldCount;
				lastCompletedState.completed = false;
				savedState = lastCompletedState;
				lastCompletedState = null;
				wizardLog("info", `Completed wizard reopened at step ${oldCount} (${steps[0].id})`);
			}
		},

		reportTaskResult(taskId: string, result: ActionTaskResult) {
			const state = savedState;
			if (!state) {
				wizardLog("warn", `reportTaskResult called but no saved state (taskId: ${taskId})`);
				return false;
			}

			const status = state.taskStatuses.get(taskId);
			if (!status) {
				wizardLog("warn", `reportTaskResult: unknown taskId "${taskId}"`);
				return false;
			}

			status.state = result.success ? "done" : "failed";
			status.output = result.output;
			status.error = result.error;
			state.data[`__action_${taskId}`] = result;

			wizardLog("info", `Task reported: ${taskId} — ${result.success ? "success" : "failed"}`);
			return true;
		},

		setData(key: string, value: any) {
			const state = savedState ?? lastCompletedState;
			if (!state) return;
			state.data[key] = value;
			wizardLog("info", `Data set: ${key}`);
		},

		reset() {
			savedState = null;
			lastCompletedState = null;
			wizardLog("info", "Wizard state reset");
		},
	};
}
