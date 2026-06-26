/**
 * RTL tests for the tabbed PropertiesPanel:
 *   - Tabs visible / hidden for each node type
 *   - Default tab is "Config" when node has type-specific config
 *   - Default tab is "General" when node has no type-specific config (End, Join)
 *   - Switching to "Roles" tab reveals role checkboxes
 *   - Switching to "Advanced" tab reveals Stale Timeout for supported node types
 *   - "Advanced" tab is absent for nodes that don't support stale timeout (Checkpoint)
 *   - "Config" tab is absent for End and Join nodes
 *   - "Roles" tab is absent for nodes with no roles (End, Join, Start, Reject)
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PropertiesPanel } from "./properties-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { WorkflowNode, WorkflowMetadata } from "@/lib/workflow/types";

// ── Mocks ────────────────────────────────────────────────────────────────────

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

vi.mock("@/lib/workflow-api/nls-actions", () => ({
	listNlsFunctionsAction: vi.fn().mockResolvedValue([]),
	getNlsFunctionAction: vi.fn().mockResolvedValue(null),
}));

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
	Toaster: () => null,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const metadata: WorkflowMetadata = {
	name: "Test Workflow",
	description: "",
	version: "1.0.0",
	author: "",
	tags: [],
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
};

function makeNode(
	type: WorkflowNode["type"],
	overrides: Partial<WorkflowNode> = {},
): WorkflowNode {
	return {
		id: "node-1",
		type,
		title: type,
		description: "",
		roles: [],
		config: {},
		position: { x: 0, y: 0 },
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

// Resolve translated tab label from the ES translations
function tabLabel(suffix: "general" | "config" | "roles" | "advanced") {
	const map = {
		general: "General",
		config: "Configuración",
		roles: "Roles",
		advanced: "Avanzado",
	};
	return map[suffix];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PropertiesPanel – tab structure", () => {
	it("shows General + Config tabs for an API node", () => {
		renderPanel(makeNode("API", { config: { method: "GET", url: "" } }));
		expect(screen.getByRole("tab", { name: tabLabel("general") })).toBeTruthy();
		expect(screen.getByRole("tab", { name: tabLabel("config") })).toBeTruthy();
	});

	it("shows Roles tab for an API node (visibility roles)", () => {
		renderPanel(makeNode("API", { config: { method: "GET", url: "" } }));
		expect(screen.getByRole("tab", { name: tabLabel("roles") })).toBeTruthy();
	});

	it("shows Advanced tab for an API node (stale timeout)", () => {
		renderPanel(makeNode("API", { config: { method: "GET", url: "" } }));
		expect(
			screen.getByRole("tab", { name: tabLabel("advanced") }),
		).toBeTruthy();
	});

	it("default active tab for API node is Config", () => {
		renderPanel(makeNode("API", { config: { method: "GET", url: "" } }));
		const configTab = screen.getByRole("tab", { name: tabLabel("config") });
		expect(configTab.getAttribute("data-state")).toBe("active");
	});

	it("End node shows only General tab (no Config, no Roles, no Advanced)", () => {
		renderPanel(makeNode("End"));
		expect(screen.getByRole("tab", { name: tabLabel("general") })).toBeTruthy();
		expect(screen.queryByRole("tab", { name: tabLabel("config") })).toBeNull();
		expect(screen.queryByRole("tab", { name: tabLabel("roles") })).toBeNull();
		expect(
			screen.queryByRole("tab", { name: tabLabel("advanced") }),
		).toBeNull();
	});

	it("Join node shows only General tab", () => {
		renderPanel(makeNode("Join"));
		expect(screen.getByRole("tab", { name: tabLabel("general") })).toBeTruthy();
		expect(screen.queryByRole("tab", { name: tabLabel("config") })).toBeNull();
	});

	it("End node default active tab is General", () => {
		renderPanel(makeNode("End"));
		const generalTab = screen.getByRole("tab", { name: tabLabel("general") });
		expect(generalTab.getAttribute("data-state")).toBe("active");
	});

	it("Checkpoint node shows Config + Roles but no Advanced (no stale)", () => {
		renderPanel(makeNode("Checkpoint"));
		expect(screen.getByRole("tab", { name: tabLabel("config") })).toBeTruthy();
		expect(screen.getByRole("tab", { name: tabLabel("roles") })).toBeTruthy();
		expect(
			screen.queryByRole("tab", { name: tabLabel("advanced") }),
		).toBeNull();
	});

	it("Reject node shows Config but no Roles tab", () => {
		renderPanel(makeNode("Reject"));
		expect(screen.getByRole("tab", { name: tabLabel("config") })).toBeTruthy();
		expect(screen.queryByRole("tab", { name: tabLabel("roles") })).toBeNull();
		expect(
			screen.queryByRole("tab", { name: tabLabel("advanced") }),
		).toBeNull();
	});

	it("Form node shows all 4 tabs", () => {
		renderPanel(makeNode("Form"));
		expect(screen.getByRole("tab", { name: tabLabel("general") })).toBeTruthy();
		expect(screen.getByRole("tab", { name: tabLabel("config") })).toBeTruthy();
		expect(screen.getByRole("tab", { name: tabLabel("roles") })).toBeTruthy();
		expect(
			screen.getByRole("tab", { name: tabLabel("advanced") }),
		).toBeTruthy();
	});
});

describe("PropertiesPanel – tab switching reveals content", () => {
	it("General tab shows Title input after switching", async () => {
		const user = userEvent.setup();
		renderPanel(makeNode("API", { config: { method: "GET", url: "" } }));
		const generalTab = screen.getByRole("tab", { name: tabLabel("general") });
		await user.click(generalTab);
		// Title input with value "API" should be visible in the General tab
		const titleInput = screen.getByDisplayValue("API");
		expect(titleInput).toBeTruthy();
	});

	it("Roles tab shows Visibility Roles section for API node", async () => {
		const user = userEvent.setup();
		renderPanel(makeNode("API", { config: { method: "GET", url: "" } }));
		const rolesTab = screen.getByRole("tab", { name: tabLabel("roles") });
		await user.click(rolesTab);
		// Find the active tabpanel and check visibility roles content within it
		const activePanel = screen.getByRole("tabpanel");
		expect(
			within(activePanel).queryAllByRole("checkbox").length,
		).toBeGreaterThan(0);
	});

	it("Advanced tab shows Stale Timeout toggle for Form node", async () => {
		const user = userEvent.setup();
		renderPanel(makeNode("Form"));
		const advancedTab = screen.getByRole("tab", { name: tabLabel("advanced") });
		await user.click(advancedTab);
		// After switching to Advanced, the active tabpanel should contain a switch
		const activePanel = screen.getByRole("tabpanel");
		expect(within(activePanel).getByRole("switch")).toBeTruthy();
	});
});
