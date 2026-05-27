import { describe, it, expect } from "vitest";
import { validateWorkflow, validateWorkflowWithSyntax } from "./validation";
import {
	createDefaultChallengeConfig,
	createDefaultNLSConfig,
	type WorkflowNode,
	type WorkflowEdge,
	type NLSNodeConfig,
} from "./types";

describe("validateWorkflow", () => {
	describe("Start node validation", () => {
		it("should error when no Start node exists", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "form-1",
					type: "Form",
					title: "Form",
					description: "",
					roles: [],
					config: { formId: "form-1" },
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(errors.some((e) => e.message.includes("nodo de Inicio"))).toBe(
				true,
			);
		});

		it("should error when multiple Start nodes exist", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "start-2",
					type: "Start",
					title: "Start 2",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 100 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some((e) =>
					e.message.includes("solo puede tener un nodo de Inicio"),
				),
			).toBe(true);
		});
	});

	describe("Role validation", () => {
		it("should error when Form node has no roles", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "form-1",
					type: "Form",
					title: "Form",
					description: "",
					roles: [],
					config: { formId: "form-1" },
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) => e.nodeId === "form-1" && e.message.includes("rol asignado"),
				),
			).toBe(true);
		});

		it("should error when Challenge node has no roles", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "challenge-1",
					type: "Challenge",
					title: "Challenge",
					description: "",
					roles: [],
					config: createDefaultChallengeConfig("acceptance"),
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "challenge-1" && e.message.includes("rol asignado"),
				),
			).toBe(true);
		});

		it("should not error when other node types have no roles", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "api-1",
					type: "API",
					title: "API",
					description: "",
					roles: [],
					config: { url: "https://api.example.com" },
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) => e.nodeId === "api-1" && e.message.includes("rol asignado"),
				),
			).toBe(false);
		});
	});

	describe("Decision node validation", () => {
		it("should error when Decision node has less than 2 outgoing edges", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "decision-1",
					type: "Decision",
					title: "Decision",
					description: "",
					roles: [],
					config: { condition: "test > 0" },
					position: { x: 100, y: 0 },
					groupId: null,
				},
				{
					id: "end-1",
					type: "End",
					title: "End",
					description: "",
					roles: [],
					config: {},
					position: { x: 200, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "start-1", to: "decision-1", label: null },
				{ id: "edge-2", from: "decision-1", to: "end-1", label: "Yes" },
			];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "decision-1" &&
						e.message.includes("dos salidas conectadas"),
				),
			).toBe(true);
		});

		it("should not error when Decision node has 2 outgoing edges", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "decision-1",
					type: "Decision",
					title: "Decision",
					description: "",
					roles: [],
					config: { condition: "test > 0" },
					position: { x: 100, y: 0 },
					groupId: null,
				},
				{
					id: "end-1",
					type: "End",
					title: "End",
					description: "",
					roles: [],
					config: {},
					position: { x: 200, y: 0 },
					groupId: null,
				},
				{
					id: "reject-1",
					type: "Reject",
					title: "Reject",
					description: "",
					roles: [],
					config: {},
					position: { x: 200, y: 100 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "start-1", to: "decision-1", label: null },
				{ id: "edge-2", from: "decision-1", to: "end-1", label: "Yes" },
				{ id: "edge-3", from: "decision-1", to: "reject-1", label: "No" },
			];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "decision-1" &&
						e.message.includes("dos salidas conectadas"),
				),
			).toBe(false);
		});

		it("should error when Decision node has no condition", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "decision-1",
					type: "Decision",
					title: "Decision",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "decision-1" &&
						e.message.includes("condición definida"),
				),
			).toBe(true);
		});
	});

	describe("End node validation", () => {
		it("should error when no End or Reject nodes exist", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "form-1",
					type: "Form",
					title: "Form",
					description: "",
					roles: ["client"],
					config: { formId: "form-1" },
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "start-1", to: "form-1", label: null },
			];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some((e) => e.message.includes("nodo de finalización")),
			).toBe(true);
		});

		it("should not error when End node exists", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "end-1",
					type: "End",
					title: "End",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "start-1", to: "end-1", label: null },
			];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some((e) => e.message.includes("nodo de finalización")),
			).toBe(false);
		});
	});

	describe("Form node validation", () => {
		it("should error when Form node has no formId", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "form-1",
					type: "Form",
					title: "Form",
					description: "",
					roles: ["client"],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "form-1" &&
						e.message.includes("formulario seleccionado"),
				),
			).toBe(true);
		});
	});

	describe("Transform node validation", () => {
		it("should error when Transform node has no code", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "transform-1",
					type: "Transform",
					title: "Transform",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "transform-1" &&
						e.message.includes("código TypeScript"),
				),
			).toBe(true);
		});
	});

	describe("API node validation", () => {
		it("should error when API node has no URL", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "api-1",
					type: "API",
					title: "API",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) => e.nodeId === "api-1" && e.message.includes("URL configurada"),
				),
			).toBe(true);
		});

		it("should error when API node has maxRetries > 2", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "api-1",
					type: "API",
					title: "API",
					description: "",
					roles: [],
					config: {
						url: "https://api.example.com",
						failureHandling: {
							onFailure: "retry",
							maxRetries: 3,
							retryCount: 0,
							cacheStrategy: "always-execute",
							timeout: 5000,
						},
					},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "api-1" &&
						e.message.includes("número máximo de reintentos es 2"),
				),
			).toBe(true);
		});

		it("should NOT error when API node with onFailure='stop' has outgoing edges (success path is valid)", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "api-1",
					type: "API",
					title: "API",
					description: "",
					roles: [],
					config: {
						url: "https://api.example.com",
						failureHandling: {
							onFailure: "stop",
							maxRetries: 0,
							retryCount: 0,
							cacheStrategy: "always-execute",
							timeout: 5000,
						},
					},
					position: { x: 100, y: 0 },
					groupId: null,
				},
				{
					id: "end-1",
					type: "End",
					title: "End",
					description: "",
					roles: [],
					config: {},
					position: { x: 200, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "start-1", to: "api-1", label: null },
				{ id: "edge-2", from: "api-1", to: "end-1", label: null },
			];

			const errors = validateWorkflow(nodes, edges);
			// onFailure='stop' only affects the failure path — success path connections are valid
			expect(
				errors.some(
					(e) =>
						e.nodeId === "api-1" && e.message.includes("conexiones salientes"),
				),
			).toBe(false);
		});
	});

	describe("Message node validation", () => {
		it("should error when Message node has no channel defined", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "message-1",
					type: "Message",
					title: "Message",
					description: "",
					roles: ["client"],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "message-1" && e.message.includes("canal de entrega"),
				),
			).toBe(true);
		});

		it("should error when email Message node has no templateName", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "message-1",
					type: "Message",
					title: "Message",
					description: "",
					roles: ["client"],
					config: { channel: "email" },
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "message-1" &&
						e.message.includes("template de Mandrill"),
				),
			).toBe(true);
		});

		it("should error when sms Message node has no body", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "message-1",
					type: "Message",
					title: "Message",
					description: "",
					roles: ["client"],
					config: { channel: "sms" },
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "message-1" &&
						e.message.includes("cuerpo del mensaje SMS"),
				),
			).toBe(true);
		});

		it("should error when Message node has no roles (destinatarios)", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "message-1",
					type: "Message",
					title: "Message",
					description: "",
					roles: [],
					config: { channel: "email", templateName: "my-template" },
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "message-1" && e.message.includes("rol destinatario"),
				),
			).toBe(true);
		});

		it("should pass when email Message node has all required fields", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "message-1",
					type: "Message",
					title: "Message",
					description: "",
					roles: ["client"],
					config: {
						channel: "email",
						templateName: "my-template",
						mergeVars: [],
					},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			const messageErrors = errors.filter((e) => e.nodeId === "message-1");
			// Only connectivity/structural errors (no End node), no Message-specific errors
			expect(
				messageErrors.every(
					(e) =>
						!e.message.includes("canal") &&
						!e.message.includes("template") &&
						!e.message.includes("rol"),
				),
			).toBe(true);
		});

		it("should pass when sms Message node has all required fields", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "message-1",
					type: "Message",
					title: "Message",
					description: "",
					roles: ["seller"],
					config: {
						channel: "sms",
						body: "Tu solicitud fue procesada",
					},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			const messageErrors = errors.filter((e) => e.nodeId === "message-1");
			expect(
				messageErrors.every(
					(e) =>
						!e.message.includes("canal") &&
						!e.message.includes("SMS") &&
						!e.message.includes("rol"),
				),
			).toBe(true);
		});
	});

	describe("Challenge node validation", () => {
		it("should error when Challenge node has no challengeType", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "challenge-1",
					type: "Challenge",
					title: "Challenge",
					description: "",
					roles: ["client"],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "challenge-1" &&
						e.message.includes("tipo de challenge"),
				),
			).toBe(true);
		});

		it("should error when Challenge node has invalid timeout", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "challenge-1",
					type: "Challenge",
					title: "Challenge",
					description: "",
					roles: ["client"],
					config: {
						...createDefaultChallengeConfig("acceptance"),
						challengeTimeout: { value: 0, unit: "minutes" },
					},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "challenge-1" &&
						e.message.includes("timeout de challenge válido"),
				),
			).toBe(true);
		});

		it("should error when acceptance Challenge has no deliveryMethod", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "challenge-1",
					type: "Challenge",
					title: "Challenge",
					description: "",
					roles: ["client"],
					config: {
						challengeType: "acceptance",
						challengeTimeout: { value: 5, unit: "minutes" },
					},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "challenge-1" &&
						e.message.includes("canal de entrega"),
				),
			).toBe(true);
		});
	});

	describe("Reject node validation", () => {
		it("should error when Reject with allowRetry has no outgoing edges", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "reject-1",
					type: "Reject",
					title: "Reject",
					description: "",
					roles: [],
					config: { allowRetry: true, maxRetries: 1 },
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "start-1", to: "reject-1", label: null },
			];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "reject-1" &&
						e.message.includes("conexión hacia un checkpoint"),
				),
			).toBe(true);
		});

		it("should error when Reject without allowRetry has outgoing edges", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "reject-1",
					type: "Reject",
					title: "Reject",
					description: "",
					roles: [],
					config: { allowRetry: false },
					position: { x: 100, y: 0 },
					groupId: null,
				},
				{
					id: "end-1",
					type: "End",
					title: "End",
					description: "",
					roles: [],
					config: {},
					position: { x: 200, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "start-1", to: "reject-1", label: null },
				{ id: "edge-2", from: "reject-1", to: "end-1", label: null },
			];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "reject-1" &&
						e.message.includes("sin reintentos no debe tener conexiones"),
				),
			).toBe(true);
		});
	});

	describe("Node without outgoing connections", () => {
		it("should warn when non-terminal node has no outgoing connections", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "form-1",
					type: "Form",
					title: "Form",
					description: "",
					roles: ["client"],
					config: { formId: "form-1" },
					position: { x: 100, y: 0 },
					groupId: null,
				},
				{
					id: "end-1",
					type: "End",
					title: "End",
					description: "",
					roles: [],
					config: {},
					position: { x: 200, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "start-1", to: "form-1", label: null },
			];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "form-1" &&
						e.severity === "warning" &&
						e.message.includes("conexiones de salida"),
				),
			).toBe(true);
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// validateWorkflowWithSyntax tests
// ─────────────────────────────────────────────────────────────────────────────

