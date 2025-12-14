import { describe, it, expect } from "vitest";
import { validateWorkflow } from "./validation";
import {
	createDefaultChallengeConfig,
	type WorkflowNode,
	type WorkflowEdge,
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
					roles: ["Solicitante"],
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
					roles: ["Solicitante"],
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

		it("should error when API node with onFailure='stop' has outgoing edges", () => {
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
			expect(
				errors.some(
					(e) =>
						e.nodeId === "api-1" &&
						e.message.includes("Detener Workflow") &&
						e.message.includes("conexiones salientes"),
				),
			).toBe(true);
		});
	});

	describe("Message node validation", () => {
		it("should error when Message node has no template", () => {
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
						e.nodeId === "message-1" &&
						e.message.includes("template de mensaje"),
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
					roles: ["Solicitante"],
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
					roles: ["Solicitante"],
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
					roles: ["Solicitante"],
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
					roles: ["Solicitante"],
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
