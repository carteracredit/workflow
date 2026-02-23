import { describe, it, expect } from "vitest";
import {
	generateWorkflowCode,
	validateForCodeGeneration,
} from "./code-generator";
import type { WorkflowNode, WorkflowEdge, WorkflowMetadata } from "./types";

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

describe("validateForCodeGeneration", () => {
	it("should return valid for a complete workflow", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "form", type: "Form", title: "Formulario" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "form"),
			createEdge("form", "end"),
		];

		const result = validateForCodeGeneration(nodes, edges);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it("should return error when no Start node exists", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "form", type: "Form", title: "Formulario" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [createEdge("form", "end")];

		const result = validateForCodeGeneration(nodes, edges);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Workflow must have a Start node");
	});

	it("should return error when multiple Start nodes exist", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start1", type: "Start", title: "Inicio 1" }),
			createNode({ id: "start2", type: "Start", title: "Inicio 2" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start1", "end"),
			createEdge("start2", "end"),
		];

		const result = validateForCodeGeneration(nodes, edges);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Workflow can only have one Start node");
	});

	it("should return error when no End or Reject node exists", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "form", type: "Form", title: "Formulario" }),
		];

		const edges: WorkflowEdge[] = [createEdge("start", "form")];

		const result = validateForCodeGeneration(nodes, edges);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain(
			"Workflow must have at least one End or Reject node",
		);
	});

	it("should detect nodes without outgoing connections", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "form", type: "Form", title: "Formulario" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		// Form has no outgoing edge
		const edges: WorkflowEdge[] = [createEdge("start", "form")];

		const result = validateForCodeGeneration(nodes, edges);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("without outgoing"))).toBe(
			true,
		);
	});

	it("should detect nodes without incoming connections", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "form", type: "Form", title: "Formulario" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		// Form is not connected from Start
		const edges: WorkflowEdge[] = [
			createEdge("start", "end"),
			createEdge("form", "end"),
		];

		const result = validateForCodeGeneration(nodes, edges);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("without incoming"))).toBe(
			true,
		);
	});
});

