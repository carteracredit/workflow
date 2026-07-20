import type { WorkflowNode, WorkflowEdge } from "./types";
import { buildAliasMap, isLegacyNodeId } from "./node-alias";

// Regex that matches ${...} tokens stored by the variable picker / template input
const TOKEN_RE = /\$\{([^}]+)\}/g;

/**
 * Rewrites a single `${...}` path from the legacy `node-<id>.prop` format to
 * the camelCase alias format `<alias>.prop`, using the provided alias map.
 *
 * Paths that are already alias-based (no hyphen-digit pattern in first segment)
 * or are `secret.*` references are returned unchanged.
 *
 * When the nodeId cannot be resolved (node was deleted), the original path is
 * returned as-is so callers can detect orphaned tokens by looking for
 * `isLegacyNodeId` in the resulting paths.
 */
function rewritePath(
	path: string,
	aliasMap: Map<string, string>,
	reverseMap: Map<string, string>,
): string {
	const trimmed = path.trim();
	if (/^secret\./.test(trimmed)) return trimmed;

	const dotIdx = trimmed.indexOf(".");
	const firstSeg = dotIdx >= 0 ? trimmed.slice(0, dotIdx) : trimmed;
	const rest = dotIdx >= 0 ? trimmed.slice(dotIdx) : "";

	if (!isLegacyNodeId(firstSeg)) {
		// Already a camelCase alias or some other non-legacy segment
		// Verify it's in the alias map (by value). If not, leave it (orphan).
		return trimmed;
	}

	// firstSeg is a legacy node ID like "node-1734056123"
	// Try the alias map directly (aliasMap keys are nodeIds)
	const alias = aliasMap.get(firstSeg);
	if (!alias) {
		// Node not found – leave token unchanged (will be flagged as orphan)
		return trimmed;
	}

	// Unused variable suppression
	void reverseMap;

	return `${alias}${rest}`;
}

/**
 * Rewrites all `${...}` tokens in a string, replacing legacy node-ID prefixes
 * with their camelCase aliases.
 *
 * Returns `null` when no changes were made (so callers can skip no-op strings).
 */
function rewriteTokensInString(
	str: string,
	aliasMap: Map<string, string>,
	reverseMap: Map<string, string>,
): string | null {
	let changed = false;
	const result = str.replace(TOKEN_RE, (match, path: string) => {
		const newPath = rewritePath(path, aliasMap, reverseMap);
		if (newPath !== path) {
			changed = true;
			return `\${${newPath}}`;
		}
		return match;
	});
	return changed ? result : null;
}

/**
 * Recursively rewrites all `${node-<id>.prop}` tokens found in any string
 * value within `obj`, replacing legacy node-ID prefixes with camelCase aliases.
 *
 * This generic walker covers every node type (including NLS, Challenge
 * signature, ExternalLink, etc.) without needing to enumerate individual
 * fields. It is idempotent: strings without legacy tokens are untouched.
 */
function rewriteAllStrings(
	obj: unknown,
	aliasMap: Map<string, string>,
	reverseMap: Map<string, string>,
): boolean {
	if (obj === null || obj === undefined) return false;

	if (Array.isArray(obj)) {
		let dirty = false;
		for (let i = 0; i < obj.length; i++) {
			const item = obj[i];
			if (typeof item === "string") {
				const rewritten = rewriteTokensInString(item, aliasMap, reverseMap);
				if (rewritten !== null) {
					obj[i] = rewritten;
					dirty = true;
				}
			} else if (typeof item === "object") {
				if (rewriteAllStrings(item, aliasMap, reverseMap)) dirty = true;
			}
		}
		return dirty;
	}

	if (typeof obj === "object") {
		let dirty = false;
		const record = obj as Record<string, unknown>;
		for (const key of Object.keys(record)) {
			const val = record[key];
			if (typeof val === "string") {
				const rewritten = rewriteTokensInString(val, aliasMap, reverseMap);
				if (rewritten !== null) {
					record[key] = rewritten;
					dirty = true;
				}
			} else if (typeof val === "object") {
				if (rewriteAllStrings(val, aliasMap, reverseMap)) dirty = true;
			}
		}
		return dirty;
	}

	return false;
}

/**
 * Migrates all variable-picker tokens in a single WorkflowNode's config,
 * replacing `${node-<id>.prop}` with `${<alias>.prop}`.
 *
 * Uses a generic recursive walker so all node types (API, Transform, Decision,
 * Message, NLS, Challenge signature, ExternalLink, etc.) are covered
 * automatically without manual field enumeration.
 *
 * Returns `true` when at least one field was rewritten.
 */
function migrateNodeConfig(
	node: WorkflowNode,
	aliasMap: Map<string, string>,
	reverseMap: Map<string, string>,
): boolean {
	return rewriteAllStrings(node.config, aliasMap, reverseMap);
}

/**
 * Detects all `${<alias>.prop}` tokens in a node's config and returns those
 * whose first segment does not match any known alias in `aliasMap`.
 *
 * Used by `validateWorkflow` to report orphaned variable references.
 */
