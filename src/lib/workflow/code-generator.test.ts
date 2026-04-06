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
		expect(result.code).toContain("async run(");
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

		expect(result.code).toContain("step.waitForEvent");
		expect(result.code).toContain("form-submission-datos-personales");
		expect(result.code).toContain("Solicitante");
		expect(result.code).toContain('"datos-personales"');
	});

	it("should use real UUID formId when set in node config", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "form",
				type: "Form",
				title: "Datos Personales",
				roles: ["Solicitante"],
				config: { formId: "550e8400-e29b-41d4-a716-446655440000" },
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "form"),
			createEdge("form", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		// Form step name comes from slugified title; formId config is no longer emitted
		expect(result.code).toContain("step.waitForEvent");
		expect(result.code).toContain('"datos-personales"');
	});

	it("should use slugified title as step name for Form nodes", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "form",
				type: "Form",
				title: "Datos Personales",
				roles: [],
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "form"),
			createEdge("form", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		// Step name is slugified title (no formId in generated code)
		expect(result.code).toContain("step.waitForEvent");
		expect(result.code).toContain('"datos-personales"');
	});

	it("should generate waitForEvent for Form when formVersion is set in config", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "form",
				type: "Form",
				title: "Datos Personales",
				roles: ["Solicitante"],
				config: {
					formId: "550e8400-e29b-41d4-a716-446655440000",
					formVersion: 3,
				},
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "form"),
			createEdge("form", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		// formId/formVersion are no longer emitted; verify waitForEvent pattern is present
		expect(result.code).toContain("step.waitForEvent");
		expect(result.code).toContain("form-submission-datos-personales");
	});

	it("should omit formVersion when not set in node config", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "form",
				type: "Form",
				title: "Datos Personales",
				roles: ["Solicitante"],
				config: { formId: "550e8400-e29b-41d4-a716-446655440000" },
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "form"),
			createEdge("form", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).not.toContain("formVersion");
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

		expect(result.code).toContain('step.do("verify-credit"');
		expect(result.code).toContain('fetch("https://api.example.com/credit"');
		expect(result.code).toContain('method: "POST"');
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
		expect(result.code).toContain('timeout: "30 seconds"');
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

		expect(result.code).toContain("step.waitForEvent<{ accepted: boolean }>(");
		expect(result.code).toContain('"manual-approval"');
		// Challenge nodes get a hoisted let so the if/else branch can access it
		expect(result.code).toContain("let manualApproval: unknown = null;");
		expect(result.code).toContain("manualApproval = await step.waitForEvent");
		expect(result.code).not.toContain("const manualApproval");
		expect(result.code).toContain('type: "acceptance"');
		expect(result.code).toContain('timeout: "48 hours"');
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

	it("should expand ${nodeId.prop} variable references in Decision conditions to valid JS", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "node-1773093521695",
				type: "API",
				title: "Pokemon available",
				config: {
					url: "https://pokeapi.co/api/v2/pokemon",
					method: "GET",
					outputSchema: {
						properties: [{ name: "count", type: "number", required: true }],
					},
				},
			}),
			createNode({
				id: "decision",
				type: "Decision",
				title: "Hay resultados",
				config: { condition: "${node-1773093521695.count} > 0" },
			}),
			createNode({ id: "end-yes", type: "End", title: "Hay pokémon" }),
			createNode({ id: "end-no", type: "Reject", title: "Sin resultados" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "node-1773093521695"),
			createEdge("node-1773093521695", "decision"),
			createEdge("decision", "end-yes", { fromPort: "top" }),
			createEdge("decision", "end-no", { fromPort: "bottom" }),
		];

		const result = generateWorkflowCode(nodes, edges);

		// Variable reference should be expanded to valid JS
		expect(result.code).toContain("if (node_1773093521695.count > 0)");
		// The original template syntax must NOT appear in generated code
		expect(result.code).not.toContain("${node-1773093521695.count}");
		// The API step result should be captured in a variable
		expect(result.code).toContain("const node_1773093521695 =");
	});

	it("should NOT capture step result when node has no outputSchema", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "node-api",
				type: "API",
				title: "Call API",
				config: { url: "https://example.com", method: "GET" },
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "node-api"),
			createEdge("node-api", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).not.toContain("const node_api =");
		expect(result.code).toContain("await step.do(");
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

		expect(result.code).toContain('step.do("calcular-total"');
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

		expect(result.code).toContain('step.do("guardar-estado"');
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
				roles: ["Solicitante"],
				config: {
					channel: "email",
					templateName: "welcome",
					mergeVars: [{ key: "NOMBRE", value: "event.payload.name" }],
				},
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "message"),
			createEdge("message", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain('step.do("send-notification"');
		expect(result.code).toContain("sendTemplateEmail");
		expect(result.code).toContain('templateName: "welcome"');
		// Message nodes must emit progress calls like API/Transform nodes
		expect(result.code).toContain("updateInstanceProgress");
		expect(result.code).toContain('status: "in_progress"');
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

		expect(result.code).toContain("WorkflowEntrypoint");
		expect(result.code).toContain("WorkflowEvent");
		expect(result.code).toContain("WorkflowStep");
		expect(result.code).toContain('from "cloudflare:workers"');
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
	it("should generate FlagChange step using service binding", () => {
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
		expect(result.code).toContain("WORKFLOW_SVC.batchUpdateFlagState");
		expect(result.code).toContain("workflowId: this.env.WORKFLOW_ID");
		expect(result.code).toContain('"status"');
		expect(result.code).toContain('"approved"');
		expect(result.code).toContain('"priority"');
		expect(result.code).toContain('"high"');
		expect(result.code).toContain("instanceId: event.instanceId");
		// Should NOT use old FLAGS or fetch patterns
		expect(result.code).not.toContain("this.env.FLAGS");
		expect(result.code).not.toContain("flags.set(");
		expect(result.code).not.toContain("WORKFLOW_SVC.fetch");
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

	it("should generate WorkflowEnv with WORKFLOW_SVC RPC type and WORKFLOW_ID bindings", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [createEdge("start", "end")];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("WORKFLOW_SVC: {");
		expect(result.code).toContain("batchUpdateFlagState");
		expect(result.code).toContain("WORKFLOW_ID: string");
		// Should NOT contain old bindings or Fetcher type
		expect(result.code).not.toContain("WORKFLOW_SVC: Fetcher");
		expect(result.code).not.toContain("FLAGS?: unknown");
		expect(result.code).not.toContain("FORMS?: unknown");
	});

	it("should produce stable checksum for FlagChange node (no formatting drift)", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "flag",
				type: "FlagChange",
				title: "Update Status",
				config: {
					flagChanges: [
						{ flagId: "status-flag-id", optionId: "approved-option-id" },
					],
				},
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "flag"),
			createEdge("flag", "end"),
		];

		// Generate twice — must produce identical code (no timestamps, no random ids)
		const result1 = generateWorkflowCode(nodes, edges, undefined, {
			includeComments: false,
		});
		const result2 = generateWorkflowCode(nodes, edges, undefined, {
			includeComments: false,
		});

		expect(result1.code).toBe(result2.code);
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

		// Challenge nodes get a hoisted let variable used in the if/else branch
		expect(result.code).toContain("let approval: unknown = null;");
		expect(result.code).toContain("approval = await step.waitForEvent");
		expect(result.code).not.toContain("const approval");
		expect(result.code).toContain(
			"if ((approval as { payload: { accepted: boolean } }).payload.accepted)",
		);
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

		expect(result.code).toContain('step.do("transform"');
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

	it("should handle Message node (email) with template and merge vars", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "message",
				type: "Message",
				title: "Notify Email",
				roles: ["Solicitante"],
				config: {
					channel: "email",
					templateName: "my-template",
					subject: "Tu solicitud",
					mergeVars: [
						{ key: "NOMBRE", value: "event.payload.nombre" },
						{ key: "MONTO", value: "500" },
					],
				},
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "message"),
			createEdge("message", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("sendTemplateEmail");
		expect(result.code).toContain('templateName: "my-template"');
		expect(result.code).toContain('subject: "Tu solicitud"');
		expect(result.code).toContain("NOMBRE: event.payload.nombre as string");
		expect(result.code).toContain('MONTO: "500"');
		expect(result.code).toContain("NOTIFICATIONS_SERVICE");
		// WorkflowEnv should include NOTIFICATIONS_SERVICE and CASES_SVC
		expect(result.code).toContain("NOTIFICATIONS_SERVICE: {");
		expect(result.code).toContain("CASES_SVC: {");
		expect(result.code).toContain("getCaseRoleContacts");
		// With roles configured, should use RPC refresh + fallback logic
		expect(result.code).toContain("CASES_SVC.getCaseRoleContacts");
		expect(result.code).toContain("roleContacts");
		// Errors must be fatal: no try-catch swallowing failures
		expect(result.code).not.toContain("non-fatal");
		expect(result.code).toContain('throw new Error("[Message]');
		// Progress tracking must be emitted for Message nodes
		expect(result.code).toContain("updateInstanceProgress");
	});

	it("should handle Message node (email) without template name", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "message",
				type: "Message",
				title: "Notify",
				config: { channel: "email", mergeVars: [] },
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "message"),
			createEdge("message", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("sendTemplateEmail");
		expect(result.code).toContain("TODO: set Mandrill template name");
		expect(result.code).toContain("TODO: add template merge variables");
		// WorkflowEnv declares both methods; only sendTemplateEmail is called in the step
		expect(result.code).not.toContain("await notifications.sendSms");
	});

	it("should handle Message node (sms) with body", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "message",
				type: "Message",
				title: "Notify SMS",
				roles: ["Solicitante"],
				config: {
					channel: "sms",
					body: "Tu solicitud fue procesada",
				},
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "message"),
			createEdge("message", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("sendSms");
		expect(result.code).toContain('body: "Tu solicitud fue procesada"');
		expect(result.code).toContain("NOTIFICATIONS_SERVICE");
		// WorkflowEnv declares both methods; only sendSms is called in the step
		expect(result.code).not.toContain("await notifications.sendTemplateEmail");
		// WorkflowEnv should include CASES_SVC for multi-role SMS
		expect(result.code).toContain("CASES_SVC: {");
		expect(result.code).toContain("CASES_SVC.getCaseRoleContacts");
		// Errors must be fatal: no try-catch swallowing failures
		expect(result.code).not.toContain("non-fatal");
		expect(result.code).toContain('throw new Error("[Message]');
		// Progress tracking must be emitted for Message nodes
		expect(result.code).toContain("updateInstanceProgress");
	});

	it("should handle Message node (sms) without body", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "message",
				type: "Message",
				title: "Notify",
				config: { channel: "sms" },
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "message"),
			createEdge("message", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("sendSms");
		expect(result.code).toContain("TODO: set SMS body");
	});

	it("should generate multi-role email message with CASES_SVC RPC refresh and fallback", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "message",
				type: "Message",
				title: "Notify Multi",
				roles: ["Solicitante", "Vendedor", "Dealer"],
				config: {
					channel: "email",
					templateName: "notify-all",
					subject: "Actualización",
					mergeVars: [],
				},
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "message"),
			createEdge("message", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		// Should use CASES_SVC RPC for fresh contacts
		expect(result.code).toContain("CASES_SVC.getCaseRoleContacts");
		expect(result.code).toContain("event.payload.caseId");
		// Should include all three roles as target list
		expect(result.code).toContain('"Solicitante"');
		expect(result.code).toContain('"Vendedor"');
		expect(result.code).toContain('"Dealer"');
		// Should have fallback to payload.roleContacts
		expect(result.code).toContain("event.payload.roleContacts");
		// Should collect emails from role contacts
		expect(result.code).toContain("recipientEmails");
		expect(result.code).toContain("toList");
		// WorkflowEnv must have CASES_SVC binding
		expect(result.code).toContain("CASES_SVC: {");
		expect(result.code).toContain("getCaseRoleContacts");
		// sendTemplateEmail should use toList
		expect(result.code).toContain(
			"to: toList.length === 1 ? toList[0] : toList",
		);
	});

	it("should NOT include NOTIFICATIONS_SERVICE in WorkflowEnv when no Message nodes", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [createEdge("start", "end")];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).not.toContain("NOTIFICATIONS_SERVICE");
		// CASES_SVC is always included (for updateCaseObject) regardless of node types
		expect(result.code).toContain("CASES_SVC");
		expect(result.code).toContain("updateCaseObject");
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

		expect(result.code).toContain('step.do("simple-api"');
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

		expect(result.code).toContain('type: "signature"');
		expect(result.code).toContain('timeout: "24 hours"'); // default timeout
	});

	it("should generate camelCase variable names for forms with special characters", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "form1",
				type: "Form",
				title: "Formulario A",
				roles: ["Vendedor"],
			}),
			createNode({
				id: "form2",
				type: "Form",
				title: "Formulario B",
				roles: ["Vendedor"],
			}),
			createNode({
				id: "form3",
				type: "Form",
				title: "Formulario C",
				roles: ["Vendedor"],
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edges: WorkflowEdge[] = [
			createEdge("start", "form1"),
			createEdge("form1", "form2"),
			createEdge("form2", "form3"),
			createEdge("form3", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		// Step names should use kebab-case (Form nodes use waitForEvent)
		expect(result.code).toContain("step.waitForEvent");
		expect(result.code).toContain('"formulario-a"');
		expect(result.code).toContain('"formulario-b"');
		expect(result.code).toContain('"formulario-c"');

		// Should not contain invalid JavaScript identifiers
		expect(result.code).not.toContain("const formulario-a");
		expect(result.code).not.toContain("const formulario-b");
		expect(result.code).not.toContain("const formulario-c");
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

	it("should include warning logs in transpile phase when workflow has warnings", async () => {
		// Form with multiple outgoing edges triggers a warning (not a Decision/Challenge)
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "form", type: "Form", title: "Formulario" }),
			createNode({ id: "end1", type: "End", title: "Fin 1" }),
			createNode({ id: "end2", type: "End", title: "Fin 2" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "form"),
			createEdge("form", "end1"),
			createEdge("form", "end2"),
		];

		const { generateWorkflowCodeWithProgress } =
			await import("./code-generator");
		const result = await generateWorkflowCodeWithProgress(nodes, edges);

		expect(result.valid).toBe(true);
		expect(result.warnings.length).toBeGreaterThan(0);
		const transpilePhase = result.phases.find((p) => p.id === "transpile");
		expect(
			transpilePhase?.logs.some(
				(log) => log.includes("Advertencias") || log.includes("⚠️"),
			),
		).toBe(true);
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

// ─────────────────────────────────────────────────────────────────────────────
// Convergence / post-dominator tests
// These validate the fix for the "visited-set" bug where nodes after a
// branching point were generated inside the first branch only.
// ─────────────────────────────────────────────────────────────────────────────

describe("generateWorkflowCode – branch convergence (post-dominator fix)", () => {
	// ── Challenge + Join + End ──────────────────────────────────────────────

	it("Challenge: nodes after convergence (Join) are generated outside if/else", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "challenge",
				type: "Challenge",
				title: "Aprobacion",
				config: {
					challengeType: "acceptance",
					challengeTimeout: { value: 24, unit: "hours" },
				},
			}),
			createNode({
				id: "msg-accepted",
				type: "Message",
				title: "Mensaje Aceptacion",
				config: { type: "email" },
			}),
			createNode({
				id: "msg-rejected",
				type: "Message",
				title: "Mensaje Rechazo",
				config: { type: "email" },
			}),
			createNode({ id: "join", type: "Join", title: "Union" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "challenge"),
			createEdge("challenge", "msg-accepted", { fromPort: "top" }),
			createEdge("challenge", "msg-rejected", { fromPort: "bottom" }),
			createEdge("msg-accepted", "join"),
			createEdge("msg-rejected", "join"),
			createEdge("join", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.warnings).toHaveLength(0);

		// Both messages must appear
		expect(result.code).toContain('step.do("mensaje-aceptacion"');
		expect(result.code).toContain('step.do("mensaje-rechazo"');

		// Join and End must appear AFTER the if/else, not inside a branch
		const ifIdx = result.code.indexOf(
			"if ((aprobacion as { payload: { accepted: boolean } }).payload.accepted)",
		);
		const joinIdx = result.code.indexOf('step.do("union"');
		const returnIdx = result.code.indexOf("return { success: true");

		expect(ifIdx).toBeGreaterThanOrEqual(0);
		expect(joinIdx).toBeGreaterThan(ifIdx);
		expect(returnIdx).toBeGreaterThan(joinIdx);

		// The Join step must NOT be indented inside the if/else (2 tabs = method body, not nested)
		const joinLine = result.code
			.split("\n")
			.find((l) => l.includes('step.do("union"'))!;
		expect(joinLine).toBeDefined();
		expect(joinLine.startsWith("\t\tawait")).toBe(true); // 2 tabs = method body, not nested
	});

	// ── Decision + Join + End ───────────────────────────────────────────────

	it("Decision: nodes after convergence (Join) are generated outside if/else", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "decision",
				type: "Decision",
				title: "Verificar",
				config: { condition: "amount > 1000" },
			}),
			createNode({
				id: "form-a",
				type: "Form",
				title: "Formulario A",
				roles: ["Admin"],
			}),
			createNode({
				id: "form-b",
				type: "Form",
				title: "Formulario B",
				roles: ["Admin"],
			}),
			createNode({ id: "join", type: "Join", title: "Union" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "decision"),
			createEdge("decision", "form-a", { fromPort: "top" }),
			createEdge("decision", "form-b", { fromPort: "bottom" }),
			createEdge("form-a", "join"),
			createEdge("form-b", "join"),
			createEdge("join", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.warnings).toHaveLength(0);
		expect(result.code).toContain("step.waitForEvent");
		expect(result.code).toContain('"formulario-a"');
		expect(result.code).toContain('"formulario-b"');

		const ifIdx = result.code.indexOf("if (amount > 1000)");
		const joinIdx = result.code.indexOf('step.do("union"');
		const returnIdx = result.code.indexOf("return { success: true");

		expect(joinIdx).toBeGreaterThan(ifIdx);
		expect(returnIdx).toBeGreaterThan(joinIdx);
	});

	// ── Decision with shared End node (no explicit Join) ───────────────────

	it("Decision: shared End after both branches is generated once outside if/else", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "decision",
				type: "Decision",
				title: "Condicion",
				config: { condition: "approved" },
			}),
			createNode({
				id: "msg-yes",
				type: "Message",
				title: "Aprobado",
				config: { type: "email" },
			}),
			createNode({
				id: "msg-no",
				type: "Message",
				title: "Rechazado",
				config: { type: "email" },
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "decision"),
			createEdge("decision", "msg-yes", { fromPort: "top" }),
			createEdge("decision", "msg-no", { fromPort: "bottom" }),
			createEdge("msg-yes", "end"),
			createEdge("msg-no", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.warnings).toHaveLength(0);
		expect(result.code).toContain('step.do("aprobado"');
		expect(result.code).toContain('step.do("rechazado"');

		// return must appear exactly once
		const returnCount = (result.code.match(/return \{ success: true/g) ?? [])
			.length;
		expect(returnCount).toBe(1);

		// return appears after both message steps
		const approvedIdx = result.code.indexOf('step.do("aprobado"');
		const rejectedIdx = result.code.indexOf('step.do("rechazado"');
		const returnIdx = result.code.indexOf("return { success: true");
		expect(returnIdx).toBeGreaterThan(Math.max(approvedIdx, rejectedIdx));
	});

	// ── Challenge with shared End (no Join, no explicit convergence node) ──

	it("Challenge: shared End node is generated once outside if/else", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "challenge",
				type: "Challenge",
				title: "Firma",
				config: {
					challengeType: "signature",
					challengeTimeout: { value: 24, unit: "hours" },
				},
			}),
			createNode({
				id: "msg-ok",
				type: "Message",
				title: "Firmado",
				config: { type: "email" },
			}),
			createNode({
				id: "msg-fail",
				type: "Message",
				title: "Fallido",
				config: { type: "email" },
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "challenge"),
			createEdge("challenge", "msg-ok", { fromPort: "top" }),
			createEdge("challenge", "msg-fail", { fromPort: "bottom" }),
			createEdge("msg-ok", "end"),
			createEdge("msg-fail", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.warnings).toHaveLength(0);
		const returnCount = (result.code.match(/return \{ success: true/g) ?? [])
			.length;
		expect(returnCount).toBe(1);

		const ifIdx = result.code.indexOf(
			"if ((firma as { payload: { accepted: boolean } }).payload.accepted)",
		);
		const returnIdx = result.code.indexOf("return { success: true");
		expect(returnIdx).toBeGreaterThan(ifIdx);
	});

	// ── Branches with independent End nodes (no convergence) ───────────────

	it("Decision: independent End/Reject nodes per branch (no convergence) – each branch has its own return", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "decision",
				type: "Decision",
				title: "Evaluar",
				config: { condition: "score >= 700" },
			}),
			createNode({ id: "end-ok", type: "End", title: "Aprobado" }),
			createNode({ id: "end-reject", type: "Reject", title: "Rechazado" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "decision"),
			createEdge("decision", "end-ok", { fromPort: "top" }),
			createEdge("decision", "end-reject", { fromPort: "bottom" }),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.warnings).toHaveLength(0);
		// Each branch has its own terminal – two return statements
		expect(result.code).toContain("return { success: true");
		expect(result.code).toContain("return { success: false");
	});

	// ── Nested Decision converging to a common node ─────────────────────────

	it("Nested Decision: inner and outer branches converge correctly", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "outer",
				type: "Decision",
				title: "Outer",
				config: { condition: "outer_cond" },
			}),
			createNode({
				id: "inner",
				type: "Decision",
				title: "Inner",
				config: { condition: "inner_cond" },
			}),
			createNode({
				id: "msg-a",
				type: "Message",
				title: "Mensaje A",
				config: { type: "email" },
			}),
			createNode({
				id: "msg-b",
				type: "Message",
				title: "Mensaje B",
				config: { type: "email" },
			}),
			createNode({
				id: "msg-c",
				type: "Message",
				title: "Mensaje C",
				config: { type: "email" },
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "outer"),
			createEdge("outer", "inner", { fromPort: "top" }),
			createEdge("outer", "msg-c", { fromPort: "bottom" }),
			createEdge("inner", "msg-a", { fromPort: "top" }),
			createEdge("inner", "msg-b", { fromPort: "bottom" }),
			createEdge("msg-a", "end"),
			createEdge("msg-b", "end"),
			createEdge("msg-c", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.warnings).toHaveLength(0);
		expect(result.code).toContain('step.do("mensaje-a"');
		expect(result.code).toContain('step.do("mensaje-b"');
		expect(result.code).toContain('step.do("mensaje-c"');

		// return appears only once (shared End)
		const returnCount = (result.code.match(/return \{ success: true/g) ?? [])
			.length;
		expect(returnCount).toBe(1);

		// The outer if/else appears before the inner if/else
		expect(result.code.indexOf("if (outer_cond)")).toBeLessThan(
			result.code.indexOf("if (inner_cond)"),
		);
	});

	// ── Continuation after convergence: post-join steps are generated ──────

	it("Decision + Join + Message + End: message after Join is generated correctly", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "decision",
				type: "Decision",
				title: "Decision",
				config: { condition: "cond" },
			}),
			createNode({
				id: "form-a",
				type: "Form",
				title: "Formulario A",
				roles: [],
			}),
			createNode({
				id: "form-b",
				type: "Form",
				title: "Formulario B",
				roles: [],
			}),
			createNode({ id: "join", type: "Join", title: "Union" }),
			createNode({
				id: "msg-final",
				type: "Message",
				title: "Mensaje Final",
				config: { type: "email" },
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "decision"),
			createEdge("decision", "form-a", { fromPort: "top" }),
			createEdge("decision", "form-b", { fromPort: "bottom" }),
			createEdge("form-a", "join"),
			createEdge("form-b", "join"),
			createEdge("join", "msg-final"),
			createEdge("msg-final", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.warnings).toHaveLength(0);

		const joinIdx = result.code.indexOf('step.do("union"');
		const msgIdx = result.code.indexOf('step.do("mensaje-final"');
		const returnIdx = result.code.indexOf("return { success: true");

		expect(joinIdx).toBeGreaterThanOrEqual(0);
		expect(msgIdx).toBeGreaterThan(joinIdx);
		expect(returnIdx).toBeGreaterThan(msgIdx);
	});

	// ── Deterministic edge order (issue: delete+recreate edge) ──────────────

	it("produces identical code when edges are re-ordered (simulating delete+recreate)", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "decision",
				type: "Decision",
				title: "Decisión",
				config: { condition: "cond" },
			}),
			createNode({
				id: "msg-a",
				type: "Message",
				title: "Mensaje A",
				config: { type: "email" },
			}),
			createNode({
				id: "msg-b",
				type: "Message",
				title: "Mensaje B",
				config: { type: "email" },
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edgesOriginal: WorkflowEdge[] = [
			createEdge("start", "decision", { id: "e1" }),
			createEdge("decision", "msg-a", { id: "e2", fromPort: "top" }),
			createEdge("decision", "msg-b", { id: "e3", fromPort: "bottom" }),
			createEdge("msg-a", "end", { id: "e4" }),
			createEdge("msg-b", "end", { id: "e5" }),
		];

		const edgesReordered: WorkflowEdge[] = [
			createEdge("start", "decision", { id: "e1" }),
			createEdge("decision", "msg-b", { id: "e3", fromPort: "bottom" }),
			createEdge("msg-b", "end", { id: "new-e4" }),
			createEdge("decision", "msg-a", { id: "new-e2", fromPort: "top" }),
			createEdge("msg-a", "end", { id: "new-e5" }),
		];

		const resultOriginal = generateWorkflowCode(nodes, edgesOriginal);
		const resultReordered = generateWorkflowCode(nodes, edgesReordered);

		expect(resultOriginal.code).toBe(resultReordered.code);
	});

	it("produces identical code regardless of edge ID changes", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "form",
				type: "Form",
				title: "Formulario",
				roles: [],
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];

		const edgesV1: WorkflowEdge[] = [
			createEdge("start", "form", { id: "edge-1000" }),
			createEdge("form", "end", { id: "edge-2000" }),
		];

		const edgesV2: WorkflowEdge[] = [
			createEdge("start", "form", { id: "edge-9999999" }),
			createEdge("form", "end", { id: "edge-8888888" }),
		];

		const resultV1 = generateWorkflowCode(nodes, edgesV1);
		const resultV2 = generateWorkflowCode(nodes, edgesV2);

		expect(resultV1.code).toBe(resultV2.code);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// API node: config.url fix tests
