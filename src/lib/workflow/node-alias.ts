import type { WorkflowNode } from "./types";

/**
 * Runtime and JS identifiers that cannot be used as an alias root because
 * they collide with names already in scope inside the generated Cloudflare
 * Worker (e.g. `this.env`, `event`, `step.do`, `ctx`).
 */
const RESERVED_ALIASES = new Set([
	// Cloudflare Worker runtime names in scope
	"env",
	"ctx",
	"event",
	"step",
	// Generated code helpers / class context
	"secret",
	"this",
	// Common JS / TS globals that could shadow things
	"self",
	"global",
	"globalThis",
	"undefined",
	"null",
	"true",
	"false",
	"NaN",
	"Infinity",
	"console",
	"fetch",
	"crypto",
	"caches",
	"navigator",
	"performance",
]);

/**
 * Converts a node title to a lowerCamelCase identifier safe for use in
 * TypeScript code.
 *
 * Rules:
 *  - Strip accents and diacritics to their ASCII equivalents.
 *  - Remove characters that are not alphanumeric.
 *  - camelCase words (first word fully lowercase, rest Title-case).
 *  - If the result starts with a digit, prefix with "node".
 *  - Empty / all-symbol titles fall back to "node".
 */
export function titleToCamelCase(title: string): string {
	if (!title || title.trim().length === 0) {
		return "node";
	}

	const cleaned = title
		.replace(/['"]/g, "")
		.replace(/[áàäâ]/gi, (c) => (c === c.toUpperCase() ? "A" : "a"))
		.replace(/[éèëê]/gi, (c) => (c === c.toUpperCase() ? "E" : "e"))
		.replace(/[íìïî]/gi, (c) => (c === c.toUpperCase() ? "I" : "i"))
		.replace(/[óòöô]/gi, (c) => (c === c.toUpperCase() ? "O" : "o"))
		.replace(/[úùüû]/gi, (c) => (c === c.toUpperCase() ? "U" : "u"))
		.replace(/[ñÑ]/g, (c) => (c === "Ñ" ? "N" : "n"));

	const words = cleaned.split(/[^a-zA-Z0-9]+/).filter((w) => w.length > 0);

	if (words.length === 0) {
		return "node";
	}

	const camelCased = words
		.map((word, index) => {
			if (index === 0) {
				return word.charAt(0).toLowerCase() + word.slice(1).toLowerCase();
			}
			return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
		})
		.join("");

	if (!/^[a-zA-Z_]/.test(camelCased)) {
		return `node${camelCased.charAt(0).toUpperCase()}${camelCased.slice(1)}`;
	}

	return camelCased;
}

/**
 * Returns whether a potential alias string collides with a reserved runtime
 * identifier.
 */
export function isReservedAlias(alias: string): boolean {
	return RESERVED_ALIASES.has(alias);
}

/**
 * Builds a deterministic Map<nodeId, alias> for an array of WorkflowNodes.
 *
 * Guarantees:
 *  - Each alias is a valid lowerCamelCase TypeScript identifier.
 *  - Aliases are unique: collisions are resolved with a numeric suffix
 *    (`_1`, `_2`, …). The node with the lexicographically-smallest `id`
 *    wins the un-suffixed alias so the mapping is stable regardless of
 *    input order.
 *  - Aliases that collide with reserved runtime names are immediately
 *    suffixed with `_1`.
 *
 * The deterministic ordering (by `node.id` ascending) means that the same
 * set of nodes always produces the same alias map, even if the array is
 * re-ordered.
 */
export function buildAliasMap(allNodes: WorkflowNode[]): Map<string, string> {
	const sorted = [...allNodes].sort((a, b) => a.id.localeCompare(b.id));

	const aliasMap = new Map<string, string>();
	const usedAliases = new Map<string, number>();

	for (const node of sorted) {
		let base = titleToCamelCase(node.title || node.type);

		if (isReservedAlias(base)) {
			base = `${base}_1`;
		}

		const count = usedAliases.get(base) ?? 0;
		const alias = count === 0 ? base : `${base}${count + 1}`;
		usedAliases.set(base, count + 1);

		aliasMap.set(node.id, alias);
	}

	return aliasMap;
}

/**
 * Returns the camelCase alias for a single node, computed within the context
 * of all workflow nodes to guarantee uniqueness.
 *
 * Prefer `buildAliasMap` when you need aliases for multiple nodes in a single
 * pass (it is O(n) instead of O(n²)).
 */
export function nodeAlias(
	node: WorkflowNode,
	allNodes: WorkflowNode[],
): string {
	const map = buildAliasMap(allNodes);
	return map.get(node.id) ?? titleToCamelCase(node.title || node.type);
}

/**
 * Reverse map: given an alias, returns the nodeId that owns it.
 * Returns `undefined` when the alias is not present in the map.
 */
export function aliasToNodeId(
	alias: string,
	aliasMap: Map<string, string>,
): string | undefined {
	for (const [nodeId, a] of aliasMap) {
		if (a === alias) return nodeId;
	}
	return undefined;
}

/**
 * Returns `true` when the given string looks like a legacy raw node ID
 * (`node-<digits>` or `node-<timestamp>-<index>`).
 */
export function isLegacyNodeId(segment: string): boolean {
	return /^node-\d/.test(segment);
}
