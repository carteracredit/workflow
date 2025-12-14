import { describe, it, expect } from "vitest";
import {
	isRetryEdge,
	getMaxOutgoingConnections,
	getMaxIncomingConnections,
	canNodeHaveOutgoingConnections,
	canCreateConnection,
	type WorkflowNode,
	type WorkflowEdge,
} from "./connection-rules";

describe("connection-rules", () => {
	describe("isRetryEdge", () => {
		it("should return true for retry edge", () => {
			const edge: WorkflowEdge = {
				id: "edge-1",
				from: "node-1",
				to: "checkpoint-1",
				label: "Reintento",
			};
			expect(isRetryEdge(edge)).toBe(true);
		});

		it("should return false for normal edge", () => {
			const edge: WorkflowEdge = {
				id: "edge-1",
				from: "node-1",
				to: "node-2",
				label: null,
			};
			expect(isRetryEdge(edge)).toBe(false);
		});

		it("should return false for edge with different label", () => {
			const edge: WorkflowEdge = {
				id: "edge-1",
				from: "node-1",
				to: "node-2",
				label: "Yes",
			};
			expect(isRetryEdge(edge)).toBe(false);
		});
	});

	describe("getMaxOutgoingConnections", () => {
		it("should return 2 for Decision nodes", () => {
			expect(getMaxOutgoingConnections("Decision")).toBe(2);
		});

		it("should return 2 for Challenge nodes", () => {
			expect(getMaxOutgoingConnections("Challenge")).toBe(2);
		});

		it("should return 1 for Join nodes", () => {
			expect(getMaxOutgoingConnections("Join")).toBe(1);
		});

		it("should return 1 for normal nodes", () => {
			expect(getMaxOutgoingConnections("Form")).toBe(1);
			expect(getMaxOutgoingConnections("API")).toBe(1);
			expect(getMaxOutgoingConnections("Transform")).toBe(1);
			expect(getMaxOutgoingConnections("Message")).toBe(1);
			expect(getMaxOutgoingConnections("Checkpoint")).toBe(1);
		});
	});

	describe("getMaxIncomingConnections", () => {
		it("should return 0 for Start nodes", () => {
			expect(getMaxIncomingConnections("Start")).toBe(0);
		});

		it("should return null for Join nodes", () => {
			expect(getMaxIncomingConnections("Join")).toBeNull();
		});

		it("should return 1 for normal nodes", () => {
			expect(getMaxIncomingConnections("Form")).toBe(1);
			expect(getMaxIncomingConnections("Decision")).toBe(1);
			expect(getMaxIncomingConnections("Checkpoint")).toBe(1);
		});
	});

	describe("canNodeHaveOutgoingConnections", () => {
		it("should return false for Reject without allowRetry", () => {
			const node: WorkflowNode = {
				id: "reject-1",
				type: "Reject",
				title: "Reject",
				description: "",
				roles: [],
				config: { allowRetry: false },
				position: { x: 0, y: 0 },
				groupId: null,
			};
			expect(canNodeHaveOutgoingConnections(node)).toBe(false);
		});

		it("should return true for Reject with allowRetry", () => {
			const node: WorkflowNode = {
				id: "reject-1",
				type: "Reject",
				title: "Reject",
				description: "",
				roles: [],
				config: { allowRetry: true },
				position: { x: 0, y: 0 },
				groupId: null,
			};
			expect(canNodeHaveOutgoingConnections(node)).toBe(true);
		});

		it("should return false for API with onFailure='stop'", () => {
			const node: WorkflowNode = {
				id: "api-1",
				type: "API",
				title: "API",
				description: "",
				roles: [],
				config: {
					url: "https://api.example.com",
					failureHandling: { onFailure: "stop", maxRetries: 0, retryCount: 0, cacheStrategy: "always-execute", timeout: 5000 },
				},
				position: { x: 0, y: 0 },
				groupId: null,
			};
			expect(canNodeHaveOutgoingConnections(node)).toBe(false);
		});

		it("should return true for API with other onFailure strategies", () => {
			const node: WorkflowNode = {
				id: "api-1",
				type: "API",
				title: "API",
				description: "",
				roles: [],
				config: {
					url: "https://api.example.com",
					failureHandling: { onFailure: "continue", maxRetries: 0, retryCount: 0, cacheStrategy: "always-execute", timeout: 5000 },
				},
				position: { x: 0, y: 0 },
				groupId: null,
			};
			expect(canNodeHaveOutgoingConnections(node)).toBe(true);
		});

		it("should return true for normal nodes", () => {
			const node: WorkflowNode = {
				id: "form-1",
				type: "Form",
				title: "Form",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 0 },
				groupId: null,
			};
			expect(canNodeHaveOutgoingConnections(node)).toBe(true);
		});
	});

	describe("canCreateConnection", () => {
		it("should allow connection from normal node to normal node", () => {
			const sourceNode: WorkflowNode = {
				id: "form-1",
				type: "Form",
				title: "Form 1",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 0 },
				groupId: null,
			};
			const targetNode: WorkflowNode = {
				id: "form-2",
				type: "Form",
				title: "Form 2",
				description: "",
				roles: [],
				config: {},
				position: { x: 100, y: 0 },
				groupId: null,
			};
			const edges: WorkflowEdge[] = [];

			const result = canCreateConnection(sourceNode, targetNode, edges);
			expect(result.allowed).toBe(true);
		});

		it("should reject connection from terminal Reject node", () => {
			const sourceNode: WorkflowNode = {
				id: "reject-1",
				type: "Reject",
				title: "Reject",
				description: "",
				roles: [],
				config: { allowRetry: false },
				position: { x: 0, y: 0 },
				groupId: null,
			};
			const targetNode: WorkflowNode = {
				id: "form-1",
				type: "Form",
				title: "Form",
				description: "",
				roles: [],
				config: {},
				position: { x: 100, y: 0 },
				groupId: null,
			};
			const edges: WorkflowEdge[] = [];

			const result = canCreateConnection(sourceNode, targetNode, edges);
			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("no puede tener conexiones de salida");
		});

		it("should reject connection when source has max outgoing connections", () => {
			const sourceNode: WorkflowNode = {
				id: "form-1",
				type: "Form",
				title: "Form 1",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 0 },
				groupId: null,
			};
			const targetNode1: WorkflowNode = {
				id: "form-2",
				type: "Form",
				title: "Form 2",
				description: "",
				roles: [],
				config: {},
				position: { x: 100, y: 0 },
				groupId: null,
			};
			const targetNode2: WorkflowNode = {
				id: "form-3",
				type: "Form",
				title: "Form 3",
				description: "",
				roles: [],
				config: {},
				position: { x: 100, y: 100 },
				groupId: null,
			};
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "form-1", to: "form-2", label: null },
			];

			const result = canCreateConnection(sourceNode, targetNode2, edges);
			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("máximo de conexiones de salida");
		});

		it("should reject connection when target has max incoming connections", () => {
			const sourceNode1: WorkflowNode = {
				id: "form-1",
				type: "Form",
				title: "Form 1",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 0 },
				groupId: null,
			};
			const sourceNode2: WorkflowNode = {
				id: "form-2",
				type: "Form",
				title: "Form 2",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 100 },
				groupId: null,
			};
			const targetNode: WorkflowNode = {
				id: "form-3",
				type: "Form",
				title: "Form 3",
				description: "",
				roles: [],
				config: {},
				position: { x: 100, y: 0 },
				groupId: null,
			};
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "form-1", to: "form-3", label: null },
			];

			const result = canCreateConnection(sourceNode2, targetNode, edges);
			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("máximo de conexiones de entrada");
		});

		it("should reject connection to Start node", () => {
			const sourceNode: WorkflowNode = {
				id: "form-1",
				type: "Form",
				title: "Form 1",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 0 },
				groupId: null,
			};
			const targetNode: WorkflowNode = {
				id: "start-1",
				type: "Start",
				title: "Start",
				description: "",
				roles: [],
				config: {},
				position: { x: 100, y: 0 },
				groupId: null,
			};
			const edges: WorkflowEdge[] = [];

			const result = canCreateConnection(sourceNode, targetNode, edges);
			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("inicio");
		});

		it("should allow multiple connections to Join node", () => {
			const sourceNode1: WorkflowNode = {
				id: "form-1",
				type: "Form",
				title: "Form 1",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 0 },
				groupId: null,
			};
			const sourceNode2: WorkflowNode = {
				id: "form-2",
				type: "Form",
				title: "Form 2",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 100 },
				groupId: null,
			};
			const targetNode: WorkflowNode = {
				id: "join-1",
				type: "Join",
				title: "Join",
				description: "",
				roles: [],
				config: {},
				position: { x: 100, y: 50 },
				groupId: null,
			};
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "form-1", to: "join-1", label: null },
			];

			const result = canCreateConnection(sourceNode2, targetNode, edges);
			expect(result.allowed).toBe(true);
		});

		it("should reject duplicate port connection for Decision node", () => {
			const sourceNode: WorkflowNode = {
				id: "decision-1",
				type: "Decision",
				title: "Decision",
				description: "",
				roles: [],
				config: { condition: "test" },
				position: { x: 0, y: 0 },
				groupId: null,
			};
			const targetNode: WorkflowNode = {
				id: "form-1",
				type: "Form",
				title: "Form",
				description: "",
				roles: [],
				config: {},
				position: { x: 100, y: 0 },
				groupId: null,
			};
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "decision-1", to: "form-1", label: null, fromPort: "top" },
			];

			const result = canCreateConnection(sourceNode, targetNode, edges, "top");
			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("ya tiene una conexión");
		});

		it("should allow connection from Decision to different port", () => {
			const sourceNode: WorkflowNode = {
				id: "decision-1",
				type: "Decision",
				title: "Decision",
				description: "",
				roles: [],
				config: { condition: "test" },
				position: { x: 0, y: 0 },
				groupId: null,
			};
			const targetNode1: WorkflowNode = {
				id: "form-1",
				type: "Form",
				title: "Form 1",
				description: "",
				roles: [],
				config: {},
				position: { x: 100, y: 0 },
				groupId: null,
			};
			const targetNode2: WorkflowNode = {
				id: "form-2",
				type: "Form",
				title: "Form 2",
				description: "",
				roles: [],
				config: {},
				position: { x: 100, y: 100 },
				groupId: null,
			};
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "decision-1", to: "form-1", label: null, fromPort: "top" },
			];

			const result = canCreateConnection(sourceNode, targetNode2, edges, "bottom");
			expect(result.allowed).toBe(true);
		});

		it("should exclude retry edges when counting incoming connections to Checkpoint", () => {
			const sourceNode: WorkflowNode = {
				id: "form-1",
				type: "Form",
				title: "Form 1",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 0 },
				groupId: null,
			};
			const targetNode: WorkflowNode = {
				id: "checkpoint-1",
				type: "Checkpoint",
				title: "Checkpoint",
				description: "",
				roles: [],
				config: {},
				position: { x: 100, y: 0 },
				groupId: null,
			};
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "reject-1", to: "checkpoint-1", label: "Reintento" },
			];

			const result = canCreateConnection(sourceNode, targetNode, edges);
			expect(result.allowed).toBe(true);
		});
	});
});