export function findOrphanedTokens(
	node: WorkflowNode,
	aliasMap: Map<string, string>,
): string[] {
	const knownAliases = new Set(aliasMap.values());
	const orphans: string[] = [];

	function check(str: string | undefined) {
		if (!str) return;
		const regex = /\$\{([^}]+)\}/g;
		let m: RegExpExecArray | null;
		while ((m = regex.exec(str)) !== null) {
			const path = m[1].trim();
			if (/^secret\./.test(path)) continue;
			const dotIdx = path.indexOf(".");
			const firstSeg = dotIdx >= 0 ? path.slice(0, dotIdx) : path;
			if (!knownAliases.has(firstSeg)) {
				orphans.push(m[0]);
			}
		}
	}

	function checkConfig(obj: Record<string, unknown>) {
		for (const [, val] of Object.entries(obj)) {
			if (typeof val === "string") {
				check(val);
			} else if (Array.isArray(val)) {
				for (const item of val) {
					if (typeof item === "string") check(item);
					else if (item && typeof item === "object")
						checkConfig(item as Record<string, unknown>);
				}
			} else if (val && typeof val === "object") {
				checkConfig(val as Record<string, unknown>);
			}
		}
	}

	checkConfig(node.config);
	return orphans;
}

/**
 * Detects all `${<alias>.prop...}` tokens in a node's config whose path does
 * not exist in the provided set of valid paths.
 *
 * Only checks tokens where the first segment (alias) IS known — unresolvable
 * aliases are already reported by `findOrphanedTokens`. This function focuses
 * on typos / structural errors in the rest of the path.
 *
 * `validPaths` should be built from `buildVariableSourceNodes` for the
 * upstream nodes of the consumer being validated.
 *
 * Returns an array of the invalid token strings (e.g. `${form.address.street}`).
 */
export function findInvalidPathTokens(
	node: WorkflowNode,
	validPaths: Set<string>,
	knownAliases: Set<string>,
): string[] {
	const invalid: string[] = [];

	function check(str: string | undefined) {
		if (!str) return;
		const regex = /\$\{([^}]+)\}/g;
		let m: RegExpExecArray | null;
		while ((m = regex.exec(str)) !== null) {
			const path = m[1].trim();
			if (/^secret\./.test(path)) continue;
			const dotIdx = path.indexOf(".");
			const firstSeg = dotIdx >= 0 ? path.slice(0, dotIdx) : path;
			// Skip tokens whose alias is unknown — findOrphanedTokens covers those
			if (!knownAliases.has(firstSeg)) continue;
			// The alias is known but the full path is not in the schema
			if (!validPaths.has(path)) {
				invalid.push(m[0]);
			}
		}
	}

	function checkConfig(obj: Record<string, unknown>) {
		for (const [, val] of Object.entries(obj)) {
			if (typeof val === "string") {
				check(val);
			} else if (Array.isArray(val)) {
				for (const item of val) {
					if (typeof item === "string") check(item);
					else if (item && typeof item === "object")
						checkConfig(item as Record<string, unknown>);
				}
			} else if (val && typeof val === "object") {
				checkConfig(val as Record<string, unknown>);
			}
		}
	}

	checkConfig(node.config);
	return invalid;
}

/**
 * Result of migrating a workflow definition.
 */
export interface MigrateTokensResult {
	/** `true` when at least one token was rewritten across any node. */
	changed: boolean;
	/** IDs of nodes whose config was rewritten. */
	migratedNodeIds: string[];
}

/**
 * Walks all WorkflowNode configs and rewrites legacy `${node-<id>.prop}` tokens
 * to `${<alias>.prop}` using a camelCase alias derived from each node's title.
 *
 * This migration is **idempotent**: running it on an already-migrated workflow
 * produces no changes (the first segment won't match `isLegacyNodeId`).
 *
 * The `nodes` array is mutated in-place (configs are updated directly).
 * The `edges` array is currently unused but accepted for future-proofing.
 *
 * @returns `MigrateTokensResult` describing what was changed.
 */
export function migrateWorkflowTokens(
	nodes: WorkflowNode[],
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_edges: WorkflowEdge[],
): MigrateTokensResult {
	const aliasMap = buildAliasMap(nodes);

	// Build reverse map: alias → nodeId (for the rewritePath helper)
	const reverseMap = new Map<string, string>();
	for (const [nodeId, alias] of aliasMap) {
		reverseMap.set(alias, nodeId);
	}

	const migratedNodeIds: string[] = [];

	for (const node of nodes) {
		if (migrateNodeConfig(node, aliasMap, reverseMap)) {
			migratedNodeIds.push(node.id);
		}
	}

	return {
		changed: migratedNodeIds.length > 0,
		migratedNodeIds,
	};
}

