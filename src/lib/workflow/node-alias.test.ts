import { describe, it, expect } from "vitest";
import type { WorkflowNode } from "./types";
import {
	titleToCamelCase,
	isReservedAlias,
	buildAliasMap,
	nodeAlias,
	aliasToNodeId,
	isLegacyNodeId,
} from "./node-alias";

const makeNode = (
	id: string,
	title: string,
	type: WorkflowNode["type"] = "Transform",
): WorkflowNode => ({
	id,
	type,
	title,
	description: "",
	roles: [],
	config: {},
	position: { x: 0, y: 0 },
	groupId: null,
});

// ─── titleToCamelCase ─────────────────────────────────────────────────────────

describe("titleToCamelCase", () => {
	it("converts simple titles", () => {
		expect(titleToCamelCase("Coapplicant Form")).toBe("coapplicantForm");
	});

	it("handles single word", () => {
		expect(titleToCamelCase("Transform")).toBe("transform");
	});

	it("strips accents", () => {
		expect(titleToCamelCase("Formulario de aprobación")).toBe(
			"formularioDeAprobacion",
		);
	});

	it("strips ñ/Ñ", () => {
		expect(titleToCamelCase("Año nuevo")).toBe("anoNuevo");
	});

	it("handles numbers in middle", () => {
		expect(titleToCamelCase("Form 2")).toBe("form2");
	});

	it("prefixes 'node' when starts with digit", () => {
		expect(titleToCamelCase("1st step")).toBe("node1stStep");
	});

	it("returns 'node' for empty string", () => {
		expect(titleToCamelCase("")).toBe("node");
	});

	it("returns 'node' for whitespace-only string", () => {
		expect(titleToCamelCase("   ")).toBe("node");
	});

	it("returns 'node' for all-symbol string", () => {
		expect(titleToCamelCase("@#$%")).toBe("node");
	});

	it("strips quotes", () => {
		expect(titleToCamelCase("User's form")).toBe("usersForm");
	});

	it("handles multiple consecutive separators", () => {
		expect(titleToCamelCase("API -- Call 1")).toBe("apiCall1");
	});

	it("uppercases acronyms correctly (first word lowercased)", () => {
		expect(titleToCamelCase("API Call")).toBe("apiCall");
	});
});

// ─── isReservedAlias ──────────────────────────────────────────────────────────

describe("isReservedAlias", () => {
	it("flags reserved runtime names", () => {
		expect(isReservedAlias("env")).toBe(true);
		expect(isReservedAlias("step")).toBe(true);
		expect(isReservedAlias("event")).toBe(true);
		expect(isReservedAlias("secret")).toBe(true);
		expect(isReservedAlias("ctx")).toBe(true);
	});

	it("does not flag normal names", () => {
		expect(isReservedAlias("myNode")).toBe(false);
		expect(isReservedAlias("coapplicantForm")).toBe(false);
	});
});

// ─── buildAliasMap ────────────────────────────────────────────────────────────

describe("buildAliasMap", () => {
	it("assigns unique aliases to nodes with different titles", () => {
		const nodes = [
			makeNode("node-1", "Coapplicant Form"),
			makeNode("node-2", "Credit Check"),
		];
		const map = buildAliasMap(nodes);
		expect(map.get("node-1")).toBe("coapplicantForm");
		expect(map.get("node-2")).toBe("creditCheck");
	});

	it("resolves collisions with numeric suffix", () => {
		const nodes = [makeNode("node-1", "Form A"), makeNode("node-2", "Form a")];
		const map = buildAliasMap(nodes);
		const aliases = [...map.values()];
		expect(new Set(aliases).size).toBe(2);
		// lexicographically first id wins the un-suffixed alias
		expect(map.get("node-1")).toBe("formA");
		expect(map.get("node-2")).toBe("formA2");
	});

	it("is deterministic regardless of input array order", () => {
		const nodes = [makeNode("node-1", "Form A"), makeNode("node-2", "Form a")];
		const map1 = buildAliasMap(nodes);
		const map2 = buildAliasMap([...nodes].reverse());
		expect(map1.get("node-1")).toBe(map2.get("node-1"));
		expect(map1.get("node-2")).toBe(map2.get("node-2"));
	});

	it("suffixes reserved alias with _1", () => {
		const nodes = [makeNode("node-abc", "event")];
		const map = buildAliasMap(nodes);
		expect(map.get("node-abc")).toBe("event_1");
	});

	it("handles collision on reserved-suffixed alias", () => {
		const nodes = [
			makeNode("node-abc", "event"),
			makeNode("node-def", "event"), // same alias → collision after reserved suffix
		];
		const map = buildAliasMap(nodes);
		const aliases = [...map.values()];
		expect(new Set(aliases).size).toBe(2);
	});

	it("falls back to node type when title is empty", () => {
		const nodes = [makeNode("node-1", "", "Transform")];
		const map = buildAliasMap(nodes);
		expect(map.get("node-1")).toBe("transform");
	});

	it("handles a single node", () => {
		const nodes = [makeNode("node-1", "My Node")];
		const map = buildAliasMap(nodes);
		expect(map.get("node-1")).toBe("myNode");
	});

	it("handles empty array", () => {
		const map = buildAliasMap([]);
		expect(map.size).toBe(0);
	});
});

// ─── nodeAlias ────────────────────────────────────────────────────────────────

describe("nodeAlias", () => {
	it("returns the alias for a node within context", () => {
		const n1 = makeNode("node-1", "Coapplicant Form");
		const n2 = makeNode("node-2", "Credit Check");
		expect(nodeAlias(n1, [n1, n2])).toBe("coapplicantForm");
	});
});

// ─── aliasToNodeId ────────────────────────────────────────────────────────────

describe("aliasToNodeId", () => {
	it("finds nodeId for a known alias", () => {
		const nodes = [makeNode("node-1", "Coapplicant Form")];
		const map = buildAliasMap(nodes);
		expect(aliasToNodeId("coapplicantForm", map)).toBe("node-1");
	});

	it("returns undefined for unknown alias", () => {
		const nodes = [makeNode("node-1", "Coapplicant Form")];
		const map = buildAliasMap(nodes);
		expect(aliasToNodeId("nonExistent", map)).toBeUndefined();
	});
});

// ─── isLegacyNodeId ───────────────────────────────────────────────────────────

describe("isLegacyNodeId", () => {
	it("detects legacy timestamp-based ids", () => {
		expect(isLegacyNodeId("node-1734056123")).toBe(true);
		expect(isLegacyNodeId("node-1734056123-0")).toBe(true);
	});

	it("does not flag new alias-based paths", () => {
		expect(isLegacyNodeId("coapplicantForm")).toBe(false);
		expect(isLegacyNodeId("secret")).toBe(false);
		expect(isLegacyNodeId("node")).toBe(false);
	});
});
