import { Key, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";
import type {
	ActionStep,
	ActionTaskResult,
	StepContext,
	StepRenderer,
} from "../types";
import { renderProgressBar } from "../utils";
import { wizardLog } from "../log";

const MAX_LOG_LINES = 20;
const VISIBLE_LOG_LINES = 8;
const SHELL_TIMEOUT_MS = 120_000;
const DELEGATED_PAUSE_DELAY_MS = 100;
const AUTO_EXECUTE_DELAY_MS = 50;

function formatError(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

export function createActionRenderer(stepCtx: StepContext): StepRenderer {
	const step = stepCtx.step as ActionStep;
	const { state, theme, onNext, onBack, onPause, refresh, pi, ctx } = stepCtx;
	const isDelegated = step.mode === "delegated" || step.tasks.every((t) => !t.run);

	let cachedLines: string[] | undefined;
	let executing = false;
	let allDone = false;
	let hasFailed = false;
	let failedTaskId: string | null = null;
	let logLines: string[] = [];

	for (const task of step.tasks) {
		if (!state.taskStatuses.has(task.id)) {
			state.taskStatuses.set(task.id, {
				id: task.id,
				label: task.label,
				state: "pending",
				output: undefined,
				error: undefined,
			});
		}
	}

	if (step.tasks.every((t) => state.taskStatuses.get(t.id)?.state === "done")) {
		allDone = true;
	}

	for (const task of step.tasks) {
		if (state.taskStatuses.get(task.id)?.state === "failed") {
			hasFailed = true;
			failedTaskId = task.id;
			break;
		}
	}

	function getProgress(): number {
		const totalWeight = step.tasks.reduce((s, t) => s + (t.weight ?? 1), 0);
		let doneWeight = 0;
		for (const task of step.tasks) {
			const status = state.taskStatuses.get(task.id);
			if (status?.state === "done") doneWeight += task.weight ?? 1;
			if (status?.state === "running") doneWeight += (task.weight ?? 1) * 0.5;
		}
		return totalWeight > 0 ? doneWeight / totalWeight : 0;
	}

	function addLog(line: string) {
		logLines.push(line);
		if (logLines.length > MAX_LOG_LINES) logLines = logLines.slice(-MAX_LOG_LINES);
	}

	function getPendingTasks(): { id: string; label: string; description?: string }[] {
		return step.tasks
			.filter((t) => {
				const s = state.taskStatuses.get(t.id);
				return s?.state === "pending" || s?.state === "failed";
			})
			.map((t) => ({ id: t.id, label: t.label, description: t.description }));
	}

	function formatPendingMessage(prefix: string): string {
		const pending = getPendingTasks();
		return `${prefix} "${step.title}":\n` +
			pending.map((t) => `- ${t.label}${t.description ? `: ${t.description}` : ""}`).join("\n");
	}

	function resetTasksFrom(fromTaskId: string) {
		let found = false;
		for (const task of step.tasks) {
			if (task.id === fromTaskId) found = true;
			if (found) {
				state.taskStatuses.set(task.id, {
					id: task.id,
					label: task.label,
					state: "pending",
					output: undefined,
					error: undefined,
				});
			}
		}
		hasFailed = false;
		failedTaskId = null;
	}

	async function executeShellTask(command: string): Promise<ActionTaskResult> {
		try {
			const execResult = await pi.exec("sh", ["-c", command], {
				timeout: SHELL_TIMEOUT_MS,
			});
			const output = (execResult.stdout || "").trim();
			const stderr = (execResult.stderr || "").trim();
			if (output) addLog("  " + output.split("\n").slice(-3).join("\n  "));
			return {
				success: execResult.code === 0,
				output,
				error: execResult.code !== 0 ? stderr || `Exit code ${execResult.code}` : undefined,
			};
		} catch (err: unknown) {
			return { success: false, error: formatError(err) };
		}
	}

	async function executeFunctionTask(
		fn: Exclude<ActionStep["tasks"][number]["run"], string | undefined>,
	): Promise<ActionTaskResult> {
		try {
			const result = await fn(state.data, ctx);
			if (result.output) addLog("  " + result.output.split("\n").slice(-3).join("\n  "));
			return result;
		} catch (err: unknown) {
			return { success: false, error: formatError(err) };
		}
	}

	async function executeTasks() {
		if (executing || allDone) return;
		executing = true;
		hasFailed = false;
		failedTaskId = null;

		for (const task of step.tasks) {
			const status = state.taskStatuses.get(task.id)!;
			if (status.state === "done") continue;
			if (!task.run) continue;

			status.state = "running";
			status.output = undefined;
			status.error = undefined;
			addLog(`▸ ${task.label}...`);
			wizardLog("info", `Task starting: ${task.id} (${task.label})`);
			cachedLines = undefined;
			refresh();

			const result = typeof task.run === "string"
				? await executeShellTask(task.run)
				: await executeFunctionTask(task.run);

			if (result.success) {
				status.state = "done";
				status.output = result.output;
				addLog(`  ✓ ${task.label} done`);
				wizardLog("info", `Task done: ${task.id}`);
			} else {
				status.state = "failed";
				status.error = result.error;
				addLog(`  ✗ ${task.label} failed: ${result.error}`);
				wizardLog("error", `Task failed: ${task.id}`);
				hasFailed = true;
				failedTaskId = task.id;
				break;
			}

			state.data[`__action_${task.id}`] = result;
			cachedLines = undefined;
			refresh();
		}

		if (!hasFailed) {
			allDone = true;
			addLog("All tasks completed.");
		}
		executing = false;
		cachedLines = undefined;
		refresh();
	}

	if (isDelegated && !allDone && !hasFailed) {
		const pending = getPendingTasks();
		if (pending.length > 0) {
			wizardLog("info", `Delegated action step "${step.id}": pausing for LLM to execute ${pending.length} tasks`);
			setTimeout(() => {
				onPause(formatPendingMessage("Action step"));
			}, DELEGATED_PAUSE_DELAY_MS);
		}
	}

	if (!isDelegated && !allDone) {
		setTimeout(() => executeTasks(), AUTO_EXECUTE_DELAY_MS);
	}

	return {
		render(width: number): string[] {
			if (cachedLines) return cachedLines;

			const lines: string[] = [];
			const add = (s: string) => lines.push(truncateToWidth(s, width));

			for (const task of step.tasks) {
				const status = state.taskStatuses.get(task.id)!;
				let icon: string;
				let color: string;
				switch (status.state) {
					case "pending":
						icon = theme.fg("dim", "○");
						color = "dim";
						break;
					case "running":
						icon = theme.fg("accent", "◐");
						color = "accent";
						break;
					case "done":
						icon = theme.fg("success", "✓");
						color = "success";
						break;
					case "failed":
						icon = theme.fg("error", "✗");
						color = "error";
						break;
				}
				add(` ${icon} ${theme.fg(color, task.label)}`);
				if (status.state === "done" && status.output) {
					add(`     ${theme.fg("dim", status.output.split("\n")[0])}`);
				}
				if (status.state === "failed" && status.error) {
					add(`     ${theme.fg("error", status.error)}`);
				}
			}

			lines.push("");
			add(renderProgressBar(getProgress(), width, theme));

			if (!isDelegated && logLines.length > 0) {
				lines.push("");
				for (const log of logLines.slice(-VISIBLE_LOG_LINES)) {
					add(" " + theme.fg("dim", log));
				}
			}

			lines.push("");
			if (executing) {
				add(" " + theme.fg("dim", "Running... • ? to pause and get help"));
			} else if (allDone) {
				add(" " + theme.fg("dim", "Enter to continue • Esc to go back • ? for help"));
			} else if (hasFailed) {
				add(" " + theme.fg("dim", "Enter to retry • Esc to go back • ? for help"));
			} else if (isDelegated) {
				add(" " + theme.fg("dim", "Waiting for tasks to be completed..."));
			}

			cachedLines = lines;
			return cachedLines;
		},

		handleInput(data: string) {
			if (data === "?") {
				const failedTask = failedTaskId
					? state.taskStatuses.get(failedTaskId)
					: null;
				const reason = failedTask
					? `Task "${failedTask.label}" failed. Review the action step output for details.`
					: executing
						? "Paused during task execution"
						: allDone
							? "All tasks completed"
							: "Paused";
				onPause(reason);
				return;
			}

			if (executing) return;

			if (matchesKey(data, Key.enter)) {
				if (allDone) {
					onNext();
				} else if (hasFailed && failedTaskId) {
					resetTasksFrom(failedTaskId);
					if (isDelegated) {
						onPause(formatPendingMessage("Retrying action step"));
					} else {
						cachedLines = undefined;
						refresh();
						setTimeout(() => executeTasks(), AUTO_EXECUTE_DELAY_MS);
					}
				}
			} else if (matchesKey(data, Key.escape)) {
				onBack();
			}
		},

		invalidate() {
			cachedLines = undefined;
		},
	};
}
