import { describe, it, expect } from "vitest";
import {
	serializeSelection,
	deserializeSelection,
	calculatePasteOffset,
	type CopiedSelection,
} from "./copy-paste";
import type { WorkflowNode, WorkflowEdge } from "./types";

describe("copy-paste", () => {
	describe("serializeSelection", () => {
		it("should return null for empty selection", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const result = serializeSelection([], [], nodes, edges);
			expect(result).toBeNull();
		});

		it("should filter out Start nodes from selection", () => {
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
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const result = serializeSelection(
				["start-1", "form-1"],
				[],
				nodes,
				edges,
			);
			expect(result).not.toBeNull();
			expect(result?.nodes).toHaveLength(1);
			expect(result?.nodes[0].id).toBe("form-1");
			expect(result?.nodes[0].type).toBe("Form");
		});

		it("should include only edges where both nodes are selected", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "node-2",
					type: "Decision",
					title: "Decision 1",
					description: "",
					roles: [],
					config: { condition: "true" },
					position: { x: 200, y: 0 },
					groupId: null,
				},
				{
					id: "node-3",
					type: "End",
					title: "End",
					description: "",
					roles: [],
					config: {},
					position: { x: 400, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{
					id: "edge-1",
					from: "node-1",
					to: "node-2",
					label: null,
				},
				{
					id: "edge-2",
					from: "node-2",
					to: "node-3",
					label: null,
				},
			];

			// Select only node-1 and node-2
			const result = serializeSelection(["node-1", "node-2"], [], nodes, edges);
			expect(result).not.toBeNull();
			expect(result?.nodes).toHaveLength(2);
			expect(result?.edges).toHaveLength(1);
			expect(result?.edges[0].id).toBe("edge-1");
		});

		it("should include explicitly selected edges if both nodes are selected", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "node-2",
					type: "Decision",
					title: "Decision 1",
					description: "",
					roles: [],
					config: { condition: "true" },
					position: { x: 200, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{
					id: "edge-1",
					from: "node-1",
					to: "node-2",
					label: null,
				},
			];

			const result = serializeSelection(
				["node-1", "node-2"],
				["edge-1"],
				nodes,
				edges,
			);
			expect(result).not.toBeNull();
			expect(result?.edges).toHaveLength(1);
			expect(result?.edges[0].id).toBe("edge-1");
		});

		it("should not include edges where one node is not selected", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "node-2",
					type: "Decision",
					title: "Decision 1",
					description: "",
					roles: [],
					config: { condition: "true" },
					position: { x: 200, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{
					id: "edge-1",
					from: "node-1",
					to: "node-2",
					label: null,
				},
			];

			// Select only node-1
			const result = serializeSelection(["node-1"], [], nodes, edges);
			expect(result).not.toBeNull();
			expect(result?.nodes).toHaveLength(1);
			expect(result?.edges).toHaveLength(0);
		});
	});

	describe("deserializeSelection", () => {
		it("should regenerate IDs for nodes and edges", () => {
			const copiedSelection: CopiedSelection = {
				nodes: [
					{
						id: "node-1",
						type: "Form",
						title: "Form 1",
						description: "",
						roles: [],
						config: {},
						position: { x: 0, y: 0 },
						groupId: null,
					},
				],
				edges: [],
			};

			const result = deserializeSelection(copiedSelection, []);
			expect(result.nodes).toHaveLength(1);
			expect(result.nodes[0].id).not.toBe("node-1");
			expect(result.nodes[0].id).toMatch(/^node-\d+-\d+$/);
		});

		it("should update edge references to new node IDs", () => {
			const copiedSelection: CopiedSelection = {
				nodes: [
					{
						id: "node-1",
						type: "Form",
						title: "Form 1",
						description: "",
						roles: [],
						config: {},
						position: { x: 0, y: 0 },
						groupId: null,
					},
					{
						id: "node-2",
						type: "Decision",
						title: "Decision 1",
						description: "",
						roles: [],
						config: { condition: "true" },
						position: { x: 200, y: 0 },
						groupId: null,
					},
				],
				edges: [
					{
						id: "edge-1",
						from: "node-1",
						to: "node-2",
						label: null,
					},
				],
			};

			const result = deserializeSelection(copiedSelection, []);
			expect(result.nodes).toHaveLength(2);
			expect(result.edges).toHaveLength(1);

			const newFromId = result.nodes[0].id;
			const newToId = result.nodes[1].id;
			expect(result.edges[0].from).toBe(newFromId);
			expect(result.edges[0].to).toBe(newToId);
			expect(result.edges[0].id).not.toBe("edge-1");
		});

		it("should apply offset to node positions", () => {
			const copiedSelection: CopiedSelection = {
				nodes: [
					{
						id: "node-1",
						type: "Form",
						title: "Form 1",
						description: "",
						roles: [],
						config: {},
						position: { x: 100, y: 200 },
						groupId: null,
					},
				],
				edges: [],
			};

			const result = deserializeSelection(copiedSelection, []);
			expect(result.nodes[0].position.x).toBe(150); // 100 + 50 offset
			expect(result.nodes[0].position.y).toBe(250); // 200 + 50 offset
		});

		it("should use custom offset if provided", () => {
			const copiedSelection: CopiedSelection = {
				nodes: [
					{
						id: "node-1",
						type: "Form",
						title: "Form 1",
						description: "",
						roles: [],
						config: {},
						position: { x: 100, y: 200 },
						groupId: null,
					},
				],
				edges: [],
			};

			const customOffset = { x: 100, y: 150 };
			const result = deserializeSelection(copiedSelection, [], customOffset);
			expect(result.nodes[0].position.x).toBe(200); // 100 + 100 offset
			expect(result.nodes[0].position.y).toBe(350); // 200 + 150 offset
		});

		it("should resolve API node checkpoint dependency", () => {
			const copiedSelection: CopiedSelection = {
				nodes: [
					{
						id: "api-1",
						type: "API",
						title: "API Call",
						description: "",
						roles: [],
						config: {
							failureHandling: {
								onFailure: "return-to-checkpoint",
								maxRetries: 0,
								retryCount: 0,
								cacheStrategy: "always-execute",
								timeout: 30000,
								checkpointId: "checkpoint-1", // Referenced checkpoint not in selection
							},
						},
						position: { x: 0, y: 0 },
						groupId: null,
					},
				],
				edges: [],
			};

			const result = deserializeSelection(copiedSelection, []);
			expect(result.nodes).toHaveLength(1);
			const failureHandling = result.nodes[0].config.failureHandling as any;
			expect(failureHandling.onFailure).toBe("stop");
			expect(failureHandling.checkpointId).toBeUndefined();
		});

		it("should preserve API node checkpoint if checkpoint is in selection", () => {
			const copiedSelection: CopiedSelection = {
				nodes: [
					{
						id: "checkpoint-1",
						type: "Checkpoint",
						title: "Checkpoint",
						description: "",
						roles: [],
						config: {},
						position: { x: 0, y: 0 },
						groupId: null,
					},
					{
						id: "api-1",
						type: "API",
						title: "API Call",
						description: "",
						roles: [],
						config: {
							failureHandling: {
								onFailure: "return-to-checkpoint",
								maxRetries: 0,
								retryCount: 0,
								cacheStrategy: "always-execute",
								timeout: 30000,
								checkpointId: "checkpoint-1",
							},
						},
						position: { x: 200, y: 0 },
						groupId: null,
					},
				],
				edges: [],
			};

			const result = deserializeSelection(copiedSelection, []);
			expect(result.nodes).toHaveLength(2);

			// Find the API node after ID regeneration
			const apiNode = result.nodes.find((n) => n.type === "API");
			const checkpointNode = result.nodes.find((n) => n.type === "Checkpoint");

			expect(apiNode).toBeDefined();
			expect(checkpointNode).toBeDefined();

			const failureHandling = apiNode?.config.failureHandling as any;
			expect(failureHandling.onFailure).toBe("return-to-checkpoint");
			// The checkpointId should be updated to the new checkpoint ID
			expect(failureHandling.checkpointId).toBe(checkpointNode?.id);
		});

		it("should disable allowRetry for Reject node if checkpoint not in selection", () => {
			const copiedSelection: CopiedSelection = {
				nodes: [
					{
						id: "reject-1",
						type: "Reject",
						title: "Reject",
						description: "",
						roles: [],
						config: {
							allowRetry: true,
							maxRetries: 1,
						},
						position: { x: 0, y: 0 },
						groupId: null,
					},
				],
				edges: [],
			};

			const result = deserializeSelection(copiedSelection, []);
			expect(result.nodes).toHaveLength(1);
			expect(result.nodes[0].config.allowRetry).toBe(false);
		});

		it("should preserve allowRetry for Reject node if checkpoint edge exists", () => {
			const copiedSelection: CopiedSelection = {
				nodes: [
					{
						id: "checkpoint-1",
						type: "Checkpoint",
						title: "Checkpoint",
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
						config: {
							allowRetry: true,
							maxRetries: 1,
						},
						position: { x: 200, y: 0 },
						groupId: null,
					},
				],
				edges: [
					{
						id: "edge-1",
						from: "reject-1",
						to: "checkpoint-1",
						label: "Reintento",
						color: "rgb(234, 179, 8)",
						thickness: 3,
					},
				],
			};

			const result = deserializeSelection(copiedSelection, []);
			expect(result.nodes).toHaveLength(2);
			const rejectNode = result.nodes.find((n) => n.type === "Reject");
			expect(rejectNode?.config.allowRetry).toBe(true);
			expect(result.edges).toHaveLength(1);
		});

		it("should filter out retry edges when allowRetry is disabled", () => {
			const copiedSelection: CopiedSelection = {
				nodes: [
					{
						id: "reject-1",
						type: "Reject",
						title: "Reject",
						description: "",
						roles: [],
						config: {
							allowRetry: true,
							maxRetries: 1,
						},
						position: { x: 0, y: 0 },
						groupId: null,
					},
				],
				edges: [
					{
						id: "edge-1",
						from: "reject-1",
						to: "external-checkpoint", // External checkpoint not in selection
						label: "Reintento",
						color: "rgb(234, 179, 8)",
						thickness: 3,
					},
				],
			};

			const result = deserializeSelection(copiedSelection, []);
			expect(result.nodes).toHaveLength(1);
			expect(result.nodes[0].config.allowRetry).toBe(false);
			// The retry edge should be filtered out
			expect(result.edges).toHaveLength(0);
		});
	});

	describe("token remapping on paste", () => {
		function makeNode(
			id: string,
			type: WorkflowNode["type"],
			title: string,
			config: Record<string, unknown> = {},
			position = { x: 0, y: 0 },
		): WorkflowNode {
			return {
				id,
				type,
				title,
				description: "",
				roles: [],
				config,
				position,
				groupId: null,
			};
		}

		it("remaps ${alias.prop} tokens in a pasted subgraph to the pasted node's new alias", () => {
			const form = makeNode("form-1", "Form", "Form");
			const message = makeNode("message-1", "Message", "Message", {
				body: "Hello ${form.name}",
			});
			const allNodes = [form, message];

			const selection = serializeSelection(
				["form-1", "message-1"],
				[],
				allNodes,
				[],
			);
			expect(selection).not.toBeNull();
			expect(selection?.sourceAliases).toEqual({
				"form-1": "form",
				"message-1": "message",
			});

			// The originals are still on the canvas when pasting (Ctrl+C does
			// not remove them), so the pasted clones collide on title and get
			// suffixed aliases.
			const result = deserializeSelection(
				selection as CopiedSelection,
				allNodes,
			);

			const pastedMessage = result.nodes.find((n) => n.type === "Message");
			const pastedForm = result.nodes.find((n) => n.type === "Form");
			expect(pastedForm).toBeDefined();
			expect(pastedMessage).toBeDefined();
			expect(pastedMessage?.config.body).toBe("Hello ${form2.name}");
			expect(result.tokensRemapped).toBe(true);
		});

		it("leaves tokens referencing a node outside the selection untouched", () => {
			const form = makeNode("form-1", "Form", "Form");
			const otherMsg = makeNode("other-1", "Message", "Other Msg", {
				body: "${form.x}",
			});
			const allNodes = [form, otherMsg];

			// Only "other-1" is copied — "form-1" stays external.
			const selection = serializeSelection(["other-1"], [], allNodes, []);
			expect(selection).not.toBeNull();

			const result = deserializeSelection(
				selection as CopiedSelection,
				allNodes,
			);

			expect(result.nodes).toHaveLength(1);
			expect(result.nodes[0].config.body).toBe("${form.x}");
			expect(result.tokensRemapped).toBe(false);
		});

		it("remaps tokens inside GeneratePDF fieldMappings referencing a node in the selection", () => {
			const form = makeNode("form-1", "Form", "Form");
			const generatePdf = makeNode("pdf-1", "GeneratePDF", "Generate PDF", {
				pdfTemplateId: "template-1",
				fieldMappings: [{ fieldName: "name", value: "${form.name}" }],
			});
			const allNodes = [form, generatePdf];

			const selection = serializeSelection(
				["form-1", "pdf-1"],
				[],
				allNodes,
				[],
			);
			expect(selection).not.toBeNull();

			const result = deserializeSelection(
				selection as CopiedSelection,
				allNodes,
			);

			const pastedPdf = result.nodes.find((n) => n.type === "GeneratePDF");
			const pastedForm = result.nodes.find((n) => n.type === "Form");
			const fieldMappings = pastedPdf?.config.fieldMappings as Array<{
				fieldName: string;
				value: string;
			}>;
			expect(fieldMappings[0].value).toBe("${form2.name}");
			expect(pastedForm).toBeDefined();
			expect(result.tokensRemapped).toBe(true);
		});

		it("remaps colliding aliases simultaneously without corrupting a swap (a<->b)", () => {
			// Two nodes with the same title get suffixed aliases based on id
			// order ("aa" < "bb"): aa -> "form", bb -> "form2".
			const nodeA = makeNode("aa", "Form", "Form");
			const nodeB = makeNode("bb", "Form", "Form");
			const consumer = makeNode("consumer-1", "Message", "Consumer", {
				url: "${form.x} ${form2.y}",
			});

			// Selection order is [B, A, consumer] on purpose: ID regeneration
			// assigns new IDs by array position, not by id-sort order, so B's
			// clone gets the lexicographically-smaller new id and therefore
			// wins the un-suffixed alias "form" — swapping what "form" and
			// "form2" point to relative to the originals.
			const allNodes = [nodeB, nodeA, consumer];
			const selection = serializeSelection(
				["bb", "aa", "consumer-1"],
				[],
				allNodes,
				[],
			);
			expect(selection).not.toBeNull();
			expect(selection?.nodes.map((n) => n.id)).toEqual([
				"bb",
				"aa",
				"consumer-1",
			]);

			const result = deserializeSelection(
				selection as CopiedSelection,
				[], // paste into an empty canvas so only the pasted clones compete for aliases
			);

			const pastedConsumer = result.nodes.find((n) => n.type === "Message");
			expect(pastedConsumer?.config.url).toBe("${form2.x} ${form.y}");
			expect(result.tokensRemapped).toBe(true);
		});

		it("remaps legacy ${node-<id>.prop} tokens to the pasted node's alias", () => {
			const source = makeNode("node-100", "Form", "Legacy Source");
			const consumer = makeNode("node-200", "Message", "Consumer", {
				note: "${node-100.value}",
			});
			const allNodes = [source, consumer];

			const selection = serializeSelection(
				["node-100", "node-200"],
				[],
				allNodes,
				[],
			);
			expect(selection).not.toBeNull();

			const result = deserializeSelection(selection as CopiedSelection, []);

			const pastedSource = result.nodes.find((n) => n.type === "Form");
			const pastedConsumer = result.nodes.find((n) => n.type === "Message");
			expect(pastedConsumer?.config.note).toBe("${legacySource.value}");
			expect(pastedSource).toBeDefined();
			expect(result.tokensRemapped).toBe(true);
		});

		it("leaves ${secret.*} tokens untouched even when other tokens in the same field are remapped", () => {
			const form = makeNode("form-1", "Form", "Form");
			const message = makeNode("message-1", "Message", "Message", {
				body: "${form.name} / ${secret.API_KEY}",
			});
			const allNodes = [form, message];

			const selection = serializeSelection(
				["form-1", "message-1"],
				[],
				allNodes,
				[],
			);
			expect(selection).not.toBeNull();

			const result = deserializeSelection(
				selection as CopiedSelection,
				allNodes,
			);

			const pastedMessage = result.nodes.find((n) => n.type === "Message");
			expect(pastedMessage?.config.body).toBe(
				"${form2.name} / ${secret.API_KEY}",
			);
		});

		it("does not mutate the original copied node's config (deep clone on paste)", () => {
			const form = makeNode("form-1", "Form", "Form");
			const message = makeNode("message-1", "Message", "Message", {
				body: "${form.name}",
			});
			const allNodes = [form, message];

			const selection = serializeSelection(
				["form-1", "message-1"],
				[],
				allNodes,
				[],
			);
			expect(selection).not.toBeNull();

			deserializeSelection(selection as CopiedSelection, allNodes);

			// The original nodes on the canvas must be untouched.
			expect(message.config.body).toBe("${form.name}");
		});
	});

	describe("calculatePasteOffset", () => {
		it("should return default offset for empty copied nodes", () => {
			const offset = calculatePasteOffset([], []);
			expect(offset.x).toBe(50);
			expect(offset.y).toBe(50);
		});

		it("should return default offset when no overlap", () => {
			const existingNodes: WorkflowNode[] = [
				{
					id: "node-1",
					type: "Form",
					title: "Form",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];
			const copiedNodes: WorkflowNode[] = [
				{
					id: "node-2",
					type: "Decision",
					title: "Decision",
					description: "",
					roles: [],
					config: {},
					position: { x: 500, y: 500 },
					groupId: null,
				},
			];

			const offset = calculatePasteOffset(existingNodes, copiedNodes);
			expect(offset.x).toBe(50);
			expect(offset.y).toBe(50);
		});

		it("should return larger offset when overlap detected", () => {
			const existingNodes: WorkflowNode[] = [
				{
					id: "node-1",
					type: "Form",
					title: "Form",
					description: "",
					roles: [],
					config: {},
					position: { x: 60, y: 60 }, // Would overlap with default offset
					groupId: null,
				},
			];
			const copiedNodes: WorkflowNode[] = [
				{
					id: "node-2",
					type: "Decision",
					title: "Decision",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];

			const offset = calculatePasteOffset(existingNodes, copiedNodes);
			expect(offset.x).toBeGreaterThan(50);
			expect(offset.y).toBeGreaterThan(50);
		});
	});
});
