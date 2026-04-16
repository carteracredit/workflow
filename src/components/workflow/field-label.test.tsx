import { describe, it, expect } from "vitest";
import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FieldLabel } from "./field-label";
import { TooltipProvider } from "@/components/ui/tooltip";

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
		useLanguage: () => ({
			language: "es",
			setLanguage: vi.fn(),
			t: tFn,
			getFieldLabel: (label: string, labelEs?: string) => labelEs || label,
			getFieldPlaceholder: (ph?: string, phEs?: string) => phEs || ph,
		}),
	};
});

function renderWithTooltipProvider(ui: React.ReactElement) {
	return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("FieldLabel", () => {
	it("renders the label text", () => {
		renderWithTooltipProvider(
			<FieldLabel htmlFor="test-input">Mi Campo</FieldLabel>,
		);
		expect(screen.getByText("Mi Campo")).toBeInTheDocument();
	});

	it("renders without info icon when no description is provided", () => {
		renderWithTooltipProvider(
			<FieldLabel htmlFor="test-input">Mi Campo</FieldLabel>,
		);
		expect(
			screen.queryByRole("button", { name: /más información/i }),
		).not.toBeInTheDocument();
	});

	it("renders info icon button when description is provided", () => {
		renderWithTooltipProvider(
			<FieldLabel htmlFor="test-input" description="Esto es una descripción">
				Mi Campo
			</FieldLabel>,
		);
		expect(
			screen.getByRole("button", { name: /más información/i }),
		).toBeInTheDocument();
	});

	it("shows tooltip on hover of info icon", async () => {
		const user = userEvent.setup();
		renderWithTooltipProvider(
			<FieldLabel htmlFor="test-input" description="Descripción del campo">
				Mi Campo
			</FieldLabel>,
		);

		const infoButton = screen.getByRole("button", { name: /más información/i });
		await user.hover(infoButton);

		// Radix renders tooltip text twice: visible div + hidden aria span (role="tooltip")
		const tooltip = await screen.findByRole("tooltip");
		expect(tooltip).toHaveTextContent("Descripción del campo");
	});
});