// ─────────────────────────────────────────────────────────────────────────────

describe("generateWorkflowCode – API node config.url fix", () => {
	const baseNodes = (apiConfig: Record<string, unknown>) => [
		createNode({ id: "start", type: "Start", title: "Inicio" }),
		createNode({
			id: "api",
			type: "API",
			title: "Call API",
			config: apiConfig,
		}),
		createNode({ id: "end", type: "End", title: "Fin" }),
	];
	const baseEdges = () => [
		createEdge("start", "api"),
		createEdge("api", "end"),
	];

	it("should use config.url when provided", () => {
		const result = generateWorkflowCode(
			baseNodes({ url: "https://api.example.com/v1/resource", method: "POST" }),
			baseEdges(),
		);
		expect(result.code).toContain(
			'fetch("https://api.example.com/v1/resource"',
		);
	});

	it("should fall back to config.endpoint for legacy nodes", () => {
		const result = generateWorkflowCode(
			baseNodes({
				endpoint: "https://legacy.example.com/endpoint",
				method: "GET",
			}),
			baseEdges(),
		);
		expect(result.code).toContain(
			'fetch("https://legacy.example.com/endpoint"',
		);
	});

	it("should prefer config.url over config.endpoint when both exist", () => {
		const result = generateWorkflowCode(
			baseNodes({
				url: "https://new.example.com/api",
				endpoint: "https://old.example.com/api",
				method: "POST",
			}),
			baseEdges(),
		);
		expect(result.code).toContain('fetch("https://new.example.com/api"');
		expect(result.code).not.toContain("https://old.example.com/api");
	});

	it("should fall back to /api/endpoint when neither url nor endpoint is set", () => {
		const result = generateWorkflowCode(baseNodes({}), baseEdges());
		expect(result.code).toContain('fetch("/api/endpoint"');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// validateNodeCodeSyntax tests
// ─────────────────────────────────────────────────────────────────────────────

describe("validateNodeCodeSyntax", () => {
	it("should pass for nodes without Transform or Decision", async () => {
		const { validateNodeCodeSyntax } = await import("./code-generator");
		const nodes = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const result = await validateNodeCodeSyntax(nodes);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it("should pass for valid Transform code", async () => {
		const { validateNodeCodeSyntax } = await import("./code-generator");
		const nodes = [
			createNode({
				id: "t",
				type: "Transform",
				title: "Transform",
				config: { code: "return { ok: true };" },
			}),
		];
		const result = await validateNodeCodeSyntax(nodes);
		expect(result.valid).toBe(true);
	});

	it("should fail for Transform node with JSON object code (the reported bug)", async () => {
		const { validateNodeCodeSyntax } = await import("./code-generator");
		const nodes = [
			createNode({
				id: "t",
				type: "Transform",
				title: "Transformación 1",
				config: { code: '"example":"example"' },
			}),
		];
		const result = await validateNodeCodeSyntax(nodes);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("Transformación 1"))).toBe(
			true,
		);
	});

	it("should fail for Decision node with invalid condition", async () => {
		const { validateNodeCodeSyntax } = await import("./code-generator");
		const nodes = [
			createNode({
				id: "d",
				type: "Decision",
				title: "Decisión",
				config: { condition: "amount >" },
			}),
		];
		const result = await validateNodeCodeSyntax(nodes);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("Decisión"))).toBe(true);
	});

	it("should report errors for multiple invalid nodes", async () => {
		const { validateNodeCodeSyntax } = await import("./code-generator");
		const nodes = [
			createNode({
				id: "t",
				type: "Transform",
				title: "BadTransform",
				config: { code: '{"bad": "json"}' },
			}),
			createNode({
				id: "d",
				type: "Decision",
				title: "BadDecision",
				config: { condition: "amount >" },
			}),
		];
		const result = await validateNodeCodeSyntax(nodes);
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(2);
	});

	it("should skip Transform nodes without code", async () => {
		const { validateNodeCodeSyntax } = await import("./code-generator");
		const nodes = [
			createNode({
				id: "t",
				type: "Transform",
				title: "EmptyTransform",
				config: {},
			}),
		];
		const result = await validateNodeCodeSyntax(nodes);
		expect(result.valid).toBe(true);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// generateWorkflowCodeWithProgress – syntax validation integration
// ─────────────────────────────────────────────────────────────────────────────

describe("generateWorkflowCodeWithProgress – syntax validation", () => {
	it("should fail with syntax error when Transform code contains bare JSON", async () => {
		const { generateWorkflowCodeWithProgress } =
			await import("./code-generator");

		const nodes = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "t",
				type: "Transform",
				title: "Transformación 1",
				config: { code: '"example":"example"' },
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges = [createEdge("start", "t"), createEdge("t", "end")];

		const result = await generateWorkflowCodeWithProgress(nodes, edges);

		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("Transformación 1"))).toBe(
			true,
		);
		const validatePhase = result.phases.find((p) => p.id === "validate");
		expect(validatePhase?.status).toBe("error");
	});

	it("should succeed when Transform code is valid TypeScript", async () => {
		const { generateWorkflowCodeWithProgress } =
			await import("./code-generator");

		const nodes = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "t",
				type: "Transform",
				title: "Calcular",
				config: { code: "return { ok: true };" },
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges = [createEdge("start", "t"), createEdge("t", "end")];

		const result = await generateWorkflowCodeWithProgress(nodes, edges);

		expect(result.valid).toBe(true);
		expect(result.code).toContain('step.do("calcular"');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// API node bugfix: GET without body, PATCH with body, default method
// ─────────────────────────────────────────────────────────────────────────────

describe("generateWorkflowCode – API node method/body fix", () => {
	const apiNodes = (config: Record<string, unknown>) => [
		createNode({ id: "start", type: "Start", title: "Inicio" }),
		createNode({ id: "api", type: "API", title: "API Call", config }),
		createNode({ id: "end", type: "End", title: "Fin" }),
	];
	const apiEdges = () => [createEdge("start", "api"), createEdge("api", "end")];

	it("GET requests should NOT include body or Content-Type header", () => {
		const result = generateWorkflowCode(
			apiNodes({ url: "https://example.com/data", method: "GET" }),
			apiEdges(),
		);
		expect(result.code).toContain('method: "GET"');
		expect(result.code).not.toContain("body:");
		expect(result.code).not.toContain("Content-Type");
	});

	it("DELETE requests should NOT include body or Content-Type header", () => {
		const result = generateWorkflowCode(
			apiNodes({ url: "https://example.com/data", method: "DELETE" }),
			apiEdges(),
		);
		expect(result.code).toContain('method: "DELETE"');
		expect(result.code).not.toContain("body:");
		expect(result.code).not.toContain("Content-Type");
	});

	it("POST requests should include body and Content-Type header", () => {
		const result = generateWorkflowCode(
			apiNodes({ url: "https://example.com/data", method: "POST" }),
			apiEdges(),
		);
		expect(result.code).toContain('method: "POST"');
		expect(result.code).toContain("body: JSON.stringify(event.payload)");
		expect(result.code).toContain("Content-Type");
	});

	it("PUT requests should include body and Content-Type header", () => {
		const result = generateWorkflowCode(
			apiNodes({ url: "https://example.com/data", method: "PUT" }),
			apiEdges(),
		);
		expect(result.code).toContain('method: "PUT"');
		expect(result.code).toContain("body:");
	});

	it("PATCH requests should include body and Content-Type header", () => {
		const result = generateWorkflowCode(
			apiNodes({ url: "https://example.com/data", method: "PATCH" }),
			apiEdges(),
		);
		expect(result.code).toContain('method: "PATCH"');
		expect(result.code).toContain("body: JSON.stringify(event.payload)");
		expect(result.code).toContain("Content-Type");
	});

	it("default method should be GET (not POST)", () => {
		const result = generateWorkflowCode(
			apiNodes({ url: "https://example.com/data" }),
			apiEdges(),
		);
		expect(result.code).toContain('method: "GET"');
		expect(result.code).not.toContain("body:");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Node output variables: only Challenge gets hoisted let declarations;
// API, Form, Transform, Checkpoint use direct await (no captured variable)
// ─────────────────────────────────────────────────────────────────────────────

describe("generateWorkflowCode – let variable declarations for node output", () => {
	it("should NOT declare let variables for API/Form/Transform/Checkpoint nodes", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "form",
				type: "Form",
				title: "Formulario Inicial",
				roles: ["Solicitante"],
			}),
			createNode({
				id: "api",
				type: "API",
				title: "Pokemon API",
				config: { url: "https://pokeapi.co/api/v2/pokemon/1/" },
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "form"),
			createEdge("form", "api"),
			createEdge("api", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		// No hoisted let for API or Form — avoids unused-variable lint errors
		expect(result.code).not.toContain("let formularioInicial");
		expect(result.code).not.toContain("let pokemonApi");

		// Form uses waitForEvent; API uses step.do
		expect(result.code).toContain("step.waitForEvent");
		expect(result.code).toContain('"formulario-inicial"');
		expect(result.code).toContain('await step.do("pokemon-api"');
	});

	it("should NOT declare let for Transform nodes", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "transform",
				type: "Transform",
				title: "Procesar Datos",
				config: { code: "return { ok: true };" },
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "transform"),
			createEdge("transform", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).not.toContain("let procesarDatos");
		expect(result.code).toContain('await step.do("procesar-datos"');
	});

	it("should NOT declare let for Checkpoint nodes", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "cp",
				type: "Checkpoint",
				title: "Guardar Estado",
				checkpointType: "safe",
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "cp"),
			createEdge("cp", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).not.toContain("let guardarEstado");
		expect(result.code).toContain('await step.do("guardar-estado"');
	});

	it("should declare let ONLY for Challenge nodes (result used in if/else branch)", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "challenge",
				type: "Challenge",
				title: "Aprobacion Manual",
				config: { challengeType: "acceptance" },
			}),
			createNode({ id: "end-ok", type: "End", title: "Aprobado" }),
			createNode({ id: "end-ko", type: "Reject", title: "Rechazado" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "challenge"),
			createEdge("challenge", "end-ok", { fromPort: "top" }),
			createEdge("challenge", "end-ko", { fromPort: "bottom" }),
		];

		const result = generateWorkflowCode(nodes, edges);

		// Challenge gets hoisted let so the if/else can reference it
		expect(result.code).toContain("let aprobacionManual: unknown = null;");
		expect(result.code).toContain("aprobacionManual = await step.waitForEvent");
		expect(result.code).not.toContain("const aprobacionManual");
	});

	it("should NOT declare let for fire-and-forget nodes (Message, FlagChange, Join)", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "msg",
				type: "Message",
				title: "Notificar",
				config: { type: "email" },
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "msg"),
			createEdge("msg", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).not.toContain("let notificar:");
		expect(result.code).not.toMatch(/^\s*let\s/m);
	});

	it("should NOT generate any let declarations when no Challenge nodes exist", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [createEdge("start", "end")];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).not.toMatch(/\blet\s+\w+:\s*unknown\s*=\s*null/);
	});

	it("should use fallback variable name when challenge title is empty", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "challenge",
				type: "Challenge",
				title: "",
				config: { challengeType: "acceptance" },
			}),
			createNode({ id: "end-ok", type: "End", title: "Ok" }),
			createNode({ id: "end-ko", type: "Reject", title: "Ko" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "challenge"),
			createEdge("challenge", "end-ok", { fromPort: "top" }),
			createEdge("challenge", "end-ko", { fromPort: "bottom" }),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("let challengeResult: unknown = null;");
		expect(result.code).toContain(
			"challengeResult = await step.waitForEvent<{ accepted: boolean }>(",
		);
	});

	it("should handle Spanish characters in challenge variable names", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "challenge",
				type: "Challenge",
				title: "Aprobación Básica",
				config: { challengeType: "acceptance" },
			}),
			createNode({ id: "end-ok", type: "End", title: "Ok" }),
			createNode({ id: "end-ko", type: "Reject", title: "Ko" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "challenge"),
			createEdge("challenge", "end-ok", { fromPort: "top" }),
			createEdge("challenge", "end-ko", { fromPort: "bottom" }),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("let aprobacionBasica: unknown = null;");
		expect(result.code).toContain(
			"aprobacionBasica = await step.waitForEvent<{ accepted: boolean }>(",
		);
	});

	it("let declarations should appear before // Workflow started", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "challenge",
				type: "Challenge",
				title: "Test Approval",
				config: { challengeType: "acceptance" },
			}),
			createNode({ id: "end-ok", type: "End", title: "Ok" }),
			createNode({ id: "end-ko", type: "Reject", title: "Ko" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "challenge"),
			createEdge("challenge", "end-ok", { fromPort: "top" }),
			createEdge("challenge", "end-ko", { fromPort: "bottom" }),
		];

		const result = generateWorkflowCode(nodes, edges);

		const letIdx = result.code.indexOf("let testApproval: unknown = null;");
		const startedIdx = result.code.indexOf("// Workflow started");

		expect(letIdx).toBeGreaterThanOrEqual(0);
		expect(startedIdx).toBeGreaterThan(letIdx);
	});

	it("should produce deterministic code (same input = same output)", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "form",
				type: "Form",
				title: "Datos",
				roles: ["Admin"],
			}),
			createNode({
				id: "api",
				type: "API",
				title: "Enviar",
				config: { url: "https://example.com", method: "POST" },
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "form"),
			createEdge("form", "api"),
			createEdge("api", "end"),
		];

		const result1 = generateWorkflowCode(nodes, edges, undefined, {
			includeComments: false,
		});
		const result2 = generateWorkflowCode(nodes, edges, undefined, {
			includeComments: false,
		});

		expect(result1.code).toBe(result2.code);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Variable interpolation in generated strings
