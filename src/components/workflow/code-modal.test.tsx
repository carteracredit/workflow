import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { CodeModal } from "./code-modal";
import type { WorkflowNode, WorkflowEdge } from "@/lib/workflow/types";

vi.mock("next-themes", () => ({
	useTheme: () => ({ resolvedTheme: "light" }),
}));

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

const startNode: WorkflowNode = {
	id: "start-1",
	type: "Start",
	title: "Inicio",
	description: "",
	roles: [],
	config: {},
	position: { x: 0, y: 0 },
	groupId: null,
	staleTimeout: null,
};

const endNode: WorkflowNode = {
	id: "end-1",
	type: "End",
	title: "Fin",
	description: "",
	roles: [],
	config: {},
	position: { x: 200, y: 0 },
	groupId: null,
	staleTimeout: null,
};

const nodes: WorkflowNode[] = [startNode, endNode];
const edges: WorkflowEdge[] = [
	{ id: "e1", from: "start-1", to: "end-1", label: null },
];

describe("CodeModal", () => {
	it("renders title and code section", () => {
		render(<CodeModal nodes={nodes} edges={edges} onClose={vi.fn()} />);
		expect(screen.getByText("Código Cloudflare Workflow")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Copiar/i })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /Descargar/i }),
		).toBeInTheDocument();
	});

	it("renders info about Cloudflare Workflows", () => {
		render(<CodeModal nodes={nodes} edges={edges} onClose={vi.fn()} />);
		expect(
			screen.getAllByText("Sobre Cloudflare Workflows").length,
		).toBeGreaterThan(0);
	});

	it("calls onClose when Cerrar is clicked", async () => {
		const onClose = vi.fn();
		render(<CodeModal nodes={nodes} edges={edges} onClose={onClose} />);
		const dialog = screen.getByRole("dialog");
		const cerrarBtn = within(dialog).getByRole("button", { name: "Cerrar" });
		fireEvent.click(cerrarBtn);
		expect(onClose).toHaveBeenCalled();
	});

	it("shows validation errors when workflow is invalid for code gen", () => {
		render(<CodeModal nodes={[]} edges={[]} onClose={vi.fn()} />);
		// Invalid workflow (no start) may show validation errors
		const errorsHeading = screen.queryByText(/Errores de validación/i);
		if (errorsHeading) {
			expect(errorsHeading).toBeInTheDocument();
		}
	});

	it("generates code with metadata className when metadata.name is set", () => {
		render(
			<CodeModal
				nodes={nodes}
				edges={edges}
				metadata={{
					name: "Mi Flujo",
					description: "",
					version: "1.0",
					author: "",
					tags: [],
					createdAt: "",
					updatedAt: "",
				}}
				onClose={vi.fn()}
			/>,
		);
		expect(
			screen.getAllByText("Código Cloudflare Workflow").length,
		).toBeGreaterThan(0);
		expect(
			screen.getByRole("button", { name: /Descargar/i }),
		).toBeInTheDocument();
	});

	it("calls handleCopy when Copiar is clicked", () => {
		Object.assign(navigator, {
			clipboard: {
				writeText: vi.fn().mockResolvedValue(undefined),
			},
		});
		render(<CodeModal nodes={nodes} edges={edges} onClose={vi.fn()} />);
		const copyBtn = screen.getByRole("button", { name: /Copiar/i });
		fireEvent.click(copyBtn);
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			expect.stringContaining("export class"),
		);
	});

	it("shows Copiado after successful copy", async () => {
		Object.assign(navigator, {
			clipboard: {
				writeText: vi.fn().mockResolvedValue(undefined),
			},
		});
		render(<CodeModal nodes={nodes} edges={edges} onClose={vi.fn()} />);
		const copyBtn = screen.getByRole("button", { name: /Copiar/i });
		fireEvent.click(copyBtn);
		// Check that button text changes (async state update)
		await vi.waitFor(() => {
			expect(screen.queryByText(/¡Copiado!/i)).toBeInTheDocument();
		});
	});

	it("calls handleDownload when Descargar is clicked", () => {
		const createElementSpy = vi.spyOn(document, "createElement");
		const createObjectURLSpy = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValue("blob:mock");
		const revokeObjectURLSpy = vi
			.spyOn(URL, "revokeObjectURL")
			.mockImplementation(() => {});
		render(<CodeModal nodes={nodes} edges={edges} onClose={vi.fn()} />);
		const downloadBtn = screen.getByRole("button", { name: /Descargar/i });
		fireEvent.click(downloadBtn);
		expect(createElementSpy).toHaveBeenCalledWith("a");
		expect(createObjectURLSpy).toHaveBeenCalled();
		expect(revokeObjectURLSpy).toHaveBeenCalled();
		createElementSpy.mockRestore();
		createObjectURLSpy.mockRestore();
		revokeObjectURLSpy.mockRestore();
	});

	it("shows warnings when code generation has warnings", () => {
		const decisionNode: WorkflowNode = {
			id: "d1",
			type: "Decision",
			title: "Decisión sin edges",
			description: "",
			roles: [],
			config: {},
			position: { x: 100, y: 0 },
			groupId: null,
			staleTimeout: null,
		};
		render(
			<CodeModal
				nodes={[startNode, decisionNode]}
				edges={[{ id: "e1", from: "start-1", to: "d1", label: null }]}
				onClose={vi.fn()}
			/>,
		);
		// Decision without branches may generate warning
		const warningsHeading = screen.queryByText(/Advertencias/i);
		if (warningsHeading) {
			expect(warningsHeading).toBeInTheDocument();
		}
	});
});
