import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PublishModal } from "./publish-modal";
import type {
	WorkflowNode,
	WorkflowEdge,
	WorkflowMetadata,
} from "@/lib/workflow/types";

// Mock sonner toast
vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
	Toaster: () => null,
}));

// Helper to create a basic node
const createNode = (
	overrides: Partial<WorkflowNode> & { id: string; type: WorkflowNode["type"] },
): WorkflowNode => ({
	title: overrides.type,
	description: "",
	roles: [],
	config: {},
	position: { x: 0, y: 0 },
	groupId: null,
	staleTimeout: null,
	...overrides,
});

// Helper to create an edge
const createEdge = (
	from: string,
	to: string,
	overrides?: Partial<WorkflowEdge>,
): WorkflowEdge => ({
	id: `edge-${from}-${to}`,
	from,
	to,
	label: null,
	...overrides,
});

describe("PublishModal", () => {
	const mockOnClose = vi.fn();
	const metadata: WorkflowMetadata = {
		name: "Test Workflow",
		description: "Test description",
		version: "1.0.0",
		author: "Test Author",
		tags: [],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should render modal with phases", async () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [createEdge("start", "end")];

		render(
			<PublishModal
				nodes={nodes}
				edges={edges}
				metadata={metadata}
				flags={[]}
				onClose={mockOnClose}
			/>,
		);

		expect(screen.getByText("Publicar Workflow")).toBeInTheDocument();

		// Wait for transpilation to complete
		await waitFor(
			() => {
				expect(screen.getByText("Descargar .ts")).toBeInTheDocument();
			},
			{ timeout: 5000 },
		);
	});

	it("should display all phases during generation", async () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "form", type: "Form", title: "Formulario" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "form"),
			createEdge("form", "end"),
		];

		render(
			<PublishModal
				nodes={nodes}
				edges={edges}
				metadata={metadata}
				flags={[]}
				onClose={mockOnClose}
			/>,
		);

		// Check that phase labels are present
		await waitFor(() => {
			expect(screen.getByText("Validando workflow")).toBeInTheDocument();
		});

		expect(screen.getByText("Generando slugs únicos")).toBeInTheDocument();
		expect(
			screen.getByText("Analizando estructura del grafo"),
		).toBeInTheDocument();
		expect(screen.getByText("Transpilando a TypeScript")).toBeInTheDocument();
		expect(screen.getByText("Completado")).toBeInTheDocument();
	});

	it("should show download button when generation completes successfully", async () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [createEdge("start", "end")];

		render(
			<PublishModal
				nodes={nodes}
				edges={edges}
				metadata={metadata}
				flags={[]}
				onClose={mockOnClose}
			/>,
		);

		await waitFor(
			() => {
				const downloadButton = screen.getByText("Descargar .ts");
				expect(downloadButton).toBeInTheDocument();
			},
			{ timeout: 5000 },
		);
	});

	it("should handle invalid workflow gracefully", async () => {
		// Workflow without Start node (invalid)
		const nodes: WorkflowNode[] = [
			createNode({ id: "form", type: "Form", title: "Formulario" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [createEdge("form", "end")];

		render(
			<PublishModal
				nodes={nodes}
				edges={edges}
				metadata={metadata}
				flags={[]}
				onClose={mockOnClose}
			/>,
		);

		// Wait for error phase
		await waitFor(
			() => {
				expect(screen.getByText("Validando workflow")).toBeInTheDocument();
				// Should not show download button for invalid workflow
				expect(screen.queryByText("Descargar .ts")).not.toBeInTheDocument();
			},
			{ timeout: 5000 },
		);
	});

	it("should call onClose when close button is clicked", async () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [createEdge("start", "end")];

		render(
			<PublishModal
				nodes={nodes}
				edges={edges}
				metadata={metadata}
				flags={[]}
				onClose={mockOnClose}
			/>,
		);

		await waitFor(
			() => {
				const closeButton = screen.getByText("Cerrar");
				expect(closeButton).toBeInTheDocument();
			},
			{ timeout: 5000 },
		);

		const closeButton = screen.getByText("Cerrar");
		closeButton.click();

		expect(mockOnClose).toHaveBeenCalledTimes(1);
	});
});
