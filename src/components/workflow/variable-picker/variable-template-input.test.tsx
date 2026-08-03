import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VariableTemplateInput } from "./variable-template-input";
import type { TemplateSegment } from "./variable-template-input";

// ---------------------------------------------------------------------------
// Tests: whitespace-only segments must be preserved, not dropped by a
// truthiness check on the pending text input (regression: a single space
// typed to separate two inserted variables, e.g. "${streetNumber} ${streetName}",
// was being silently discarded before it reached the URL builder).
// ---------------------------------------------------------------------------

describe("VariableTemplateInput — whitespace-only segments", () => {
	it("keeps a single space as a text segment when pressing Enter", () => {
		const handleChange = vi.fn<(segments: TemplateSegment[]) => void>();
		render(<VariableTemplateInput nodes={[]} onChange={handleChange} />);

		const input = screen.getByPlaceholderText(
			"Escribe texto o agrega variables...",
		);
		fireEvent.change(input, { target: { value: " " } });
		fireEvent.keyDown(input, { key: "Enter" });

		expect(handleChange).toHaveBeenCalledWith([
			expect.objectContaining({ type: "text", value: " " }),
		]);
	});

	it("keeps a single space as a text segment on blur", () => {
		const handleChange = vi.fn<(segments: TemplateSegment[]) => void>();
		render(<VariableTemplateInput nodes={[]} onChange={handleChange} />);

		const input = screen.getByPlaceholderText(
			"Escribe texto o agrega variables...",
		);
		fireEvent.change(input, { target: { value: " " } });
		fireEvent.blur(input);

		expect(handleChange).toHaveBeenCalledWith([
			expect.objectContaining({ type: "text", value: " " }),
		]);
	});

	it("does NOT create an empty segment on blur when the input is truly empty", () => {
		const handleChange = vi.fn<(segments: TemplateSegment[]) => void>();
		render(<VariableTemplateInput nodes={[]} onChange={handleChange} />);

		const input = screen.getByPlaceholderText(
			"Escribe texto o agrega variables...",
		);
		fireEvent.blur(input);

		expect(handleChange).not.toHaveBeenCalled();
	});

	it("renders a whitespace-only text segment chip visibly (whitespace-pre)", () => {
		const segments: TemplateSegment[] = [
			{ id: "seg_1", type: "text", value: " " },
		];
		render(
			<VariableTemplateInput nodes={[]} value={segments} onChange={vi.fn()} />,
		);

		const chipText = document.querySelector(".whitespace-pre");
		expect(chipText).not.toBeNull();
		expect(chipText?.textContent).toBe(" ");
	});
});
