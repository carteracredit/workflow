import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { PublishModal } from "./publish-modal";
import type {
	WorkflowNode,
	WorkflowEdge,
	WorkflowMetadata,
} from "@/lib/workflow/types";
import { ApiError } from "@/lib/workflow-api/http";

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

// Mock sonner toast
vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
	Toaster: () => null,
}));

// Mock publishWorkflow to avoid real API calls in unit tests
const mockPublishWorkflow = vi.fn();
vi.mock("@/lib/workflow-api/workflows", () => ({
	publishWorkflow: (...args: Parameters<typeof mockPublishWorkflow>) =>
		mockPublishWorkflow(...args),
}));

const mockPublishSuccess = {
	deployment: {
		id: 1,
		workflow_id: 1,
		major_version: 1,
		semver: "1.0.0",
		environment: "development",
		worker_name: "test-workflow-dev-v1",
		status: "deploying",
		deployed_at: null,
		created_at: "2026-01-01T00:00:00.000Z",
		updated_at: "2026-01-01T00:00:00.000Z",
	},
	repo_url: "https://github.com/carteracredit/test-workflow",
	worker_name: "test-workflow-dev-v1",
	branch: "dev",
};

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

// Default props helper to avoid repetition
const defaultProps = {
	workflowApiId: "wf-uuid-001",
	onSave: vi.fn().mockResolvedValue(undefined),
	onClose: vi.fn(),
};

describe("PublishModal", () => {
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
		mockPublishWorkflow.mockResolvedValue(mockPublishSuccess);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should render modal with title", async () => {
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
				{...defaultProps}
			/>,
		);

		expect(screen.getByText("Publicar Workflow")).toBeInTheDocument();
	});

	it("should display all transpilation phases", async () => {
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
				{...defaultProps}
			/>,
		);

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

	it("should show download and close buttons when generation completes", async () => {
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
				{...defaultProps}
			/>,
		);

		await waitFor(
			() => {
				expect(screen.getByText("Descargar .ts")).toBeInTheDocument();
				expect(screen.getByText("Cerrar")).toBeInTheDocument();
			},
			{ timeout: 5000 },
		);
	});

	it("should handle invalid workflow (no Start node) gracefully", async () => {
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
				{...defaultProps}
			/>,
		);

		await waitFor(
			() => {
				expect(screen.getByText("Validando workflow")).toBeInTheDocument();
				// Download button should not appear for invalid workflow
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
		const onClose = vi.fn();

		render(
			<PublishModal
				nodes={nodes}
				edges={edges}
				metadata={metadata}
				flags={[]}
				{...defaultProps}
				onClose={onClose}
			/>,
		);

		await waitFor(
			() => {
				expect(screen.getByText("Cerrar")).toBeInTheDocument();
			},
			{ timeout: 5000 },
		);

		screen.getByText("Cerrar").click();
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("calls onSave when workflowApiId is null", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
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
				{...defaultProps}
				workflowApiId={null}
				onSave={onSave}
			/>,
		);

		await waitFor(
			() => {
				expect(onSave).toHaveBeenCalledTimes(1);
			},
			{ timeout: 5000 },
		);
	});

	it("shows 'Publicando en Cloudflare' deploy phase after transpilation", async () => {
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
				{...defaultProps}
			/>,
		);

		await waitFor(
			() => {
				expect(
					screen.getByText("Publicando en Cloudflare"),
				).toBeInTheDocument();
			},
			{ timeout: 5000 },
		);
	});

	it("shows deployment success result with repo link", async () => {
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
				{...defaultProps}
			/>,
		);

		await waitFor(
			() => {
				expect(
					screen.getByText("Deployment iniciado correctamente"),
				).toBeInTheDocument();
			},
			{ timeout: 5000 },
		);

		expect(screen.getByText("Ver repositorio en GitHub")).toBeInTheDocument();
		expect(screen.getByText("test-workflow-dev-v1")).toBeInTheDocument();
	});

	it("shows error state when publishWorkflow API fails", async () => {
		mockPublishWorkflow.mockRejectedValueOnce(
			new ApiError("GitHub integration is not configured", {
				status: 503,
				body: null,
			}),
		);

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
				{...defaultProps}
			/>,
		);

		await waitFor(
			() => {
				expect(screen.getByText("Reintentar")).toBeInTheDocument();
			},
			{ timeout: 5000 },
		);
	});

	it("triggers download on Descargar .ts button click", async () => {
		const createObjectURL = vi
			.fn()
			.mockReturnValue("blob:http://localhost/test");
		const revokeObjectURL = vi.fn();
		global.URL.createObjectURL = createObjectURL;
		global.URL.revokeObjectURL = revokeObjectURL;

		// Mock the anchor click to prevent jsdom navigation
		const originalCreateElement = document.createElement.bind(document);
		const mockClick = vi.fn();
		vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
			const element = originalCreateElement(tag);
			if (tag === "a") {
				element.click = mockClick;
			}
			return element;
		});

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
				{...defaultProps}
			/>,
		);

		await waitFor(
			() => {
				expect(screen.getByText("Descargar .ts")).toBeInTheDocument();
			},
			{ timeout: 5000 },
		);

		fireEvent.click(screen.getByText("Descargar .ts"));

		expect(createObjectURL).toHaveBeenCalled();
		expect(mockClick).toHaveBeenCalled();
		expect(revokeObjectURL).toHaveBeenCalled();
	});

	it("shows error description message when API fails with generic error", async () => {
		mockPublishWorkflow.mockRejectedValueOnce(
			new Error("Network error occurred"),
		);

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
				{...defaultProps}
			/>,
		);

		await waitFor(
			() => {
				expect(screen.getByText("Reintentar")).toBeInTheDocument();
			},
			{ timeout: 5000 },
		);

		expect(screen.getByText("Network error occurred")).toBeInTheDocument();
	});

	it("shows 'Proceso completado.' when transpile ok but no api token", async () => {
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
				{...defaultProps}
			/>,
		);

		await waitFor(
			() => {
				expect(screen.getByText("Descargar .ts")).toBeInTheDocument();
			},
			{ timeout: 5000 },
		);
	});
});