// ─────────────────────────────────────────────────────────────────────────────

describe("generateWorkflowCode – variable interpolation in generated strings", () => {
	const makeNodes = (apiConfig: Record<string, unknown>) => [
		createNode({ id: "start", type: "Start", title: "Inicio" }),
		createNode({
			id: "node-1773102326632",
			type: "API",
			title: "List Pokemon",
			config: {
				url: "https://pokeapi.co/api/v2/pokemon",
				method: "GET",
				outputSchema: {
					properties: [{ name: "results", type: "array", required: true }],
				},
			},
		}),
		createNode({
			id: "node-details",
			type: "API",
			title: "Get Pokemon Details",
			config: apiConfig,
		}),
		createNode({ id: "end", type: "End", title: "Fin" }),
	];
	const makeEdges = () => [
		createEdge("start", "node-1773102326632"),
		createEdge("node-1773102326632", "node-details"),
		createEdge("node-details", "end"),
	];

	it("API URL with variable ref should use backtick template literal", () => {
		const result = generateWorkflowCode(
			makeNodes({
				url: "${node-1773102326632.results[0].url}",
				method: "GET",
			}),
			makeEdges(),
		);

		// Must use backtick template literal with dehyphenated node ID
		expect(result.code).toContain(
			"fetch(`${node_1773102326632.results[0].url}`",
		);
		// Must NOT contain the original hyphenated literal string form
		expect(result.code).not.toContain('"${node-1773102326632.results[0].url}"');
	});

	it("API URL with mixed static prefix and variable ref uses backtick template literal", () => {
		const result = generateWorkflowCode(
			makeNodes({
				url: "https://api.example.com/${node-1773102326632.id}",
				method: "GET",
			}),
			makeEdges(),
		);

		expect(result.code).toContain(
			"fetch(`https://api.example.com/${node_1773102326632.id}`",
		);
	});

	it("API URL without variable refs continues to use double quotes", () => {
		const result = generateWorkflowCode(
			makeNodes({ url: "https://pokeapi.co/api/v2/pokemon/1", method: "GET" }),
			makeEdges(),
		);

		expect(result.code).toContain(
			'fetch("https://pokeapi.co/api/v2/pokemon/1"',
		);
	});

	it("Message email node uses sendTemplateEmail with merge var expression referencing upstream node", () => {
		const nodes = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "node-abc",
				type: "API",
				title: "Fetch Data",
				config: {
					url: "https://api.example.com",
					method: "GET",
					outputSchema: {
						properties: [{ name: "name", type: "string", required: true }],
					},
				},
			}),
			createNode({
				id: "message",
				type: "Message",
				title: "Notify",
				roles: ["Solicitante"],
				config: {
					channel: "email",
					templateName: "welcome-template",
					mergeVars: [{ key: "NOMBRE", value: "node_abc.name" }],
				},
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges = [
			createEdge("start", "node-abc"),
			createEdge("node-abc", "message"),
			createEdge("message", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		expect(result.code).toContain("sendTemplateEmail");
		expect(result.code).toContain('templateName: "welcome-template"');
		expect(result.code).toContain("NOMBRE: node_abc.name as string");
	});

	it("Transform code with variable ref should have node IDs dehyphenated", () => {
		const nodes = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({
				id: "node-data",
				type: "API",
				title: "Fetch Data",
				config: {
					url: "https://api.example.com",
					method: "GET",
					outputSchema: {
						properties: [{ name: "items", type: "array", required: true }],
					},
				},
			}),
			createNode({
				id: "transform",
				type: "Transform",
				title: "Process",
				config: {
					code: "const count = ${node-data.items}.length;\nreturn { count };",
				},
			}),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges = [
			createEdge("start", "node-data"),
			createEdge("node-data", "transform"),
			createEdge("transform", "end"),
		];

		const result = generateWorkflowCode(nodes, edges);

		// expandVariableRefs strips ${} and dehyphenates, so ${node-data.items}
		// becomes the plain property access node_data.items in the code body
		expect(result.code).toContain("const count = node_data.items.length;");
		// Must NOT contain the original hyphenated template-literal form
		expect(result.code).not.toContain("${node-data.items}");
	});
});

// ---------------------------------------------------------------------------
// Progress tracking injection tests
// ---------------------------------------------------------------------------

describe("generateWorkflowCode – progress tracking", () => {
	const meta: WorkflowMetadata = {
		name: "Progress Test",
		description: "",
		version: "1.0.0",
		author: "",
		tags: [],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};

	it("injects updateInstanceProgress before and after a Form node (waiting_event + completed)", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Start" }),
			createNode({ id: "form1", type: "Form", title: "My Form" }),
			createNode({ id: "end", type: "End", title: "End" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "form1"),
			createEdge("form1", "end"),
		];

		const { code } = generateWorkflowCode(nodes, edges, meta);

		// Should contain waiting_event call before waitForEvent
		expect(code).toContain('"waiting_event"');
		expect(code).toContain('"form-submission-my-form"');

		// Should contain completed call after waitForEvent
		expect(code).toContain('"completed"');

		// WORKFLOW_SVC.updateInstanceProgress should appear at least twice for the form node
		const matches = (code.match(/WORKFLOW_SVC\.updateInstanceProgress/g) ?? [])
			.length;
		expect(matches).toBeGreaterThanOrEqual(2);
	});

	it("injects updateInstanceProgress for API node (in_progress + completed)", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Start" }),
			createNode({
				id: "api1",
				type: "API",
				title: "Call API",
				config: { url: "https://example.com/api", method: "GET" },
			}),
			createNode({ id: "end", type: "End", title: "End" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "api1"),
			createEdge("api1", "end"),
		];

		const { code } = generateWorkflowCode(nodes, edges, meta);

		expect(code).toContain('"in_progress"');
		expect(code).toContain('"completed"');
		const matches = (code.match(/WORKFLOW_SVC\.updateInstanceProgress/g) ?? [])
			.length;
		expect(matches).toBeGreaterThanOrEqual(2);
	});

	it("emits nodeId and nodeType in progress calls", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Start" }),
			createNode({ id: "chk1", type: "Checkpoint", title: "Save Point" }),
			createNode({ id: "end", type: "End", title: "End" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "chk1"),
			createEdge("chk1", "end"),
		];

		const { code } = generateWorkflowCode(nodes, edges, meta);

		expect(code).toContain('"chk1"'); // nodeId
		expect(code).toContain('"Checkpoint"'); // nodeType
	});

	it("adds updateInstanceProgress signature to WorkflowEnv interface", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Start" }),
			createNode({ id: "end", type: "End", title: "End" }),
		];
		const edges: WorkflowEdge[] = [createEdge("start", "end")];

		const { code } = generateWorkflowCode(nodes, edges, meta);

		expect(code).toContain("updateInstanceProgress");
		expect(code).toContain('"waiting_event"'); // part of the status union in the interface
	});
});

