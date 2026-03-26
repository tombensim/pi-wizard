import { Editor, type EditorTheme, Key, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";
import type {
	ConfirmField,
	FormField,
	FormStep,
	SelectField,
	StepContext,
	StepRenderer,
	TextField,
	PasswordField,
} from "../types";
import { maskPassword } from "../utils";

export function createFormRenderer(stepCtx: StepContext): StepRenderer {
	const step = stepCtx.step as FormStep;
	const { state, theme, tui, onNext, onBack, onPause, refresh } = stepCtx;
	const fields = step.fields;

	let activeFieldIndex = 0;
	let editing = false;
	let selectIndex = 0;
	let cachedLines: string[] | undefined;
	const fieldValues = new Map<string, unknown>();
	const fieldErrors = new Map<string, string>();

	// Editor for text/password input
	const editorTheme: EditorTheme = {
		borderColor: (s: string) => theme.fg("accent", s),
		selectList: {
			selectedPrefix: (t: string) => theme.fg("accent", t),
			selectedText: (t: string) => theme.fg("accent", t),
			description: (t: string) => theme.fg("muted", t),
			scrollInfo: (t: string) => theme.fg("dim", t),
			noMatch: (t: string) => theme.fg("warning", t),
		},
	};
	const editor = new Editor(tui as any, editorTheme);

	// Initialize field values from state.data or defaults
	for (const field of fields) {
		const existing = state.data[field.id];
		if (existing !== undefined) {
			fieldValues.set(field.id, existing);
		} else if ("default" in field && field.default !== undefined) {
			fieldValues.set(field.id, field.default);
		} else if (field.type === "confirm") {
			fieldValues.set(field.id, field.default ?? false);
		}
	}

	function currentField(): FormField {
		return fields[activeFieldIndex];
	}

	function getFieldValue(field: FormField): unknown {
		return fieldValues.get(field.id);
	}

	function setFieldValue(field: FormField, value: unknown) {
		fieldValues.set(field.id, value);
		fieldErrors.delete(field.id);
	}

	function validateField(field: FormField): boolean {
		const value = getFieldValue(field);

		if (field.type === "text" || field.type === "password") {
			if (field.required && (!value || String(value).trim() === "")) {
				fieldErrors.set(field.id, "This field is required");
				return false;
			}
		}

		if (field.type === "text" && field.validate) {
			const err = field.validate(String(value ?? ""), state.data);
			if (err) {
				fieldErrors.set(field.id, err);
				return false;
			}
		}

		fieldErrors.delete(field.id);
		return true;
	}

	function validateAll(): boolean {
		let valid = true;
		for (const field of fields) {
			if (!validateField(field)) valid = false;
		}
		return valid;
	}

	function commitToState() {
		for (const field of fields) {
			state.data[field.id] = getFieldValue(field);
		}
	}

	function advanceOrStopEditing() {
		if (activeFieldIndex < fields.length - 1) {
			activeFieldIndex++;
			startEditing();
		} else {
			cachedLines = undefined;
			refresh();
		}
	}

	function startEditing() {
		const field = currentField();
		editing = true;

		if (field.type === "text" || field.type === "password") {
			const val = getFieldValue(field);
			editor.setText(val !== undefined ? String(val) : "");
		} else if (field.type === "select") {
			const current = getFieldValue(field);
			selectIndex = Math.max(0, field.options.findIndex((o) => o.value === current));
		}

		cachedLines = undefined;
		refresh();
	}

	function stopEditing(save: boolean) {
		const field = currentField();

		if (save) {
			if (field.type === "text" || field.type === "password") {
				setFieldValue(field, editor.getText());
			} else if (field.type === "select") {
				setFieldValue(field, field.options[selectIndex]?.value);
			}
		}

		editing = false;
		editor.setText("");
		cachedLines = undefined;
		refresh();
	}

	// Editor submit callback
	editor.onSubmit = (value: string) => {
		setFieldValue(currentField(), value);
		editing = false;
		editor.setText("");
		advanceOrStopEditing();
	};

	// ── Per-type input handlers (editing mode) ──

	function handleSelectInput(data: string, field: SelectField): boolean {
		if (matchesKey(data, Key.up)) {
			selectIndex = Math.max(0, selectIndex - 1);
		} else if (matchesKey(data, Key.down)) {
			selectIndex = Math.min(field.options.length - 1, selectIndex + 1);
		} else if (matchesKey(data, Key.enter)) {
			stopEditing(true);
			advanceOrStopEditing();
			return true;
		} else if (matchesKey(data, Key.escape)) {
			stopEditing(false);
			return true;
		}
		cachedLines = undefined;
		refresh();
		return true;
	}

	function handleConfirmInput(data: string): boolean {
		const val = getFieldValue(currentField()) === true;
		if (matchesKey(data, Key.left) || matchesKey(data, Key.right) || data === " ") {
			setFieldValue(currentField(), !val);
		} else if (matchesKey(data, Key.enter)) {
			stopEditing(true);
			advanceOrStopEditing();
			return true;
		} else if (matchesKey(data, Key.escape)) {
			stopEditing(false);
			return true;
		}
		cachedLines = undefined;
		refresh();
		return true;
	}

	// ── Render helpers ──

	function renderTextField(field: TextField | PasswordField, isActive: boolean, width: number): string[] {
		const lines: string[] = [];
		const add = (s: string) => lines.push(truncateToWidth(s, width));
		const prefix = isActive ? theme.fg("accent", "▸ ") : "  ";
		const labelColor = isActive ? "accent" : "text";
		const value = getFieldValue(field);

		if (isActive && editing) {
			add(prefix + theme.fg(labelColor, field.label + ":"));
			for (const line of editor.render(width - 4)) {
				add("    " + line);
			}
		} else {
			const isPassword = field.type === "password";
			const display = value
				? theme.fg("text", isPassword ? maskPassword(String(value)) : String(value))
				: theme.fg("dim", (field.type === "text" ? field.placeholder : undefined) ?? "(empty)");
			add(prefix + theme.fg(labelColor, field.label + ": ") + display);
		}
		return lines;
	}

	function renderSelectField(field: SelectField, isActive: boolean, width: number): string[] {
		const lines: string[] = [];
		const add = (s: string) => lines.push(truncateToWidth(s, width));
		const prefix = isActive ? theme.fg("accent", "▸ ") : "  ";
		const labelColor = isActive ? "accent" : "text";
		const value = getFieldValue(field);

		if (isActive && editing) {
			add(prefix + theme.fg(labelColor, field.label + ":"));
			for (let j = 0; j < field.options.length; j++) {
				const opt = field.options[j];
				const isSelected = j === selectIndex;
				const radio = isSelected
					? theme.fg("accent", "● ")
					: theme.fg("dim", "○ ");
				const optColor = isSelected ? "accent" : "text";
				add("    " + radio + theme.fg(optColor, opt.label));
				if (opt.description) {
					add("      " + theme.fg("dim", opt.description));
				}
			}
		} else {
			const selected = field.options.find((o) => o.value === value);
			const display = selected
				? theme.fg("text", selected.label)
				: theme.fg("dim", "(not selected)");
			add(prefix + theme.fg(labelColor, field.label + ": ") + display);
		}
		return lines;
	}

	function renderConfirmField(field: ConfirmField, isActive: boolean, width: number): string[] {
		const lines: string[] = [];
		const add = (s: string) => lines.push(truncateToWidth(s, width));
		const prefix = isActive ? theme.fg("accent", "▸ ") : "  ";
		const labelColor = isActive ? "accent" : "text";
		const val = getFieldValue(field) === true;

		if (isActive && editing) {
			const yes = val ? theme.fg("accent", "[Yes]") : theme.fg("dim", " Yes ");
			const no = !val ? theme.fg("accent", "[No]") : theme.fg("dim", " No ");
			add(prefix + theme.fg(labelColor, field.label + ": ") + yes + "  " + no);
			add("    " + theme.fg("dim", "←/→ toggle • Enter confirm"));
		} else {
			const display = val
				? theme.fg("success", "Yes")
				: theme.fg("text", "No");
			add(prefix + theme.fg(labelColor, field.label + ": ") + display);
		}
		return lines;
	}

	return {
		render(width: number): string[] {
			if (cachedLines) return cachedLines;

			const lines: string[] = [];

			for (let i = 0; i < fields.length; i++) {
				const field = fields[i];
				const isActive = i === activeFieldIndex;
				const error = fieldErrors.get(field.id);

				switch (field.type) {
					case "text":
					case "password":
						lines.push(...renderTextField(field, isActive, width));
						break;
					case "select":
						lines.push(...renderSelectField(field, isActive, width));
						break;
					case "confirm":
						lines.push(...renderConfirmField(field, isActive, width));
						break;
				}

				if (error) {
					lines.push(truncateToWidth("    " + theme.fg("error", "⚠ " + error), width));
				}
			}

			lines.push("");
			if (editing) {
				const field = currentField();
				if (field.type === "text" || field.type === "password") {
					lines.push(truncateToWidth(" " + theme.fg("dim", "Enter to submit • Esc to cancel"), width));
				} else if (field.type === "select") {
					lines.push(truncateToWidth(" " + theme.fg("dim", "↑↓ select • Enter confirm • Esc cancel"), width));
				}
			} else {
				lines.push(truncateToWidth(" " + theme.fg("dim", "↑↓ navigate • Enter edit • Tab next • Esc back • ? help"), width));
			}

			cachedLines = lines;
			return cachedLines;
		},

		handleInput(data: string) {
			if (editing) {
				const field = currentField();
				switch (field.type) {
					case "select":
						handleSelectInput(data, field);
						return;
					case "confirm":
						handleConfirmInput(data);
						return;
					default:
						// Text / password — delegate to editor
						if (matchesKey(data, Key.escape)) {
							stopEditing(false);
							return;
						}
						editor.handleInput(data);
						cachedLines = undefined;
						refresh();
						return;
				}
			}

			// Navigation mode
			if (data === "?") {
				for (const field of fields) {
					const val = getFieldValue(field);
					if (val !== undefined) state.data[field.id] = val;
				}
				onPause();
				return;
			}
			if (matchesKey(data, Key.up)) {
				activeFieldIndex = Math.max(0, activeFieldIndex - 1);
			} else if (matchesKey(data, Key.down)) {
				activeFieldIndex = Math.min(fields.length - 1, activeFieldIndex + 1);
			} else if (matchesKey(data, Key.enter)) {
				startEditing();
				return;
			} else if (matchesKey(data, Key.tab)) {
				if (validateAll()) {
					commitToState();
					onNext();
					return;
				}
			} else if (matchesKey(data, Key.escape) || matchesKey(data, Key.shift("tab"))) {
				onBack();
				return;
			}

			cachedLines = undefined;
			refresh();
		},

		invalidate() {
			cachedLines = undefined;
		},
	};
}
