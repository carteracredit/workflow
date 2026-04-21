import { describe, it, expect } from "vitest";
import {
	migrateWorkflowTokens,
	renameAliasInTokens,
	findTokenOccurrences,
	findOrphanedTokens,
} from "./migrate-tokens";
import type { WorkflowNode, WorkflowEdge } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(
	id: string,
	title: string,
	config: Record<string, unknown> = {},
): WorkflowNode {
	return {
		id,
		type: "API",
		title,
		config,
		roles: [],
		position: { x: 0, y: 0 },
	} as unknown as WorkflowNode;
}

const NO_EDGES: WorkflowEdge[] = [];

// ---------------------------------------------------------------------------
// migrateWorkflowTokens
// ---------------------------------------------------------------------------

describe("migrateWorkflowTokens", () => {
	it("rewrites legacy node-<id> tokens to camelCase alias", () => {
		const sourceNode = makeNode("node-1234", "My Source", {});
		const consumerNode = makeNode("api", "Consumer", {
			url: "${node-1234.results[0].url}",
		});
		const nodes = [sourceNode, consumerNode];

		const result = migrateWorkflowTokens(nodes, NO_EDGES);

		expect(result.changed).toBe(true);
		expect(result.migratedNodeIds).toContain("api");
		expect((consumerNode.config as Record<string, unknown>).url).toBe(
			"${mySource.results[0].url}",
		);
	});

	it("is idempotent – re-running produces no changes", () => {
		const sourceNode = makeNode("node-1234", "My Source", {});
		const consumerNode = makeNode("api", "Consumer", {
			url: "${mySource.results[0].url}",
		});
		const nodes = [sourceNode, consumerNode];

		const result = migrateWorkflowTokens(nodes, NO_EDGES);

		expect(result.changed).toBe(false);
		expect(result.migratedNodeIds).toHaveLength(0);
	});

	it("leaves secret.* tokens unchanged", () => {
		const node = makeNode("api", "Api", {
			url: "${secret.MY_KEY}",
		});

		const result = migrateWorkflowTokens([node], NO_EDGES);

		expect(result.changed).toBe(false);
		expect((node.config as Record<string, unknown>).url).toBe(
			"${secret.MY_KEY}",
		);
	});

	it("leaves unknown legacy IDs unchanged (orphan)", () => {
		const node = makeNode("api", "Api", {
			url: "${node-9999.prop}",
		});

		const result = migrateWorkflowTokens([node], NO_EDGES);

		// No known node maps to node-9999 → token left as-is
		expect(result.changed).toBe(false);
		expect((node.config as Record<string, unknown>).url).toBe(
			"${node-9999.prop}",
		);
	});

	it("rewrites tokens inside condition field (Decision node)", () => {
		const srcNode = makeNode("node-55", "Loan Amount", {});
		const decisionNode = makeNode("dec", "Check", {
			condition: "${node-55.amount} > 1000",
		});

		migrateWorkflowTokens([srcNode, decisionNode], NO_EDGES);

		expect((decisionNode.config as Record<string, unknown>).condition).toBe(
			"${loanAmount.amount} > 1000",
		);
	});

	it("rewrites tokens inside mergeVars array values", () => {
		const srcNode = makeNode("node-77", "Client Info", {});
		const msgNode = makeNode("msg", "Email", {
			mergeVars: [{ key: "NAME", value: "${node-77.name}" }],
		});

		migrateWorkflowTokens([srcNode, msgNode], NO_EDGES);

		const mergeVars = (msgNode.config as Record<string, unknown>)
			.mergeVars as Array<Record<string, unknown>>;
		expect(mergeVars[0].value).toBe("${clientInfo.name}");
	});

	it("rewrites multiple tokens in the same string", () => {
		const n1 = makeNode("node-1", "First Node", {});
		const n2 = makeNode("node-2", "Second Node", {});
		const consumer = makeNode("c", "Consumer", {
			url: "${node-1.id}/${node-2.id}",
		});

		migrateWorkflowTokens([n1, n2, consumer], NO_EDGES);

		expect((consumer.config as Record<string, unknown>).url).toBe(
			"${firstNode.id}/${secondNode.id}",
		);
	});
});

// ---------------------------------------------------------------------------
// renameAliasInTokens
// ---------------------------------------------------------------------------