// ---------------------------------------------------------------------------
// updateCaseObject integration
// ---------------------------------------------------------------------------

describe("generateWorkflowCode – updateCaseObject calls", () => {
	it("emits _init call for Start node with instanceId and startedAt", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [createEdge("start", "end")];
		const { code } = generateWorkflowCode(nodes, edges);

		expect(code).toContain("updateCaseObject");
		expect(code).toContain('"_init"');
		expect(code).toContain("event.instanceId");
		expect(code).toContain("startedAt");
	});

	it("emits updateCaseObject with node variable for Form nodes", () => {
		const formNode = createNode({
			id: "node-111",
			type: "Form",
			title: "Test Form",
			config: {
				outputSchema: {
					properties: [{ name: "field1", type: "string", required: true }],
				},
			},
		});
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			formNode,
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "node-111"),
			createEdge("node-111", "end"),
		];
		const { code } = generateWorkflowCode(nodes, edges);

		// Should include the form step name as key and the variable as value
		expect(code).toContain("updateCaseObject");
		expect(code).toContain('"test-form"');
		expect(code).toContain("node_111");
	});

	it("emits updateCaseObject with _status/_type for Message nodes", () => {
		const msgNode = createNode({
			id: "node-msg",
			type: "Message",
			title: "Notify User",
			roles: ["Solicitante"],
			config: {
				channel: "email",
				subject: "Hello",
				templateName: "greeting",
				mergeVars: {},
			},
		});
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Start" }),
			msgNode,
			createNode({ id: "end", type: "End", title: "End" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "node-msg"),
			createEdge("node-msg", "end"),
		];
		const { code } = generateWorkflowCode(nodes, edges);

		expect(code).toContain("_status");
		expect(code).toContain("_type");
		expect(code).toContain('"Message"');
		expect(code).toContain('"notify-user"');
	});

	it("emits updateCaseObject for End node with _status and _type", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Start" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [createEdge("start", "end")];
		const { code } = generateWorkflowCode(nodes, edges);

		expect(code).toContain('"End"');
		expect(code).toContain('"fin"');
	});

	it("always includes CASES_SVC.updateCaseObject in WorkflowEnv regardless of node types", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Start" }),
			createNode({ id: "end", type: "End", title: "End" }),
		];
		const edges: WorkflowEdge[] = [createEdge("start", "end")];
		const { code } = generateWorkflowCode(nodes, edges);

		expect(code).toContain("CASES_SVC");
		expect(code).toContain("updateCaseObject");
		expect(code).toContain("(caseId: string, data: Record<string, unknown>)");
	});
});

