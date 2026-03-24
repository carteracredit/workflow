import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ValidationTray } from "./validation-tray";
import type { ValidationError } from "@/lib/workflow/types";

vi.mock("@/components/LanguageProvider", async () => {
	const { translations } = await import("@/lib/translations");
	const tFn = (key: string, params?: Record<string, string | number>) => {
		const parts = key.split(".");
		let val: unknown = translations.es;
		for (const part of parts) {
			if (val && typeof val === "object") {
				val = (val as Record<string, unknown>)[part];
			} else {
				return key;
			}
		}
		if (typeof val !== "string") return key;
		if (params) {
			return val.replace(/\{(\w+)\}/g, (_, k) =>
				params[k] !== undefined ? String(params[k]) : `{${k}}`,
			);
		}
		return val;
	};
	return {
		useLanguage: () => ({ language: "es", setLanguage: vi.fn(), t: tFn }),
	};
});

describe("ValidationTray", () => {
	it("renders count of findings (singular)", () => {
		const errors: ValidationError[] = [
			{ message: "One error", severity: "error" },
		];
		render(
			<ValidationTray
				errors={errors}
				onClose={vi.fn()}
				onSelectNode={vi.fn()}
			/>,
		);
		expect(screen.getByText(/1 hallazgo de validación/)).toBeInTheDocument();
	});

	it("renders count of findings (plural)", () => {
		const errors: ValidationError[] = [
			{ message: "Error 1", severity: "error" },
			{ message: "Warning 1", severity: "warning" },
		];
		render(
			<ValidationTray
				errors={errors}
				onClose={vi.fn()}
				onSelectNode={vi.fn()}
			/>,
		);
		expect(screen.getByText(/2 hallazgos de validación/)).toBeInTheDocument();
	});

	it("shows error and warning counts", () => {
		const errors: ValidationError[] = [
			{ message: "Error 1", severity: "error" },
			{ message: "Warning 1", severity: "warning" },
		];
		render(
			<ValidationTray
				errors={errors}
				onClose={vi.fn()}
				onSelectNode={vi.fn()}
			/>,
		);
		expect(screen.getAllByText(/1 errores/).length).toBeGreaterThan(0);
		expect(screen.getAllByText(/1 avisos/).length).toBeGreaterThan(0);
	});

	it("renders each error message", () => {
		const errors: ValidationError[] = [
			{ message: "Missing start node", severity: "error" },
			{ message: "Unconnected node", severity: "warning", nodeId: "node-1" },
		];
		render(
			<ValidationTray
				errors={errors}
				onClose={vi.fn()}
				onSelectNode={vi.fn()}
			/>,
		);
		expect(screen.getByText("Missing start node")).toBeInTheDocument();
		expect(screen.getByText("Unconnected node")).toBeInTheDocument();
	});

	it("calls onClose when close button is clicked", async () => {
		const onClose = vi.fn();
		const { container } = render(
			<ValidationTray
				errors={[{ message: "Err", severity: "error" }]}
				onClose={onClose}
				onSelectNode={vi.fn()}
			/>,
		);
		const closeButton = container.querySelector("button");
		expect(closeButton).toBeInTheDocument();
		fireEvent.click(closeButton!);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("calls onSelectNode when an error with nodeId is clicked", async () => {
		const onSelectNode = vi.fn();
		const errors: ValidationError[] = [
			{ message: "Node issue", severity: "error", nodeId: "node-abc" },
		];
		const { container } = render(
			<ValidationTray
				errors={errors}
				onClose={vi.fn()}
				onSelectNode={onSelectNode}
			/>,
		);
		const messageEl = within(container).getByText("Node issue");
		fireEvent.click(messageEl);
		expect(onSelectNode).toHaveBeenCalledWith("node-abc");
	});

	it("has aria-live polite for accessibility", () => {
		render(
			<ValidationTray errors={[]} onClose={vi.fn()} onSelectNode={vi.fn()} />,
		);
		const liveRegion = document.querySelector('[aria-live="polite"]');
		expect(liveRegion).toBeInTheDocument();
	});
});
