import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PropertiesPanel } from "./properties-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { WorkflowNode, WorkflowMetadata } from "@/lib/workflow/types";

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

const metadata: WorkflowMetadata = {
	name: "Test Workflow",
	description: "",
	version: "1.0.0",
	author: "",
	tags: [],
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
};

function makeNode(overrides: Partial<WorkflowNode> = {}): WorkflowNode {
	return {
		id: "node-1",
		type: "Form",
		title: "Formulario",
		description: "",
		roles: [],
		config: { formId: "form-1", formVersion: 1 },
		position: { x: 100, y: 100 },
		groupId: null,
		staleTimeout: null,
		...overrides,
	};
}

function renderPanel(node: WorkflowNode) {
	return render(
		<TooltipProvider>
			<PropertiesPanel
				selectedNodes={[node]}
				selectedEdges={[]}
				workflowMetadata={metadata}
				nodes={[node]}
				edges={[]}
				flags={[]}
				onUpdateNode={() => {}}
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

beforeAll(() => {
	global.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof ResizeObserver;
});

describe("PropertiesPanel caseStatus", () => {
	it("shows the case status select on enabled node types", async () => {
		const user = userEvent.setup();
		renderPanel(makeNode({ type: "Form", title: "Formulario" }));
		await user.click(screen.getByRole("tab", { name: "Roles" }));
		expect(screen.getByText("Estado del caso")).toBeTruthy();
		expect(screen.getByText("Automático (según tipo de nodo)")).toBeTruthy();
	});

	it("does not show the case status select on Start nodes", () => {
		renderPanel(
			makeNode({
				type: "Start",
				title: "Inicio",
				config: {},
			}),
		);
		expect(screen.queryByRole("tab", { name: "Roles" })).toBeNull();
		expect(screen.queryByText("Estado del caso")).toBeNull();
	});

	it("renders a saved assignable caseStatus value", async () => {
		const user = userEvent.setup();
		renderPanel(
			makeNode({
				type: "Challenge",
				title: "Aprobación",
				caseStatus: "pending_approval",
				config: { challengeType: "otp" },
			}),
		);
		await user.click(screen.getByRole("tab", { name: "Roles" }));
		expect(screen.getByText("Aprobación pendiente")).toBeTruthy();
	});
});