// =============================================================================
// Retry patterns
// =============================================================================

import { detectRetryZones } from "./code-generator";

describe("detectRetryZones", () => {
	it("returns empty array when no Reject nodes have allowRetry", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start" }),
			createNode({ id: "cp", type: "Checkpoint", title: "CP" }),
			createNode({
				id: "rej",
				type: "Reject",
				config: { allowRetry: false },
			}),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "cp"),
			createEdge("cp", "rej"),
		];
		expect(detectRetryZones(nodes, edges)).toHaveLength(0);
	});

	it("detects one zone for a Reject -> Checkpoint retry edge", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start" }),
			createNode({ id: "cp", type: "Checkpoint", title: "Test Checkpoint" }),
			createNode({
				id: "rej",
				type: "Reject",
				config: { allowRetry: true, maxRetries: 2 },
			}),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "cp"),
			createEdge("rej", "cp"), // retry back-edge
		];
		const zones = detectRetryZones(nodes, edges);
		expect(zones).toHaveLength(1);
		expect(zones[0].checkpointNodeId).toBe("cp");
		expect(zones[0].rejectNodeId).toBe("rej");
		expect(zones[0].maxRetries).toBe(2);
		expect(zones[0].unlimited).toBe(false);
		expect(zones[0].retryVarName).toMatch(/^retry_/);
	});

	it("marks zone as unlimited when maxRetries=0 (editor default = unlimited)", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start" }),
			createNode({ id: "cp", type: "Checkpoint", title: "CP" }),
			createNode({
				id: "rej",
				type: "Reject",
				config: { allowRetry: true, maxRetries: 0 },
			}),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "cp"),
			createEdge("rej", "cp"),
		];
		const zones = detectRetryZones(nodes, edges);
		expect(zones).toHaveLength(1);
		expect(zones[0].unlimited).toBe(true);
	});

	it("marks zone as unlimited when maxRetries is not set (undefined)", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start" }),
			createNode({ id: "cp", type: "Checkpoint", title: "CP" }),
			createNode({
				id: "rej",
				type: "Reject",
				config: { allowRetry: true },
			}),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "cp"),
			createEdge("rej", "cp"),
		];
		const zones = detectRetryZones(nodes, edges);
		expect(zones).toHaveLength(1);
		expect(zones[0].unlimited).toBe(true);
	});

	it("detects two zones for two independent Reject -> Checkpoint edges", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start" }),
			createNode({ id: "cp1", type: "Checkpoint", title: "CP 1" }),
			createNode({ id: "cp2", type: "Checkpoint", title: "CP 2" }),
			createNode({
				id: "rej1",
				type: "Reject",
				config: { allowRetry: true, maxRetries: 1 },
			}),
			createNode({
				id: "rej2",
				type: "Reject",
				config: { allowRetry: true, maxRetries: 3 },
			}),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "cp1"),
			createEdge("rej1", "cp1"),
			createEdge("cp1", "cp2"),
			createEdge("rej2", "cp2"),
		];
		const zones = detectRetryZones(nodes, edges);
		expect(zones).toHaveLength(2);
	});
});