const makeNode = (
	overrides: Partial<WorkflowNode> & {
		id: string;
		type: WorkflowNode["type"];
	},
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

describe("validateWorkflowWithSyntax", () => {
	it("should pass for a structurally valid workflow with valid Transform code", async () => {
		const nodes: WorkflowNode[] = [
			makeNode({ id: "start", type: "Start", title: "Inicio" }),
			makeNode({
				id: "t",
				type: "Transform",
				title: "Calcular",
				config: { code: "return { ok: true };" },
			}),
			makeNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [
			{ id: "e1", from: "start", to: "t", label: null },
			{ id: "e2", from: "t", to: "end", label: null },
		];

		const errors = await validateWorkflowWithSyntax(nodes, edges);
		expect(errors.filter((e) => e.severity === "error")).toHaveLength(0);
	});

	it("should add an error for Transform node with invalid code", async () => {
		const nodes: WorkflowNode[] = [
			makeNode({ id: "start", type: "Start", title: "Inicio" }),
			makeNode({
				id: "t",
				type: "Transform",
				title: "Transformación 1",
				config: { code: '"example":"example"' },
			}),
			makeNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [
			{ id: "e1", from: "start", to: "t", label: null },
			{ id: "e2", from: "t", to: "end", label: null },
		];

		const errors = await validateWorkflowWithSyntax(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "t" &&
					e.severity === "error" &&
					e.message.includes("Transformación 1"),
			),
		).toBe(true);
	});

	it("should add a warning for Decision node with invalid condition", async () => {
		const nodes: WorkflowNode[] = [
			makeNode({ id: "start", type: "Start", title: "Inicio" }),
			makeNode({
				id: "d",
				type: "Decision",
				title: "Decisión",
				config: { condition: "amount >" },
			}),
			makeNode({ id: "end-yes", type: "End", title: "Aprobado" }),
			makeNode({ id: "end-no", type: "Reject", title: "Rechazado" }),
		];
		const edges: WorkflowEdge[] = [
			{ id: "e1", from: "start", to: "d", label: null },
			{ id: "e2", from: "d", to: "end-yes", label: null, fromPort: "top" },
			{ id: "e3", from: "d", to: "end-no", label: null, fromPort: "bottom" },
		];

		const errors = await validateWorkflowWithSyntax(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "d" &&
					e.severity === "warning" &&
					e.message.includes("Decisión"),
			),
		).toBe(true);
	});

	it("should include structural errors alongside syntax errors", async () => {
		// No End node (structural error) + invalid Transform code (syntax error)
		const nodes: WorkflowNode[] = [
			makeNode({ id: "start", type: "Start", title: "Inicio" }),
			makeNode({
				id: "t",
				type: "Transform",
				title: "Bad",
				config: { code: '{"bad": "json"}' },
			}),
		];
		const edges: WorkflowEdge[] = [
			{ id: "e1", from: "start", to: "t", label: null },
		];

		const errors = await validateWorkflowWithSyntax(nodes, edges);
		// Should have at least one structural error (no End) and one syntax error
		expect(errors.some((e) => e.message.includes("finalización"))).toBe(true);
		expect(errors.some((e) => e.nodeId === "t")).toBe(true);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// validateWorkflow – orphan flag references (Etapa 2)
// ─────────────────────────────────────────────────────────────────────────────

describe("validateWorkflow – FlagChange empty config", () => {
	it("should warn when FlagChange has no flag changes configured", () => {
		const nodes: WorkflowNode[] = [
			makeNode({ id: "start", type: "Start", title: "Inicio" }),
			makeNode({
				id: "fc",
				type: "FlagChange",
				title: "Cambiar Estado",
				config: {},
			}),
			makeNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [
			{ id: "e1", from: "start", to: "fc", label: null },
			{ id: "e2", from: "fc", to: "end", label: null },
		];

		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "fc" &&
					e.severity === "warning" &&
					e.message.includes("al menos un cambio de flag"),
			),
		).toBe(true);
	});

	it("should warn when FlagChange has empty flagChanges array", () => {
		const nodes: WorkflowNode[] = [
			makeNode({ id: "start", type: "Start", title: "Inicio" }),
			makeNode({
				id: "fc",
				type: "FlagChange",
				title: "Cambiar Estado",
				config: { flagChanges: [] },
			}),
			makeNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [
			{ id: "e1", from: "start", to: "fc", label: null },
			{ id: "e2", from: "fc", to: "end", label: null },
		];

		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "fc" &&
					e.severity === "warning" &&
					e.message.includes("al menos un cambio de flag"),
			),
		).toBe(true);
	});

	it("should not warn when FlagChange has configured flag changes", () => {
		const nodes: WorkflowNode[] = [
			makeNode({ id: "start", type: "Start", title: "Inicio" }),
			makeNode({
				id: "fc",
				type: "FlagChange",
				title: "Cambiar Estado",
				config: {
					flagChanges: [{ flagId: "flag-a", optionId: "opt-1" }],
				},
			}),
			makeNode({ id: "end", type: "End", title: "Fin" }),
		];
		const edges: WorkflowEdge[] = [
			{ id: "e1", from: "start", to: "fc", label: null },
			{ id: "e2", from: "fc", to: "end", label: null },
		];

		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "fc" && e.message.includes("al menos un cambio de flag"),
			),
		).toBe(false);
	});
});

describe("validateWorkflow – FlagChange orphan references", () => {
	const flagA = {
		id: "flag-a",
		name: "Estado",
		options: [
			{ id: "opt-1", label: "Pendiente", color: "yellow-500" },
			{ id: "opt-2", label: "Aprobado", color: "green-500" },
		],
	};

	const baseNodes = (
		flagChanges: Array<{ flagId: string; optionId: string }>,
	) => [
		makeNode({ id: "start", type: "Start", title: "Inicio" }),
		makeNode({
			id: "fc",
			type: "FlagChange",
			title: "Cambiar Estado",
			config: { flagChanges },
		}),
		makeNode({ id: "end", type: "End", title: "Fin" }),
	];

	const baseEdges: WorkflowEdge[] = [
		{ id: "e1", from: "start", to: "fc", label: null },
		{ id: "e2", from: "fc", to: "end", label: null },
	];

	it("should pass when all flag references are valid", () => {
		const errors = validateWorkflow(
			baseNodes([{ flagId: "flag-a", optionId: "opt-1" }]),
			baseEdges,
			[flagA],
		);
		const flagErrors = errors.filter((e) => e.nodeId === "fc");
		expect(
			flagErrors.filter((e) => e.message.includes("inexistente")),
		).toHaveLength(0);
	});

	it("should report error when flagId does not exist in flags array", () => {
		const errors = validateWorkflow(
			baseNodes([{ flagId: "flag-nonexistent", optionId: "opt-1" }]),
			baseEdges,
			[flagA],
		);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "fc" &&
					e.severity === "error" &&
					e.message.includes("flag inexistente"),
			),
		).toBe(true);
	});

	it("should report error when optionId does not exist in the flag", () => {
		const errors = validateWorkflow(
			baseNodes([{ flagId: "flag-a", optionId: "opt-nonexistent" }]),
			baseEdges,
			[flagA],
		);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "fc" &&
					e.severity === "error" &&
					e.message.includes("opción inexistente"),
			),
		).toBe(true);
	});

	it("should not run flag validation when flags array is empty (backwards compat)", () => {
		const errors = validateWorkflow(
			baseNodes([{ flagId: "flag-a", optionId: "opt-1" }]),
			baseEdges,
			// no flags passed = backwards compatible behaviour
		);
		const flagErrors = errors.filter(
			(e) => e.nodeId === "fc" && e.message.includes("inexistente"),
		);
		expect(flagErrors).toHaveLength(0);
	});
});

