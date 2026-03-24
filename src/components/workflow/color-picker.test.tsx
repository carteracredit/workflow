import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorPicker } from "./color-picker";

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

describe("ColorPicker", () => {
	it("renders trigger with selected color", () => {
		render(<ColorPicker color="blue-500" onColorChange={vi.fn()} />);
		const triggers = screen.getAllByRole("button", {
			name: /color seleccionado: blue-500/i,
		});
		expect(triggers.length).toBeGreaterThan(0);
		expect(triggers[0]).toBeInTheDocument();
	});

	it("opens popover on trigger click and shows color options", async () => {
		render(<ColorPicker color="red-500" onColorChange={vi.fn()} />);
		const trigger = screen.getByRole("button", {
			name: /color seleccionado: red-500/i,
		});
		fireEvent.click(trigger);
		expect(await screen.findByText("Seleccionar color")).toBeInTheDocument();
		const greenOption = await screen.findByRole("button", {
			name: "green-500",
		});
		expect(greenOption).toBeInTheDocument();
	});

	it("calls onColorChange when a color option is clicked", async () => {
		const onColorChange = vi.fn();
		render(<ColorPicker color="red-500" onColorChange={onColorChange} />);
		const trigger = screen.getByRole("button", {
			name: /color seleccionado: red-500/i,
		});
		fireEvent.click(trigger);
		const greenOption = await screen.findByRole("button", {
			name: "green-500",
		});
		fireEvent.click(greenOption);
		expect(onColorChange).toHaveBeenCalledWith("green-500");
	});

	it("applies className to trigger when provided", () => {
		const { container } = render(
			<ColorPicker
				color="blue-500"
				onColorChange={vi.fn()}
				className="custom-class"
			/>,
		);
		const trigger = container.querySelector("button");
		expect(trigger).toBeInTheDocument();
		expect(trigger?.className).toContain("custom-class");
	});
});