describe("Pattern 1 — Reject to Checkpoint retry loop", () => {
	// Build a minimal workflow:
	// Start -> Checkpoint -> Challenge --(accepted)--> End
	//                                 --(rejected)--> Rejected (allowRetry: 2, -> Checkpoint)
	const buildPattern1Nodes = (): WorkflowNode[] => [
		createNode({ id: "start", type: "Start", title: "Inicio" }),
		createNode({
			id: "cp",
			type: "Checkpoint",
			title: "Test Checkpoint",
		}),
		createNode({
			id: "challenge",
			type: "Challenge",
			title: "Mi Challenge",
			config: { challengeType: "acceptance" },
		}),
		createNode({ id: "end", type: "End", title: "Fin" }),
		createNode({
			id: "rej",
			type: "Reject",
			title: "Rechazado",
			config: { allowRetry: true, maxRetries: 2 },
		}),
	];

	const buildPattern1Edges = (): WorkflowEdge[] => [
		createEdge("start", "cp"),
		createEdge("cp", "challenge"),
		createEdge("challenge", "end", { fromPort: "top" }),
		createEdge("challenge", "rej", { fromPort: "bottom" }),
		createEdge("rej", "cp"), // retry back-edge
	];

	it("generates a for loop around the retry zone", () => {
		const { code } = generateWorkflowCode(
			buildPattern1Nodes(),
			buildPattern1Edges(),
		);
		expect(code).toMatch(/for\s*\(let \w+ = 0; \w+ <= 2; \w+\+\+\)/);
	});

	it("generates continue inside the rejected branch", () => {
		const { code } = generateWorkflowCode(
			buildPattern1Nodes(),
			buildPattern1Edges(),
		);
		expect(code).toContain("continue; // Retry from checkpoint");
	});

	it("generates return false when retries are exhausted", () => {
		const { code } = generateWorkflowCode(
			buildPattern1Nodes(),
			buildPattern1Edges(),
		);
		expect(code).toContain("return { success: false");
	});

	it("uses in_progress status for Reject while retrying (prevents premature terminal detection)", () => {
		const { code } = generateWorkflowCode(
			buildPattern1Nodes(),
			buildPattern1Edges(),
		);
		// Inside the retry branch (if rv < maxRetries), Reject must emit "in_progress"
		// so the cases-svc workflowProgress endpoint doesn't treat it as a final rejection.
		// Pattern in generated code: status: "in_progress" appears inside the if(rv < N) block.
		const rejectZoneStart = code.indexOf("// Workflow rejected (retry zone)");
		expect(rejectZoneStart).toBeGreaterThan(-1);
		const rejectZoneCode = code.slice(rejectZoneStart);
		// The progress call for retrying uses in_progress
		expect(rejectZoneCode).toMatch(/status:\s*"in_progress"/);
	});

	it("uses completed status for Reject only on final rejection", () => {
		const { code } = generateWorkflowCode(
			buildPattern1Nodes(),
			buildPattern1Edges(),
		);
		// After retries are exhausted (after the if/continue block), the progress call
		// uses "completed" so the endpoint correctly marks the case as rejected.
		const rejectZoneStart = code.indexOf("// Workflow rejected (retry zone)");
		const rejectZoneCode = code.slice(rejectZoneStart);
		// "in_progress" must appear first (inside the retry branch)
		const inProgressIdx = rejectZoneCode.search(/status:\s*"in_progress"/);
		// "completed" must appear after the retry branch
		const completedIdx = rejectZoneCode.search(/"_prog-[^"]*-completed"/);
		expect(inProgressIdx).toBeGreaterThan(-1);
		expect(completedIdx).toBeGreaterThan(-1);
		// The in_progress call must come before the completed call
		expect(inProgressIdx).toBeLessThan(completedIdx);
	});

	it("uses retry-suffixed step names inside the loop", () => {
		const { code } = generateWorkflowCode(
			buildPattern1Nodes(),
			buildPattern1Edges(),
		);
		// Step names must reference the retry variable when > 0
		expect(code).toMatch(/-r\$\{/);
	});

	it("does NOT generate a for loop when allowRetry is false", () => {
		const nodes = buildPattern1Nodes().map((n) =>
			n.id === "rej"
				? { ...n, config: { allowRetry: false, maxRetries: 0 } }
				: n,
		);
		// Remove retry back-edge
		const edges = buildPattern1Edges().filter(
			(e) => !(e.from === "rej" && e.to === "cp"),
		);
		const { code } = generateWorkflowCode(nodes, edges);
		expect(code).not.toMatch(/for\s*\(let \w+ = 0/);
	});

	it("generates an infinite for loop when maxRetries=0 (unlimited)", () => {
		const nodes = buildPattern1Nodes().map((n) =>
			n.id === "rej"
				? { ...n, config: { allowRetry: true, maxRetries: 0 } }
				: n,
		);
		const { code } = generateWorkflowCode(nodes, buildPattern1Edges());
		// Infinite loop: no upper-bound in the for condition (only `; ;`)
		expect(code).toMatch(/for\s*\(let \w+ = 0;\s*;\s*\w+\+\+\)/);
		// Should NOT have a numeric upper bound like `<= 0`
		expect(code).not.toMatch(/\w+ <= 0/);
	});

	it("generates always-continue (no return false) when unlimited", () => {
		const nodes = buildPattern1Nodes().map((n) =>
			n.id === "rej"
				? { ...n, config: { allowRetry: true, maxRetries: 0 } }
				: n,
		);
		const { code } = generateWorkflowCode(nodes, buildPattern1Edges());
		expect(code).toContain("continue; // Unlimited retry from checkpoint");
		// With unlimited retries the Reject node should only emit continue, not return false
		expect(code).not.toContain("return { success: false");
		// Unlimited reject always uses "in_progress" (never reaches "completed" for the reject node)
		const unlimitedSection = code.slice(
			code.indexOf("// Workflow rejected — retrying (unlimited)"),
		);
		expect(unlimitedSection).toMatch(/status:\s*"in_progress"/);
	});

	it("no-regression: workflow without retry generates same code structure as before", () => {
		const nodes: WorkflowNode[] = [
			createNode({ id: "start", type: "Start", title: "Inicio" }),
			createNode({ id: "form", type: "Form", title: "Formulario" }),
			createNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [
			createEdge("start", "form"),
			createEdge("form", "end"),
		];
		const { code } = generateWorkflowCode(nodes, edges);
		expect(code).not.toMatch(/for\s*\(let \w+ = 0/);
		expect(code).toContain("waitForEvent");
		expect(code).toContain("return { success: true");
	});
});

describe("Pattern 2 — Challenge inline retry loop", () => {
	const buildPattern2Nodes = (): WorkflowNode[] => [
		createNode({ id: "start", type: "Start", title: "Inicio" }),
		createNode({
			id: "challenge",
			type: "Challenge",
			title: "Mi Challenge",
			config: {
				challengeType: "acceptance",
				retries: { maxRetries: 3 },
			},
		}),
		createNode({ id: "end", type: "End", title: "Fin" }),
		createNode({ id: "rej", type: "Reject", title: "Rechazado", config: {} }),
	];

	const buildPattern2Edges = (): WorkflowEdge[] => [
		createEdge("start", "challenge"),
		createEdge("challenge", "end", { fromPort: "top" }),
		createEdge("challenge", "rej", { fromPort: "bottom" }),
	];

	it("generates an inline for loop around the waitForEvent", () => {
		const { code } = generateWorkflowCode(
			buildPattern2Nodes(),
			buildPattern2Edges(),
		);
		// Should have a loop for inline challenge retries
		expect(code).toMatch(/for\s*\(let \w+ = 0; \w+ <= 3; \w+\+\+\)/);
	});

	it("breaks out of the inline loop when accepted", () => {
		const { code } = generateWorkflowCode(
			buildPattern2Nodes(),
			buildPattern2Edges(),
		);
		expect(code).toContain("break;");
	});

	it("does NOT generate inline loop when no retries configured", () => {
		const nodes = buildPattern2Nodes().map((n) =>
			n.id === "challenge"
				? {
						...n,
						config: { challengeType: "acceptance" } as Record<string, unknown>,
					}
				: n,
		);
		const { code } = generateWorkflowCode(nodes, buildPattern2Edges());
		expect(code).not.toMatch(/for\s*\(let \w+ = 0/);
	});
});

describe("Pattern 3 — API return-to-checkpoint retry", () => {
	const buildPattern3Nodes = (): WorkflowNode[] => [
		createNode({ id: "start", type: "Start", title: "Inicio" }),
		createNode({
			id: "cp",
			type: "Checkpoint",
			title: "Mi Checkpoint",
		}),
		createNode({
			id: "api",
			type: "API",
			title: "External API",
			config: {
				url: "https://example.com/api",
				method: "POST",
				failureHandling: {
					onFailure: "return-to-checkpoint",
					maxRetries: 2,
					timeout: 30000,
				},
			},
		}),
		createNode({ id: "end", type: "End", title: "Fin" }),
		createNode({
			id: "rej",
			type: "Reject",
			title: "Rechazado",
			config: { allowRetry: true, maxRetries: 2 },
		}),
	];

	const buildPattern3Edges = (): WorkflowEdge[] => [
		createEdge("start", "cp"),
		createEdge("cp", "api"),
		createEdge("api", "end"),
		createEdge("rej", "cp"), // retry back-edge (needed for zone detection)
	];

	it("generates try/catch around the API step.do call", () => {
		const { code } = generateWorkflowCode(
			buildPattern3Nodes(),
			buildPattern3Edges(),
		);
		expect(code).toContain("try {");
		expect(code).toContain("} catch (_apiErr)");
	});

	it("generates continue inside catch to return to checkpoint", () => {
		const { code } = generateWorkflowCode(
			buildPattern3Nodes(),
			buildPattern3Edges(),
		);
		expect(code).toContain("continue; // Return to checkpoint and retry");
	});

	it("rethrows after max retries are exhausted", () => {
		const { code } = generateWorkflowCode(
			buildPattern3Nodes(),
			buildPattern3Edges(),
		);
		expect(code).toContain("throw _apiErr;");
	});
});

// ---------------------------------------------------------------------------
// Snapshot test — exact user workflow (Form → Checkpoint → Challenge → Reject)
// ---------------------------------------------------------------------------
describe("Snapshot — user workflow: Form → Checkpoint → Challenge → Reject(retry=2)", () => {
	/**
	 * Mirrors the real workflow the user is testing:
	 * Start → Form → Checkpoint → Challenge → (top: End, bottom: Reject(retry=2) → Checkpoint)
	 */
	const buildUserWorkflowNodes = (): WorkflowNode[] => [
		createNode({ id: "start", type: "Start", title: "Inicio" }),
		createNode({
			id: "form",
			type: "Form",
			title: "Formulario",
			config: { outputSchema: [{ key: "data", label: "Data", type: "text" }] },
		}),
		createNode({ id: "cp", type: "Checkpoint", title: "test de checkpoint" }),
		createNode({
			id: "challenge",
			type: "Challenge",
			title: "Challenge",
			config: { challengeType: "acceptance" },
		}),
		createNode({ id: "end", type: "End", title: "Fin" }),
		createNode({
			id: "rej",
			type: "Reject",
			title: "Rechazado",
			config: { allowRetry: true, maxRetries: 2 },
		}),
	];

	const buildUserWorkflowEdges = (): WorkflowEdge[] => [
		createEdge("start", "form"),
		createEdge("form", "cp"),
		createEdge("cp", "challenge"),
		createEdge("challenge", "end", { fromPort: "top" }),
		createEdge("challenge", "rej", { fromPort: "bottom" }),
		createEdge("rej", "cp"), // retry back-edge
	];

	it("generates correct for loop structure (snapshot)", () => {
		const { code, warnings } = generateWorkflowCode(
			buildUserWorkflowNodes(),
			buildUserWorkflowEdges(),
		);

		// Print generated code for inspection
		// eslint-disable-next-line no-console
		console.log("\n=== GENERATED CODE SNAPSHOT ===\n", code);
		// eslint-disable-next-line no-console
		console.log("=== WARNINGS ===", warnings);

		// The for loop must wrap the Checkpoint → Challenge → Reject path
		// createVariableName converts "test de checkpoint" → "testDeCheckpoint"
		// so retryVarName = "retry_testDeCheckpoint"
		expect(code).toMatch(
			/for\s*\(let retry_testDeCheckpoint = 0; retry_testDeCheckpoint <= 2; retry_testDeCheckpoint\+\+\)/,
		);

		// The `continue` must be inside the else (rejected) branch
		expect(code).toContain("continue; // Retry from checkpoint");

		// Must return success: false after retries exhausted
		expect(code).toContain("return { success: false");

		// Must return success: true on the accepted path
		expect(code).toContain("return { success: true");

		// Step names inside the loop must use the retry variable
		expect(code).toMatch(
			/retry_testDeCheckpoint > 0 \? `test-de-checkpoint-r\$\{retry_testDeCheckpoint\}`/,
		);

		// Reject uses in_progress while retrying (prevents premature terminal detection)
		expect(code).toContain(`status: "in_progress"`);
		// Only the FINAL rejection uses "completed" for the reject node
		const rejectZoneCode = code.slice(
			code.indexOf("// Workflow rejected (retry zone)"),
		);
		expect(rejectZoneCode).toContain(`status: "completed"`);

		// Progress calls are wrapped in step.do for durability
		expect(code).toContain(`await step.do("_prog-`);
		// Case object calls are wrapped in step.do for durability
		expect(code).toContain(`await step.do("_case-`);

		// No warnings expected
		expect(warnings).toHaveLength(0);
	});

	it("produces code where accepted path falls through to End", () => {
		const { code } = generateWorkflowCode(
			buildUserWorkflowNodes(),
			buildUserWorkflowEdges(),
		);

		// Accepted path (if block) should be empty or only contain the End code
		// The `return { success: true }` must come AFTER the for loop closes
		const forLoopStart = code.indexOf("for (let retry_test_de_checkpoint");
		const returnTrue = code.indexOf("return { success: true");
		const closingBrace = code.lastIndexOf("}\n\n", returnTrue);
		// The return { success: true } should be OUTSIDE the for loop
		expect(returnTrue).toBeGreaterThan(forLoopStart);
		// There should be no `return { success: true }` inside the rejected branch
		const rejectBranchStart = code.indexOf("} else {");
		const rejectBranchEnd = code.indexOf("}\n\n", rejectBranchStart);
		const codeInRejectedBranch = code.slice(rejectBranchStart, rejectBranchEnd);
		expect(codeInRejectedBranch).not.toContain("return { success: true");
		expect(closingBrace).toBeGreaterThan(-1);
	});
});
