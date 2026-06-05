import { describe, it, expect } from "vitest";
import { remapDefinitionIds } from "./remap-ids";
import type { WorkflowNode, WorkflowEdge, Flag } from "./types";

function makeNode(
	id: string,
	type: string,
	config: Record<string, unknown> = {},
): WorkflowNode {
	return {
		id,
		type: type as WorkflowNode["type"],
		position: { x: 0, y: 0 },
		title: `Node ${id}`,
		description: "",
		roles: [],
		groupId: null,
		config: { title: `Node ${id}`, ...config },
	} as WorkflowNode;
}

function makeEdge(id: string, from: string, to: string): WorkflowEdge {
	return { id, from, to, label: "" };
}

function makeFlag(
	id: string,
	options: Array<{ id: string; label: string }>,
): Flag {
	return {
		id,
		name: `Flag ${id}`,
		options: options.map((o, i) => ({
			...o,
			color: "#000",
			sort_order: i,
		})),
	};
}

describe("remapDefinitionIds", () => {
	it("regenerates node IDs and remaps edges from/to", () => {
		const nodes = [makeNode("n1", "Form"), makeNode("n2", "API")];
		const edges = [makeEdge("e1", "n1", "n2")];

		const result = remapDefinitionIds(nodes, edges, []);

		expect(result.nodes[0].id).not.toBe("n1");
		expect(result.nodes[1].id).not.toBe("n2");
		expect(result.edges[0].from).toBe(result.nodes[0].id);
		expect(result.edges[0].to).toBe(result.nodes[1].id);
		expect(result.nodeIdMap.get("n1")).toBe(result.nodes[0].id);
		expect(result.nodeIdMap.get("n2")).toBe(result.nodes[1].id);
	});

	it("regenerates flag and option IDs", () => {
		const flags = [
			makeFlag("flag-old", [
				{ id: "opt-a", label: "A" },
				{ id: "opt-b", label: "B" },
			]),
		];

		const result = remapDefinitionIds([], [], flags);

		expect(result.flags[0].id).not.toBe("flag-old");
		expect(result.flags[0].options[0].id).not.toBe("opt-a");
		expect(result.flags[0].options[1].id).not.toBe("opt-b");
		expect(result.flagIdMap.get("flag-old")).toBe(result.flags[0].id);
		expect(result.optionIdMap.get("opt-a")).toBe(result.flags[0].options[0].id);
	});

	it("remaps FlagChange node references to new flag/option IDs", () => {
		const flags = [makeFlag("flag-1", [{ id: "opt-1", label: "Active" }])];
		const nodes = [
			makeNode("n1", "FlagChange", {
				flagChanges: [{ flagId: "flag-1", optionId: "opt-1" }],
			}),
		];

		const result = remapDefinitionIds(nodes, [], flags);
		const fc = result.nodes[0].config.flagChanges as Array<{
			flagId: string;
			optionId: string;
		}>;

		expect(fc[0].flagId).toBe(result.flagIdMap.get("flag-1"));
		expect(fc[0].optionId).toBe(result.optionIdMap.get("opt-1"));
	});

	it("remaps checkpoint references in API failure handling", () => {
		const nodes = [
			makeNode("checkpoint-1", "Form"),
			makeNode("api-1", "API", {
				failureHandling: {
					onFailure: "return-to-checkpoint",
					checkpointId: "checkpoint-1",
				},
			}),
		];

		const result = remapDefinitionIds(nodes, [], []);
		const fh = result.nodes[1].config.failureHandling as {
			checkpointId: string;
		};

		expect(fh.checkpointId).toBe(result.nodeIdMap.get("checkpoint-1"));
	});

	it("rewrites tokens in config strings", () => {
		const nodes = [
			makeNode("n1", "Form"),
			makeNode("n2", "API", {
				url: "https://api.example.com/${n1.output}",
				body: '{"value": "${n1.name}"}',
			}),
		];

		const result = remapDefinitionIds(nodes, [], []);
		const newN1Id = result.nodeIdMap.get("n1")!;

		expect(result.nodes[1].config.url).toBe(
			`https://api.example.com/\${${newN1Id}.output}`,
		);
		expect(result.nodes[1].config.body).toBe(
			`{"value": "\${${newN1Id}.name}"}`,
		);
	});

	it("preserves secret tokens unchanged", () => {
		const nodes = [
			makeNode("n1", "API", {
				url: "${secret.apiKey}",
			}),
		];

		const result = remapDefinitionIds(nodes, [], []);
		expect(result.nodes[0].config.url).toBe("${secret.apiKey}");
	});

	it("does not mutate the original arrays", () => {
		const origNode = makeNode("n1", "Form");
		const origEdge = makeEdge("e1", "n1", "n1");
		const origFlag = makeFlag("f1", [{ id: "o1", label: "X" }]);

		const nodes = [origNode];
		const edges = [origEdge];
		const flags = [origFlag];

		remapDefinitionIds(nodes, edges, flags);

		expect(origNode.id).toBe("n1");
		expect(origEdge.id).toBe("e1");
		expect(origFlag.id).toBe("f1");
	});

	it("skips node ID regeneration when disabled", () => {
		const nodes = [makeNode("n1", "Form")];
		const edges = [makeEdge("e1", "n1", "n1")];

		const result = remapDefinitionIds(nodes, edges, [], {
			regenerateNodeIds: false,
		});

		expect(result.nodes[0].id).toBe("n1");
		expect(result.edges[0].id).toBe("e1");
		expect(result.nodeIdMap.size).toBe(0);
	});

	it("skips flag ID regeneration when disabled", () => {
		const flags = [makeFlag("f1", [{ id: "o1", label: "X" }])];

		const result = remapDefinitionIds([], [], flags, {
			regenerateFlagIds: false,
		});

		expect(result.flags[0].id).toBe("f1");
		expect(result.flagIdMap.size).toBe(0);
	});

	it("handles deeply nested token references", () => {
		const nodes = [
			makeNode("n1", "Form"),
			makeNode("n2", "Message", {
				mergeVars: [
					{ key: "name", value: "${n1.firstName}" },
					{ key: "email", value: "${n1.email}" },
				],
				nested: {
					deep: { value: "ref: ${n1.data}" },
				},
			}),
		];

		const result = remapDefinitionIds(nodes, [], []);
		const newN1Id = result.nodeIdMap.get("n1")!;
		const mergeVars = result.nodes[1].config.mergeVars as Array<{
			value: string;
		}>;

		expect(mergeVars[0].value).toBe(`\${${newN1Id}.firstName}`);
		expect(mergeVars[1].value).toBe(`\${${newN1Id}.email}`);

		const nested = result.nodes[1].config.nested as {
			deep: { value: string };
		};
		expect(nested.deep.value).toBe(`ref: \${${newN1Id}.data}`);
	});
});