describe("generateWorkflowCode", () => {
	it("should generate code for a simple workflow", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [createEdge("start", "end")];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("class GeneratedWorkflow");
		expect(result.code).toContain("extends WorkflowEntrypoint");
		expect(result.code).toContain("async run(event: WorkflowEvent");
		expect(result.code).toContain("return { success: true");
	});

	it("should generate Form step code", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "form",
				type: "Form",
				title: "Datos Personales",
				roles: ["Solicitante"],
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "form"),
			createEdge("form", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("step.do('datos-personales'");
		expect(result.code).toContain("FORMS.collect");
		expect(result.code).toContain("Solicitante");
	});

	it("should generate API step code", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "api",
				type: "API",
				title: "Verify Credit",
				config: {
					endpoint: "https://api.example.com/credit",
					method: "POST",
				},
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "api"),
			createEdge("api", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("step.do('verify-credit'");
		expect(result.code).toContain("fetch('https://api.example.com/credit'");
		expect(result.code).toContain("method: 'POST'");
	});

	it("should generate API step with retries", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "api",
				type: "API",
				title: "API Call",
				config: {
					endpoint: "/api/test",
					method: "GET",
					failureHandling: {
						onFailure: "retry",
						maxRetries: 3,
						retryCount: 0,
						cacheStrategy: "always-execute",
						timeout: 30000,
					},
				},
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "api"),
			createEdge("api", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("retries:");
		expect(result.code).toContain("limit: 3");
		expect(result.code).toContain("timeout: '30 seconds'");
	});

	it("should generate Challenge (waitForEvent) step code", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "challenge",
				type: "Challenge",
				title: "Manual Approval",
				config: {
					challengeType: "acceptance",
					challengeTimeout: { value: 48, unit: "hours" },
					deliveryMethod: "email",
				},
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "challenge"),
			createEdge("challenge", "end", { fromPort: "top" }),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("step.waitForEvent('manual-approval'");
		expect(result.code).toContain("type: 'acceptance'");
		expect(result.code).toContain("timeout: '48 hours'");
	});

	it("should generate Decision branching code", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "decision",
				type: "Decision",
				title: "Verificar Monto",
				config: { condition: "amount > 1000" },
			}),
			createNode({ id: "end-yes", type: "End", title: "Aprobado" }),
			createNode({ id: "end-no", type: "Reject", title: "Rechazado" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "decision"),
			createEdge("decision", "end-yes", { fromPort: "top" }),
			createEdge("decision", "end-no", { fromPort: "bottom" }),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("if (amount > 1000)");
		expect(result.code).toContain("return { success: true");
		expect(result.code).toContain("return { success: false");
	});

	it("should generate Transform step code", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "transform",
				type: "Transform",
				title: "Calcular Total",
				config: { code: "const total = items.reduce((a, b) => a + b, 0);" },
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "transform"),
			createEdge("transform", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("step.do('calcular-total'");
		expect(result.code).toContain("items.reduce((a, b) => a + b, 0)");
	});

	it("should generate Checkpoint step code", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "checkpoint",
				type: "Checkpoint",
				title: "Guardar Estado",
				checkpointType: "safe",
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "checkpoint"),
			createEdge("checkpoint", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("step.do('guardar-estado'");
		expect(result.code).toContain("checkpoint:");
		expect(result.code).toContain("(safe)");
	});

	it("should generate Message step code", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "message",
				type: "Message",
				title: "Send Notification",
				config: { type: "email", template: "welcome" },
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "message"),
			createEdge("message", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("step.do('send-notification'");
		expect(result.code).toContain("NOTIFICATIONS.send");
		expect(result.code).toContain("type: 'email'");
	});

	it("should include metadata in comments when provided", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [createEdge("start", "end")];

		const metadata: WorkflowMetadata = {
			name: "Test Workflow",
			description: "A test workflow for unit testing",
			version: "1.0.0",
			author: "Test Author",
			tags: ["test"],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		const result = generateWorkflowCode(nodes, edges, metadata);

		expect(result.code).toContain("Test Workflow");
		expect(result.code).toContain("A test workflow for unit testing");
		expect(result.code).toContain("Version: 1.0.0");
		expect(result.code).toContain("Author: Test Author");
	});

	it("should use custom class name from options", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [createEdge("start", "end")];

		const metadata: WorkflowMetadata = {
			name: "Credit Application",
			description: "",
			version: "1.0.0",
			author: "",
			tags: [],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		const result = generateWorkflowCode(nodes, edges, metadata, {
			className: "CreditApplicationWorkflow",
		});

		expect(result.code).toContain("class CreditApplicationWorkflow");
	});

	it("should generate imports when includeImports is true", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [createEdge("start", "end")];

		const result = generateWorkflowCode(nodes, edges, undefined, {
			includeImports: true,
		});

		expect(result.code).toContain(
			"import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep }",
		);
		expect(result.code).toContain("from 'cloudflare:workers'");
	});

	it("should not generate imports when includeImports is false", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [createEdge("start", "end")];

		const result = generateWorkflowCode(nodes, edges, undefined, {
			includeImports: false,
		});

		expect(result.code).not.toContain("import {");
	});

	it("should return error message when no Start node found", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("Error: No Start node found");
		expect(result.warnings).toContain("No Start node found in workflow");
	});

	it("should warn about unreachable nodes", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "form1", type: "Form", title: "Form 1" }),
			createNode({
				id: "orphan",
				type: "Form",
				title: "Orphan Form",
			}), // Not connected
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "form1"),
			createEdge("form1", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(
			result.warnings.some((w) => w.includes("not reachable from Start")),
		).toBe(true);
	});
});

describe("generateWorkflowCode with Join nodes", () => {
	it("should generate Join step code", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "join", type: "Join", title: "Merge Point" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "join"),
			createEdge("join", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("Join: Merge Point");
		expect(result.code).toContain("merging");
	});
});

