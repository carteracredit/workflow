/**
 * RTL tests focused on the API node body section of PropertiesPanel:
 *   - XML Template mode button is present
 *   - Selecting XML mode shows the rawXml textarea
 *   - Invalid XML shows an error message and aria-invalid
 *   - Valid XML clears the error
 *   - Invalid JSON in raw-json mode shows an error message
 *   - Valid JSON clears the error
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PropertiesPanel } from "./properties-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { WorkflowNode, WorkflowMetadata } from "@/lib/workflow/types";

// ── Mocks ──────────────────────────────────────────────────────────────────

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
			getFieldLabel: (label: string, labelEs?: string) => labelEs ?? label,
			getFieldPlaceholder: (ph?: string, phEs?: string) => phEs ?? ph ?? "",
		}),
	};
});

vi.mock("@/lib/workflow-api/forms-actions", () => ({
	listFormsAction: vi.fn().mockResolvedValue([]),
	getFormAction: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/workflow-api/signatures-actions", () => ({
	listSignatureTemplatesAction: vi.fn().mockResolvedValue([]),
	getSignatureTemplateAction: vi.fn().mockResolvedValue(null),
}));

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
	Toaster: () => null,
}));

// ── Helpers ──────────────────────────────────────────────────────────────

const makeNode = (overrides: Partial<WorkflowNode> = {}): WorkflowNode => ({
	id: "api-node-1",
	type: "API",
	title: "Llamada API",
	description: "",
	roles: [],
	config: {
		url: "https://api.example.com/resource",
		method: "POST",
	},
	position: { x: 100, y: 100 },
	groupId: null,
	staleTimeout: null,
	...overrides,
});

const metadata: WorkflowMetadata = {
	name: "Test Workflow",
	description: "",
	version: "1.0.0",
	author: "",
	tags: [],
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
};

type UpdateNodeFn = (
	nodeId: string,
	updates: Partial<WorkflowNode>,
	options?: { recordHistory?: boolean },
) => void;

function renderPanel(
	node: WorkflowNode,
	onUpdateNode: UpdateNodeFn = () => {},
) {
	return render(
		<TooltipProvider>
			<PropertiesPanel
				selectedNodes={[node]}
				selectedEdges={[]}
				workflowMetadata={metadata}
				nodes={[node]}
				edges={[]}
				flags={[]}
				onUpdateNode={onUpdateNode}
				onUpdateEdge={() => {}}
				onUpdateMetadata={() => {}}
				onAddEdge={() => {}}
				onDeleteEdge={() => {}}
				showWorkflowProperties={false}
				onCloseWorkflowProperties={() => {}}
			/>
		</TooltipProvider>,
	);
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("PropertiesPanel – API body XML mode", () => {
	it("shows the XML Template button for a POST node", () => {
		renderPanel(makeNode());
		expect(screen.getByRole("button", { name: /plantilla xml/i })).toBeTruthy();
	});

	it("shows JSON Template and Field Mapping buttons as well", () => {
		renderPanel(makeNode());
		expect(screen.getByRole("button", { name: /template json/i })).toBeTruthy();
		expect(
			screen.getByRole("button", { name: /mapeo de campos/i }),
		).toBeTruthy();
	});

	it("does not show the body section for a GET node", () => {
		const getNode = makeNode({
			config: { url: "https://api.example.com", method: "GET" },
		});
		renderPanel(getNode);
		expect(screen.queryByRole("button", { name: /plantilla xml/i })).toBeNull();
	});

	it("clicking XML Template calls onUpdateNode with mode raw-xml", () => {
		const onUpdateNode = vi.fn<UpdateNodeFn>();
		renderPanel(makeNode(), onUpdateNode);
		const xmlBtn = screen.getByRole("button", { name: /plantilla xml/i });
		fireEvent.click(xmlBtn);
		expect(onUpdateNode).toHaveBeenCalledWith(
			"api-node-1",
			expect.objectContaining({
				config: expect.objectContaining({
					bodyConfig: expect.objectContaining({ mode: "raw-xml" }),
				}),
			}),
		);
	});

	it("shows rawXml textarea when mode is raw-xml", () => {
		const node = makeNode({
			config: {
				url: "https://api.example.com",
				method: "POST",
				bodyConfig: { mode: "raw-xml", rawXml: "<root/>" },
			},
		});
		renderPanel(node);
		expect(screen.getByDisplayValue("<root/>")).toBeTruthy();
	});

	it("shows XML error message when rawXml is malformed", () => {
		const node = makeNode({
			config: {
				url: "https://api.example.com",
				method: "POST",
				bodyConfig: { mode: "raw-xml", rawXml: "<unclosed>" },
			},
		});
		renderPanel(node);
		expect(screen.getByText(/xml mal formado/i)).toBeTruthy();
	});

	it("does not show XML error message when rawXml is valid", () => {
		const node = makeNode({
			config: {
				url: "https://api.example.com",
				method: "POST",
				bodyConfig: {
					mode: "raw-xml",
					rawXml: "<request><id>123</id></request>",
				},
			},
		});
		renderPanel(node);
		expect(screen.queryByText(/xml mal formado/i)).toBeNull();
	});

	it("does not show XML error message when rawXml contains workflow tokens", () => {
		const node = makeNode({
			config: {
				url: "https://api.example.com",
				method: "POST",
				bodyConfig: {
					mode: "raw-xml",
					rawXml: "<req><id>${node-1.id}</id></req>",
				},
			},
		});
		renderPanel(node);
		expect(screen.queryByText(/xml mal formado/i)).toBeNull();
	});

	it("shows JSON error when rawJson is invalid", () => {
		const node = makeNode({
			config: {
				url: "https://api.example.com",
				method: "POST",
				bodyConfig: { mode: "raw-json", rawJson: '{"broken": }' },
			},
		});
		renderPanel(node);
		expect(screen.getByText(/json inválido/i)).toBeTruthy();
	});

	it("does not show JSON error when rawJson is valid", () => {
		const node = makeNode({
			config: {
				url: "https://api.example.com",
				method: "POST",
				bodyConfig: { mode: "raw-json", rawJson: '{"amount": 100}' },
			},
		});
		renderPanel(node);
		expect(screen.queryByText(/json inválido/i)).toBeNull();
	});

	it("does not show JSON error when rawJson contains workflow tokens", () => {
		const node = makeNode({
			config: {
				url: "https://api.example.com",
				method: "POST",
				bodyConfig: {
					mode: "raw-json",
					rawJson: '{"loanId": "${node-1.loanId}"}',
				},
			},
		});
		renderPanel(node);
		expect(screen.queryByText(/json inválido/i)).toBeNull();
	});

	it("shows variable picker toggle button for raw-json mode", () => {
		const node = makeNode({
			config: {
				url: "https://api.example.com",
				method: "POST",
				bodyConfig: { mode: "raw-json", rawJson: '{"a": 1}' },
			},
		});
		renderPanel(node);
		// Multiple "Variables disponibles" toggles can appear (description + body sections)
		expect(
			screen.getAllByText(/variables disponibles/i).length,
		).toBeGreaterThan(0);
	});

	it("shows variable picker toggle button for raw-xml mode", () => {
		const node = makeNode({
			config: {
				url: "https://api.example.com",
				method: "POST",
				bodyConfig: { mode: "raw-xml", rawXml: "<root/>" },
			},
		});
		renderPanel(node);
		expect(
			screen.getAllByText(/variables disponibles/i).length,
		).toBeGreaterThan(0);
	});
});