describe("node title validation", () => {
	const makeMinimalWorkflow = (title: string) => {
		const nodes: WorkflowNode[] = [
			{
				id: "start",
				type: "Start",
				title: "Inicio",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 0 },
				groupId: null,
			},
			{
				id: "form",
				type: "Form",
				title,
				description: "",
				roles: ["org_manager"],
				config: { formId: "form-id-1" },
				position: { x: 100, y: 0 },
				groupId: null,
			},
			{
				id: "end",
				type: "End",
				title: "Fin",
				description: "",
				roles: [],
				config: {},
				position: { x: 200, y: 0 },
				groupId: null,
			},
		];
		const edges: WorkflowEdge[] = [
			{ id: "e1", from: "start", to: "form", label: null },
			{ id: "e2", from: "form", to: "end", label: null },
		];
		return { nodes, edges };
	};

	it("should warn when a node title starts with a digit", () => {
		const { nodes, edges } = makeMinimalWorkflow("1er Formulario");
		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "form" &&
					e.severity === "warning" &&
					e.message.includes("número o carácter especial"),
			),
		).toBe(true);
	});

	it("should warn when a node title starts with a special character", () => {
		const { nodes, edges } = makeMinimalWorkflow("@Formulario");
		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "form" &&
					e.severity === "warning" &&
					e.message.includes("número o carácter especial"),
			),
		).toBe(true);
	});

	it("should not warn when a node title starts with a letter", () => {
		const { nodes, edges } = makeMinimalWorkflow("Formulario de datos");
		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "form" &&
					e.message.includes("número o carácter especial"),
			),
		).toBe(false);
	});

	it("should not warn when a node title starts with an underscore", () => {
		const { nodes, edges } = makeMinimalWorkflow("_internal");
		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "form" &&
					e.message.includes("número o carácter especial"),
			),
		).toBe(false);
	});

	it("should not apply title validation to Start, End, or Reject nodes", () => {
		const nodes: WorkflowNode[] = [
			{
				id: "start",
				type: "Start",
				title: "1Inicio",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 0 },
				groupId: null,
			},
			{
				id: "end",
				type: "End",
				title: "2Fin",
				description: "",
				roles: [],
				config: {},
				position: { x: 100, y: 0 },
				groupId: null,
			},
		];
		const edges: WorkflowEdge[] = [
			{ id: "e1", from: "start", to: "end", label: null },
		];
		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some((e) => e.message.includes("número o carácter especial")),
		).toBe(false);
	});
});