describe("generateWorkflowCode with FlagChange nodes", () => {
	it("should generate FlagChange step code", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "flag",
				type: "FlagChange",
				title: "Update Status",
				config: {
					flagChanges: [
						{ flagId: "status", optionId: "approved" },
						{ flagId: "priority", optionId: "high" },
					],
				},
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "flag"),
			createEdge("flag", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("Flag Change: Update Status");
		expect(result.code).toContain("FLAGS.set('status', 'approved')");
		expect(result.code).toContain("FLAGS.set('priority', 'high')");
	});

	it("should handle FlagChange with no flag changes", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "flag",
				type: "FlagChange",
				title: "Empty Flag",
				config: {},
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "flag"),
			createEdge("flag", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("Flag Change: Empty Flag");
		expect(result.code).toContain(
			"Configure flag changes in the workflow editor",
		);
	});
});

describe("generateWorkflowCode with Challenge branching", () => {
	it("should generate Challenge branching code with both branches", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "challenge",
				type: "Challenge",
				title: "Approval",
				config: {
					challengeType: "acceptance",
					challengeTimeout: { value: 24, unit: "hours" },
				},
			}),
			createNode({ id: "end-approved", type: "End", title: "Approved" }),
			createNode({ id: "end-rejected", type: "Reject", title: "Rejected" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "challenge"),
			createEdge("challenge", "end-approved", { fromPort: "top" }),
			createEdge("challenge", "end-rejected", { fromPort: "bottom" }),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("if (approval.accepted)");
		expect(result.code).toContain("return { success: true");
		expect(result.code).toContain("} else {");
		expect(result.code).toContain("return { success: false");
	});
});

describe("generateWorkflowCode edge cases", () => {
	it("should warn about nodes with multiple outgoing edges that are not Decision or Challenge", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "form", type: "Form", title: "Form" }),
			createNode({ id: "end1", type: "End", title: "End 1" }),
			createNode({ id: "end2", type: "End", title: "End 2" }),
		];

		// Form node has two outgoing edges (invalid but should be handled)
		const edges: WorkflowEdge[] = [
			createEdge("start", "form"),
			createEdge("form", "end1"),
			createEdge("form", "end2"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(
			result.warnings.some((w) => w.includes("multiple outgoing edges")),
		).toBe(true);
	});

	it("should handle nodes with missing titles", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "" }),
			createNode({ id: "end", type: "End", title: "" }),
		];

		const edges: WorkflowEdge[] = [createEdge("start", "end")];

		const result = generateWorkflowCode(nodes, edges);

		// Should still generate valid code
		expect(result.code).toContain("class GeneratedWorkflow");
		expect(result.code).toContain("return { success: true");
	});

	it("should handle Transform node with no code", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "transform",
				type: "Transform",
				title: "Transform",
				config: {},
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "transform"),
			createEdge("transform", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("step.do('transform'");
		expect(result.code).toContain("// Transform logic");
	});

	it("should handle Checkpoint with normal type", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "checkpoint",
				type: "Checkpoint",
				title: "Save State",
				checkpointType: "normal",
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "checkpoint"),
			createEdge("checkpoint", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("Checkpoint: Save State");
		expect(result.code).not.toContain("(safe)");
	});

	it("should handle Message node without template", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "message",
				type: "Message",
				title: "Notify",
				config: { type: "sms" },
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "message"),
			createEdge("message", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("type: 'sms'");
		expect(result.code).not.toContain("template:");
	});

	it("should handle Decision node without condition", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "decision",
				type: "Decision",
				title: "Check",
				config: {},
			}),
			createNode({ id: "end-yes", type: "End", title: "Yes" }),
			createNode({ id: "end-no", type: "Reject", title: "No" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "decision"),
			createEdge("decision", "end-yes", { fromPort: "top" }),
			createEdge("decision", "end-no", { fromPort: "bottom" }),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("if (/* condition */)");
	});

	it("should handle API node without failure handling", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "api",
				type: "API",
				title: "Simple API",
				config: {},
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "api"),
			createEdge("api", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("step.do('simple-api'");
		expect(result.code).not.toContain("retries:");
	});

	it("should handle Challenge node without timeout config", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "challenge",
				type: "Challenge",
				title: "Approve",
				config: { challengeType: "signature" },
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "challenge"),
			createEdge("challenge", "end", { fromPort: "top" }),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("type: 'signature'");
		expect(result.code).toContain("timeout: '24 hours'"); // default timeout
	});
});