/**
 * Rewrites all `${<alias>.prop}` tokens in the given nodes' configs whose
 * first segment is a key of `aliasRemap`, replacing it with the mapped
 * value: `${<aliasRemap.get(alias)>.prop}`.
 *
 * All aliases in the map are replaced in a **single pass** over each string,
 * so chained remaps (e.g. `a -> b` and `b -> c` present in the same map)
 * never get applied sequentially to the same token — each token is rewritten
 * at most once, based purely on its original first segment.
 *
 * `secret.*` tokens are always left untouched, matching the behavior of the
 * other token-rewriting helpers in this module.
 *
 * The nodes array is mutated in-place.
 *
 * @returns The number of fields that were rewritten.
 */
export function remapAliasesInTokens(
	nodes: WorkflowNode[],
	aliasRemap: Map<string, string>,
): number {
	let count = 0;
	if (aliasRemap.size === 0) return count;

	const tokenRe = /\$\{([^}]+)\}/g;

	function rewriteStr(str: string): string | null {
		let changed = false;
		const result = str.replace(tokenRe, (match, path: string) => {
			const trimmed = path.trim();
			if (/^secret\./.test(trimmed)) return match;
			const dotIdx = trimmed.indexOf(".");
			const firstSeg = dotIdx >= 0 ? trimmed.slice(0, dotIdx) : trimmed;
			const newSeg = aliasRemap.get(firstSeg);
			if (newSeg !== undefined) {
				changed = true;
				const rest = dotIdx >= 0 ? trimmed.slice(dotIdx) : "";
				return `\${${newSeg}${rest}}`;
			}
			return match;
		});
		return changed ? result : null;
	}

	function processObj(obj: Record<string, unknown>) {
		for (const key of Object.keys(obj)) {
			const val = obj[key];
			if (typeof val === "string") {
				const r = rewriteStr(val);
				if (r !== null) {
					obj[key] = r;
					count++;
				}
			} else if (Array.isArray(val)) {
				for (let i = 0; i < val.length; i++) {
					if (typeof val[i] === "string") {
						const r = rewriteStr(val[i] as string);
						if (r !== null) {
							val[i] = r;
							count++;
						}
					} else if (val[i] && typeof val[i] === "object") {
						processObj(val[i] as Record<string, unknown>);
					}
				}
			} else if (val && typeof val === "object") {
				processObj(val as Record<string, unknown>);
			}
		}
	}

	for (const node of nodes) {
		processObj(node.config);
	}

	return count;
}

/**
 * Rewrites all `${<fromAlias>.prop}` tokens in the given nodes' configs to
 * `${<toAlias>.prop}`. Used when renaming a node to propagate the alias change
 * across the entire workflow.
 *
 * Thin wrapper around `remapAliasesInTokens` with a single-entry map.
 *
 * The nodes array is mutated in-place.
 *
 * @returns The number of fields that were rewritten.
 */
export function renameAliasInTokens(
	nodes: WorkflowNode[],
	fromAlias: string,
	toAlias: string,
): number {
	return remapAliasesInTokens(nodes, new Map([[fromAlias, toAlias]]));
}

/**
 * Scans all node configs and returns the list of places (nodeId + field context)
 * where a given alias appears in a `${alias.xxx}` token.
 *
 * Used by the rename modal to preview what would be affected before committing.
 */
export interface TokenOccurrence {
	nodeId: string;
	nodeTitle: string;
	/** Snippet of the field value containing the token (max 80 chars). */
	context: string;
}

export function findTokenOccurrences(
	nodes: WorkflowNode[],
	alias: string,
): TokenOccurrence[] {
	const occurrences: TokenOccurrence[] = [];
	const tokenRe = /\$\{([^}]+)\}/g;

	function hasAlias(str: string): boolean {
		tokenRe.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = tokenRe.exec(str)) !== null) {
			const path = m[1].trim();
			const dotIdx = path.indexOf(".");
			const firstSeg = dotIdx >= 0 ? path.slice(0, dotIdx) : path;
			if (firstSeg === alias) return true;
		}
		return false;
	}

	function checkObj(
		obj: Record<string, unknown>,
		nodeId: string,
		nodeTitle: string,
	) {
		for (const val of Object.values(obj)) {
			if (typeof val === "string" && hasAlias(val)) {
				occurrences.push({
					nodeId,
					nodeTitle,
					context: val.length > 80 ? `${val.slice(0, 80)}…` : val,
				});
			} else if (Array.isArray(val)) {
				for (const item of val) {
					if (typeof item === "string" && hasAlias(item)) {
						occurrences.push({
							nodeId,
							nodeTitle,
							context: item.length > 80 ? `${item.slice(0, 80)}…` : item,
						});
					} else if (item && typeof item === "object") {
						checkObj(item as Record<string, unknown>, nodeId, nodeTitle);
					}
				}
			} else if (val && typeof val === "object") {
				checkObj(val as Record<string, unknown>, nodeId, nodeTitle);
			}
		}
	}

	for (const node of nodes) {
		checkObj(node.config, node.id, node.title);
	}

	return occurrences;
}