describe("NLS node validation", () => {
	function makeNlsWorkflow(
		nlsConfig: NLSNodeConfig,
		extraNodes: WorkflowNode[] = [],
		extraEdges: WorkflowEdge[] = [],
	) {
		const nodes: WorkflowNode[] = [
			{
				id: "start",
				type: "Start",
				title: "Inicio",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 0 },
				groupId: null,
			},
			{
				id: "nls-1",
				type: "NLS",
				title: "NLS Node",
				description: "",
				roles: [],
				config: nlsConfig as unknown as Record<string, unknown>,
				position: { x: 100, y: 0 },
				groupId: null,
			},
			{
				id: "end",
				type: "End",
				title: "Fin",
				description: "",
				roles: [],
				config: {},
				position: { x: 200, y: 0 },
				groupId: null,
			},
			...extraNodes,
		];
		const edges: WorkflowEdge[] = [
			{ id: "e1", from: "start", to: "nls-1", label: null },
			{ id: "e2", from: "nls-1", to: "end", label: null },
			...extraEdges,
		];
		return { nodes, edges };
	}

	it("should error when NLS node has no functionId", () => {
		const cfg: NLSNodeConfig = {
			...createDefaultNLSConfig(),
			functionId: undefined,
		};
		const { nodes, edges } = makeNlsWorkflow(cfg);
		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "nls-1" &&
					e.message.includes("función NLS seleccionada"),
			),
		).toBe(true);
	});

	it("should not error when NLS node has a valid functionId", () => {
		const cfg: NLSNodeConfig = {
			...createDefaultNLSConfig(),
			functionId: "createLoan",
		};
		const { nodes, edges } = makeNlsWorkflow(cfg);
		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "nls-1" &&
					e.message.includes("función NLS seleccionada"),
			),
		).toBe(false);
	});

	it("should error when maxRetries exceeds 2", () => {
		const cfg: NLSNodeConfig = {
			...createDefaultNLSConfig(),
			functionId: "cancelLoan",
			failureHandling: {
				...createDefaultNLSConfig().failureHandling,
				maxRetries: 5,
			},
		};
		const { nodes, edges } = makeNlsWorkflow(cfg);
		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "nls-1" &&
					e.message.includes("máximo de reintentos es 2"),
			),
		).toBe(true);
	});

	it("should warn when timeout is out of bounds", () => {
		const cfg: NLSNodeConfig = {
			...createDefaultNLSConfig(),
			functionId: "getAmortization",
			failureHandling: {
				...createDefaultNLSConfig().failureHandling,
				timeout: 1000,
			},
		};
		const { nodes, edges } = makeNlsWorkflow(cfg);
		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "nls-1" &&
					e.severity === "warning" &&
					e.message.includes("timeout"),
			),
		).toBe(true);
	});

	it("should NOT error when onFailure=stop and node has outgoing edges (success path is valid)", () => {
		const cfg: NLSNodeConfig = {
			...createDefaultNLSConfig(),
			functionId: "createLoan",
			failureHandling: {
				...createDefaultNLSConfig().failureHandling,
				onFailure: "stop",
			},
		};
		const { nodes, edges } = makeNlsWorkflow(cfg);
		const errors = validateWorkflow(nodes, edges);
		// onFailure='stop' only affects the failure path — success path connections are valid
		expect(
			errors.some(
				(e) =>
					e.nodeId === "nls-1" &&
					e.message.includes("no puede tener conexiones salientes"),
			),
		).toBe(false);
	});

	it("should not error when onFailure=stop and no outgoing edges", () => {
		const cfg: NLSNodeConfig = {
			...createDefaultNLSConfig(),
			functionId: "createLoan",
			failureHandling: {
				...createDefaultNLSConfig().failureHandling,
				onFailure: "stop",
			},
		};
		const nodes: WorkflowNode[] = [
			{
				id: "start",
				type: "Start",
				title: "Inicio",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 0 },
				groupId: null,
			},
			{
				id: "nls-1",
				type: "NLS",
				title: "NLS Node",
				description: "",
				roles: [],
				config: cfg as unknown as Record<string, unknown>,
				position: { x: 100, y: 0 },
				groupId: null,
			},
		];
		const edges: WorkflowEdge[] = [
			{ id: "e1", from: "start", to: "nls-1", label: null },
		];
		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "nls-1" &&
					e.message.includes("no puede tener conexiones salientes"),
			),
		).toBe(false);
	});

	it("should error when return-to-checkpoint has no prior checkpoint", () => {
		const cfg: NLSNodeConfig = {
			...createDefaultNLSConfig(),
			functionId: "createLoan",
			failureHandling: {
				...createDefaultNLSConfig().failureHandling,
				onFailure: "return-to-checkpoint",
			},
		};
		const { nodes, edges } = makeNlsWorkflow(cfg);
		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "nls-1" &&
					e.message.includes("No hay checkpoint anterior"),
			),
		).toBe(true);
	});

	describe("prequalification function", () => {
		it("should not error for prequalification in applicant mode", () => {
			const cfg: NLSNodeConfig = {
				...createDefaultNLSConfig(),
				functionId: "prequalification",
				fields: [
					{ fieldId: "actorType", value: "applicant", source: "manual" },
				],
			};
			const { nodes, edges } = makeNlsWorkflow(cfg);
			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "nls-1" && e.message.includes("campos requeridos"),
				),
			).toBe(false);
		});

		it("should error for prequalification in coapplicant mode when identity fields are missing", () => {
			const cfg: NLSNodeConfig = {
				...createDefaultNLSConfig(),
				functionId: "prequalification",
				fields: [
					{ fieldId: "actorType", value: "coapplicant", source: "manual" },
				],
			};
			const { nodes, edges } = makeNlsWorkflow(cfg);
			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "nls-1" &&
						e.message.includes("campos requeridos de identidad"),
				),
			).toBe(true);
		});

		it("should not error for prequalification in coapplicant mode when all required fields are provided", () => {
			const cfg: NLSNodeConfig = {
				...createDefaultNLSConfig(),
				functionId: "prequalification",
				fields: [
					{ fieldId: "actorType", value: "coapplicant", source: "manual" },
					{ fieldId: "firstName", value: "John", source: "manual" },
					{ fieldId: "lastName", value: "Doe", source: "manual" },
					{ fieldId: "email", value: "john@test.com", source: "manual" },
					{ fieldId: "addressStreetNumber", value: "123", source: "manual" },
					{ fieldId: "addressStreetName", value: "Main St", source: "manual" },
					{ fieldId: "addressCity", value: "Austin", source: "manual" },
					{ fieldId: "addressState", value: "TX", source: "manual" },
					{ fieldId: "addressZipCode", value: "78701", source: "manual" },
				],
			};
			const { nodes, edges } = makeNlsWorkflow(cfg);
			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "nls-1" &&
						e.message.includes("campos requeridos de identidad"),
				),
			).toBe(false);
		});

		it("should error for findPrequalificationMatches when no match fields are provided", () => {
			const cfg: NLSNodeConfig = {
				...createDefaultNLSConfig(),
				functionId: "findPrequalificationMatches",
				fields: [],
			};
			const { nodes, edges } = makeNlsWorkflow(cfg);
			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "nls-1" &&
						e.message.includes("al menos un campo de búsqueda"),
				),
			).toBe(true);
		});

		it("should not error for findPrequalificationMatches when at least one match field is provided", () => {
			const cfg: NLSNodeConfig = {
				...createDefaultNLSConfig(),
				functionId: "findPrequalificationMatches",
				fields: [
					{ fieldId: "email", value: "test@test.com", source: "manual" },
				],
			};
			const { nodes, edges } = makeNlsWorkflow(cfg);
			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "nls-1" &&
						e.message.includes("al menos un campo de búsqueda"),
				),
			).toBe(false);
		});
	});
});
