import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Palette } from "./palette";

const renderWithTooltip = (ui: React.ReactElement) =>
	render(<TooltipProvider>{ui}</TooltipProvider>);

vi.mock("@/components/LanguageProvider", async () => {
	const { translations } = await import("@/lib/translations");
	const tFn = (key: string) => {
		const parts = key.split(".");
		let val: unknown = translations.es;
		for (const part of parts) {
			if (val && typeof val === "object") {
				val = (val as Record<string, unknown>)[part];
			} else {
				return key;
			}
		}
		return typeof val === "string" ? val : key;
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

describe("Palette", () => {
	it("renders add buttons for node types", () => {
		renderWithTooltip(
			<Palette onAddNode={vi.fn()} zoom={1} pan={{ x: 0, y: 0 }} />,
		);
		expect(
			screen.getByRole("button", { name: "Agregar Inicio" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Agregar Decisión" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Agregar Fin" }),
		).toBeInTheDocument();
	});

	it("calls onAddNode with new node when Start is clicked", async () => {
		const onAddNode = vi.fn();
		renderWithTooltip(
			<Palette onAddNode={onAddNode} zoom={1} pan={{ x: 0, y: 0 }} />,
		);
		const startBtn = screen.getByRole("button", { name: "Agregar Inicio" });
		fireEvent.click(startBtn);
		expect(onAddNode).toHaveBeenCalledTimes(1);
		const [node] = onAddNode.mock.calls[0];
		expect(node).toBeDefined();
		expect(node.type).toBe("Start");
		// title is always "Start" (canonical EN) so alias is language-agnostic
		expect(node.title).toBe("Start");
		// localized label stored in titleEs for display
		expect(node.titleEs).toBe("Inicio");
		expect(typeof node.id).toBe("string");
		expect(node.id).toMatch(/^node-/);
		expect(node.position).toBeDefined();
		expect(node.roles).toEqual([]);
		expect(node.config).toEqual({});
	});

	it("calls onAddNode with Challenge config when Challenge is clicked", async () => {
		const onAddNode = vi.fn();
		renderWithTooltip(
			<Palette onAddNode={onAddNode} zoom={1} pan={{ x: 0, y: 0 }} />,
		);
		const challengeBtn = screen.getByRole("button", {
			name: "Agregar Challenge",
		});
		fireEvent.click(challengeBtn);
		const [node] = onAddNode.mock.calls[0];
		expect(node.type).toBe("Challenge");
		expect(node.config).toMatchObject({
			challengeType: "acceptance",
			deliveryMethod: "none",
		});
	});

	it("calls onAddNode with checkpointType when Checkpoint is clicked", async () => {
		const onAddNode = vi.fn();
		renderWithTooltip(
			<Palette onAddNode={onAddNode} zoom={1} pan={{ x: 0, y: 0 }} />,
		);
		const checkpointBtn = screen.getByRole("button", {
			name: "Agregar Checkpoint",
		});
		fireEvent.click(checkpointBtn);
		const [node] = onAddNode.mock.calls[0];
		expect(node.type).toBe("Checkpoint");
		expect(node.checkpointType).toBe("normal");
	});

	it("calls onAddNode with default GeneratePDF config when Generate PDF is clicked", async () => {
		const onAddNode = vi.fn();
		renderWithTooltip(
			<Palette onAddNode={onAddNode} zoom={1} pan={{ x: 0, y: 0 }} />,
		);
		const generatePdfBtn = screen.getByRole("button", {
			name: "Agregar Generar PDF",
		});
		fireEvent.click(generatePdfBtn);
		const [node] = onAddNode.mock.calls[0];
		expect(node.type).toBe("GeneratePDF");
		expect(node.config).toEqual({
			pdfTemplateId: undefined,
			pdfTemplateName: undefined,
			fieldMappings: [],
		});
	});

	it("applies className to container when provided", () => {
		const { container } = renderWithTooltip(
			<Palette
				onAddNode={vi.fn()}
				zoom={1}
				pan={{ x: 0, y: 0 }}
				className="custom-palette"
			/>,
		);
		expect(container.querySelector(".custom-palette")).toBeInTheDocument();
	});
});