describe("renameAliasInTokens", () => {
	it("renames all occurrences of fromAlias to toAlias", () => {
		const node = makeNode("n1", "N1", {
			url: "${oldAlias.prop}",
			condition: "${oldAlias.value} > 0",
		});

		const count = renameAliasInTokens([node], "oldAlias", "newAlias");

		expect(count).toBe(2);
		expect((node.config as Record<string, unknown>).url).toBe(
			"${newAlias.prop}",
		);
		expect((node.config as Record<string, unknown>).condition).toBe(
			"${newAlias.value} > 0",
		);
	});

	it("does not rename tokens that use a different alias", () => {
		const node = makeNode("n1", "N1", {
			url: "${otherAlias.prop}",
		});

		const count = renameAliasInTokens([node], "oldAlias", "newAlias");

		expect(count).toBe(0);
		expect((node.config as Record<string, unknown>).url).toBe(
			"${otherAlias.prop}",
		);
	});

	it("returns 0 when nodes have no tokens at all", () => {
		const node = makeNode("n1", "N1", { url: "https://static.url" });
		expect(renameAliasInTokens([node], "alias", "newAlias")).toBe(0);
	});

	it("renames tokens inside nested array objects", () => {
		const node = makeNode("n1", "N1", {
			mergeVars: [{ key: "K", value: "${myAlias.field}" }],
		});

		renameAliasInTokens([node], "myAlias", "renamedAlias");

		const mergeVars = (node.config as Record<string, unknown>)
			.mergeVars as Array<Record<string, unknown>>;
		expect(mergeVars[0].value).toBe("${renamedAlias.field}");
	});
});

// ---------------------------------------------------------------------------
// findTokenOccurrences
// ---------------------------------------------------------------------------

describe("findTokenOccurrences", () => {
	it("finds nodes that reference a given alias", () => {
		const n1 = makeNode("n1", "Source", {});
		const n2 = makeNode("n2", "Consumer A", { url: "${source.id}" });
		const n3 = makeNode("n3", "Consumer B", {
			condition: "${source.value} > 0",
		});

		const occs = findTokenOccurrences([n1, n2, n3], "source");

		expect(occs).toHaveLength(2);
		expect(occs.map((o) => o.nodeId)).toContain("n2");
		expect(occs.map((o) => o.nodeId)).toContain("n3");
	});

	it("returns empty array when alias is not referenced", () => {
		const node = makeNode("n1", "N1", { url: "${other.prop}" });
		expect(findTokenOccurrences([node], "missing")).toHaveLength(0);
	});

	it("includes nodeTitle in occurrences", () => {
		const node = makeNode("n1", "My Consumer", { url: "${src.prop}" });
		const [occ] = findTokenOccurrences([node], "src");
		expect(occ.nodeTitle).toBe("My Consumer");
	});

	it("truncates long context snippets to 80 chars + ellipsis", () => {
		const longUrl = "${alias.field}" + "x".repeat(100);
		const node = makeNode("n1", "N1", { url: longUrl });
		const [occ] = findTokenOccurrences([node], "alias");
		expect(occ.context.length).toBeLessThanOrEqual(82); // 80 + '…'
	});
});

// ---------------------------------------------------------------------------
// findOrphanedTokens
// ---------------------------------------------------------------------------

describe("findOrphanedTokens", () => {
	it("returns tokens whose alias is not in the alias map", () => {
		const knownNode = makeNode("n1", "Known", {});
		const aliasMap = new Map([["n1", "known"]]);

		const consumer = makeNode("n2", "Consumer", {
			url: "${unknown.prop}",
		});

		const orphans = findOrphanedTokens(consumer, aliasMap);

		expect(orphans).toContain("${unknown.prop}");
	});

	it("does not flag tokens that resolve to known aliases", () => {
		const aliasMap = new Map([["n1", "mySource"]]);
		const consumer = makeNode("n2", "Consumer", {
			url: "${mySource.id}",
		});

		const orphans = findOrphanedTokens(consumer, aliasMap);

		expect(orphans).toHaveLength(0);
	});

	it("ignores secret.* tokens", () => {
		const aliasMap = new Map<string, string>();
		const node = makeNode("n1", "N1", { url: "${secret.API_KEY}" });

		expect(findOrphanedTokens(node, aliasMap)).toHaveLength(0);
	});

	it("detects orphans inside nested config objects", () => {
		const aliasMap = new Map<string, string>();
		const node = makeNode("n1", "N1", {
			mergeVars: [{ key: "K", value: "${ghost.field}" }],
		});

		const orphans = findOrphanedTokens(node, aliasMap);

		expect(orphans).toContain("${ghost.field}");
	});
});