describe("generateWorkflowCodeWithProgress", () => {
	it("should generate code with progress phases", async () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "form", type: "Form", title: "Formulario" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "form"),
			createEdge("form", "end"),
		];

		const { generateWorkflowCodeWithProgress } =
			await import("./code-generator");
		const result = await generateWorkflowCodeWithProgress(nodes, edges);

		expect(result.valid).toBe(true);
		expect(result.code).toBeTruthy();
		expect(result.phases).toHaveLength(5);
		expect(result.phases[0].id).toBe("validate");
		expect(result.phases[1].id).toBe("slugs");
		expect(result.phases[2].id).toBe("analyze");
		expect(result.phases[3].id).toBe("transpile");
		expect(result.phases[4].id).toBe("complete");
		expect(result.totalDurationMs).toBeGreaterThan(0);
	});

	it("should report phase updates through callback", async () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [createEdge("start", "end")];

		const updates: Array<any> = [];
		const { generateWorkflowCodeWithProgress } =
			await import("./code-generator");

		await generateWorkflowCodeWithProgress(
			nodes,
			edges,
			undefined,
			{},
			(phases) => {
				updates.push([...phases]);
			},
		);

		expect(updates.length).toBeGreaterThan(0);
		const lastUpdate = updates[updates.length - 1];
		expect(lastUpdate[lastUpdate.length - 1].status).toBe("done");
	});

	it("should return errors for invalid workflow", async () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "form", type: "Form", title: "Formulario" }),
		];

		const edges: WorkflowEdge[] = [];

		const { generateWorkflowCodeWithProgress } =
			await import("./code-generator");
		const result = await generateWorkflowCodeWithProgress(nodes, edges);

		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.code).toBe("");
		const validatePhase = result.phases.find((p) => p.id === "validate");
		expect(validatePhase?.status).toBe("error");
	});

	it("should include detailed logs in phases", async () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "decision", type: "Decision", title: "Decidir" }),
			createNode({ id: "form", type: "Form", title: "Formulario" }),
			createNode({ id: "checkpoint", type: "Checkpoint", title: "Checkpoint" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "decision"),
			createEdge("decision", "form", { fromPort: "top" }),
			createEdge("decision", "checkpoint", { fromPort: "bottom" }),
			createEdge("form", "end"),
			createEdge("checkpoint", "end"),
		];

		const { generateWorkflowCodeWithProgress } =
			await import("./code-generator");
		const result = await generateWorkflowCodeWithProgress(nodes, edges);

		expect(result.valid).toBe(true);

		const validatePhase = result.phases.find((p) => p.id === "validate");
		expect(validatePhase?.logs.length).toBeGreaterThan(0);
		expect(validatePhase?.logs.some((log) => log.includes("5 nodos"))).toBe(
			true,
		);

		const analyzePhase = result.phases.find((p) => p.id === "analyze");
		expect(
			analyzePhase?.logs.some((log) => log.includes("Decisiones: 1")),
		).toBe(true);
		expect(
			analyzePhase?.logs.some((log) => log.includes("Checkpoints: 1")),
		).toBe(true);

		const transpilePhase = result.phases.find((p) => p.id === "transpile");
		expect(
			transpilePhase?.logs.some((log) => log.includes("líneas de código")),
		).toBe(true);
	});

	it("should include duration for each phase", async () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [createEdge("start", "end")];

		const { generateWorkflowCodeWithProgress } =
			await import("./code-generator");
		const result = await generateWorkflowCodeWithProgress(nodes, edges);

		for (const phase of result.phases) {
			if (phase.status === "done") {
				expect(phase.durationMs).toBeGreaterThanOrEqual(0);
			}
		}
	});
});
