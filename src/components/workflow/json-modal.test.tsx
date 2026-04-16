import { describe, it, expect, vi } from "vitest";
import {
	render,
	screen,
	fireEvent,
	within,
	waitFor,
} from "@testing-library/react";
import { JSONModal } from "./json-modal";
import type { WorkflowNode, WorkflowEdge, Flag } from "@/lib/workflow/types";

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

const mockNodes: WorkflowNode[] = [
	{
		id: "n1",
		type: "Start",
		title: "Inicio",
		description: "",
		roles: [],
		config: {},
		position: { x: 0, y: 0 },
		groupId: null,
		staleTimeout: null,
	},
];
const mockEdges: WorkflowEdge[] = [];
const mockFlags: Flag[] = [
	{
		id: "flag-1",
		name: "Estado",
		options: [
			{ id: "opt-1", label: "Pendiente", color: "yellow-500" },
			{ id: "opt-2", label: "Aprobado", color: "green-500" },
		],
	},
];
const workflow = { nodes: mockNodes, edges: mockEdges, flags: mockFlags };
const workflowNoFlags = { nodes: mockNodes, edges: mockEdges, flags: [] };

describe("JSONModal", () => {
	describe("export mode", () => {
		it("renders export title and pre-filled JSON", () => {
			render(
				<JSONModal
					mode="export"
					workflow={workflow}
					onClose={vi.fn()}
					onImport={vi.fn()}
				/>,
			);
			expect(screen.getByText("Exportar JSON")).toBeInTheDocument();
			const textarea = screen.getByRole("textbox");
			expect(textarea).toHaveAttribute("readonly");
			const value = (textarea as HTMLTextAreaElement).value;
			expect(value).toContain("nodes");
			expect(value).toContain("edges");
		});

		it("includes flags in exported JSON", () => {
			render(
				<JSONModal
					mode="export"
					workflow={workflow}
					onClose={vi.fn()}
					onImport={vi.fn()}
				/>,
			);
			const textarea = screen.getByRole("textbox");
			const value = (textarea as HTMLTextAreaElement).value;
			const parsed = JSON.parse(value);
			expect(parsed).toHaveProperty("flags");
			expect(parsed.flags).toHaveLength(1);
			expect(parsed.flags[0].name).toBe("Estado");
		});

		it("shows Download button in export mode", () => {
			render(
				<JSONModal
					mode="export"
					workflow={workflow}
					onClose={vi.fn()}
					onImport={vi.fn()}
				/>,
			);
			expect(
				screen.getByRole("button", { name: /Descargar/i }),
			).toBeInTheDocument();
		});

		it("calls onClose when Cancel is clicked", async () => {
			const onClose = vi.fn();
			render(
				<JSONModal
					mode="export"
					workflow={workflow}
					onClose={onClose}
					onImport={vi.fn()}
				/>,
			);
			const dialog = screen.getByRole("dialog");
			const cancelBtn = within(dialog).getByRole("button", {
				name: "Cancelar",
			});
			fireEvent.click(cancelBtn);
			expect(onClose).toHaveBeenCalled();
		});
	});

	describe("import mode", () => {
		it("renders import title and empty textarea", () => {
			render(
				<JSONModal
					mode="import"
					workflow={workflowNoFlags}
					onClose={vi.fn()}
					onImport={vi.fn()}
				/>,
			);
			expect(screen.getByText("Importar JSON")).toBeInTheDocument();
			const textarea = screen.getByRole("textbox");
			expect(textarea).not.toHaveAttribute("readonly");
			expect(textarea).toHaveValue("");
		});

		it("shows Import button in import mode", () => {
			render(
				<JSONModal
					mode="import"
					workflow={workflowNoFlags}
					onClose={vi.fn()}
					onImport={vi.fn()}
				/>,
			);
			expect(
				screen.getByRole("button", { name: /Importar/i }),
			).toBeInTheDocument();
		});

		it("calls onImport with parsed nodes and edges when valid JSON", async () => {
			const onImport = vi.fn();
			render(
				<JSONModal
					mode="import"
					workflow={workflowNoFlags}
					onClose={vi.fn()}
					onImport={onImport}
				/>,
			);
			const textarea = screen.getByPlaceholderText(
				/Pega el JSON del flujo aquí/i,
			);
			const validJson = JSON.stringify({
				nodes: mockNodes,
				edges: mockEdges,
			});
			fireEvent.change(textarea, { target: { value: validJson } });
			fireEvent.click(screen.getByRole("button", { name: "Importar" }));
			expect(onImport).toHaveBeenCalledTimes(1);
			expect(onImport.mock.calls[0][0]).toHaveProperty("nodes");
			expect(onImport.mock.calls[0][0]).toHaveProperty("edges");
		});

		it("passes flags when importing JSON that includes them", async () => {
			const onImport = vi.fn();
			render(
				<JSONModal
					mode="import"
					workflow={workflowNoFlags}
					onClose={vi.fn()}
					onImport={onImport}
				/>,
			);
			const textarea = screen.getByPlaceholderText(
				/Pega el JSON del flujo aquí/i,
			);
			const validJson = JSON.stringify({
				nodes: mockNodes,
				edges: mockEdges,
				flags: mockFlags,
			});
			fireEvent.change(textarea, { target: { value: validJson } });
			fireEvent.click(screen.getByRole("button", { name: "Importar" }));
			expect(onImport).toHaveBeenCalledTimes(1);
			const importedData = onImport.mock.calls[0][0];
			expect(importedData.flags).toHaveLength(1);
			expect(importedData.flags[0].name).toBe("Estado");
		});

		it("defaults flags to [] when importing legacy JSON without flags", async () => {
			const onImport = vi.fn();
			render(
				<JSONModal
					mode="import"
					workflow={workflowNoFlags}
					onClose={vi.fn()}
					onImport={onImport}
				/>,
			);
			const textarea = screen.getByPlaceholderText(
				/Pega el JSON del flujo aquí/i,
			);
			// Old export format without flags
			const legacyJson = JSON.stringify({ nodes: mockNodes, edges: mockEdges });
			fireEvent.change(textarea, { target: { value: legacyJson } });
			fireEvent.click(screen.getByRole("button", { name: "Importar" }));
			expect(onImport).toHaveBeenCalledTimes(1);
			expect(onImport.mock.calls[0][0].flags).toEqual([]);
		});

		it("shows error when JSON is invalid", async () => {
			const onImport = vi.fn();
			render(
				<JSONModal
					mode="import"
					workflow={workflowNoFlags}
					onClose={vi.fn()}
					onImport={onImport}
				/>,
			);
			const textarea = screen.getByPlaceholderText(
				/Pega el JSON del flujo aquí/i,
			);
			fireEvent.change(textarea, { target: { value: "{ invalid json" } });
			fireEvent.click(screen.getByRole("button", { name: "Importar" }));
			// Invalid JSON: onImport not called and error message shown (SyntaxError message varies by engine)
			expect(onImport).not.toHaveBeenCalled();
			const dialog = screen.getByRole("dialog");
			await waitFor(() => {
				expect(dialog.textContent).toMatch(
					/invalid|Error|Unexpected|parsear|JSON/i,
				);
			});
		});

		it("shows error when JSON has no nodes array", async () => {
			render(
				<JSONModal
					mode="import"
					workflow={workflowNoFlags}
					onClose={vi.fn()}
					onImport={vi.fn()}
				/>,
			);
			const textarea = screen.getByPlaceholderText(
				/Pega el JSON del flujo aquí/i,
			);
			fireEvent.change(textarea, {
				target: { value: JSON.stringify({ edges: [] }) },
			});
			fireEvent.click(screen.getByRole("button", { name: "Importar" }));
			expect(
				screen.getByText(/Formato inválido: falta el array "nodes"/i),
			).toBeInTheDocument();
		});

		it("shows error when JSON has no edges array", async () => {
			render(
				<JSONModal
					mode="import"
					workflow={workflowNoFlags}
					onClose={vi.fn()}
					onImport={vi.fn()}
				/>,
			);
			const textarea = screen.getByPlaceholderText(
				/Pega el JSON del flujo aquí/i,
			);
			fireEvent.change(textarea, {
				target: { value: JSON.stringify({ nodes: [] }) },
			});
			fireEvent.click(screen.getByRole("button", { name: "Importar" }));
			expect(
				screen.getByText(/Formato inválido: falta el array "edges"/i),
			).toBeInTheDocument();
		});
	});
});
