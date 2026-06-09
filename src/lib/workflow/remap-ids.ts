import type { WorkflowNode, WorkflowEdge, Flag, FlagOption } from "./types";

export type IdMap = Map<string, string>;

export interface RemapResult {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	flags: Flag[];
	nodeIdMap: IdMap;
	edgeIdMap: IdMap;
	flagIdMap: IdMap;
	optionIdMap: IdMap;
}

export interface RemapOptions {
	regenerateNodeIds?: boolean;
	regenerateFlagIds?: boolean;
	/** When true, rewrite ${node-<oldId>.prop} tokens in all config strings. */
	rewriteTokens?: boolean;
}

const TOKEN_RE = /\$\{([^}]+)\}/g;

/**
 * Recursively walks all string values in an object/array and applies a
 * transformer function. Returns true if any string was changed.
 *
 * This is the generic alternative to the field-by-field enumeration in
 * `migrateNodeConfig` — it covers every string in `config` regardless of
 * which node type or nested structure it lives in.
 */
function walkAndRewriteStrings(
	obj: unknown,
	transform: (str: string) => string | null,
): boolean {
	if (obj === null || obj === undefined) return false;

	if (Array.isArray(obj)) {
		let dirty = false;
		for (let i = 0; i < obj.length; i++) {
			const item = obj[i];
			if (typeof item === "string") {
				const rewritten = transform(item);
				if (rewritten !== null) {
					obj[i] = rewritten;
					dirty = true;
				}
			} else if (typeof item === "object") {
				if (walkAndRewriteStrings(item, transform)) dirty = true;
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
				const rewritten = transform(val);
				if (rewritten !== null) {
					record[key] = rewritten;
					dirty = true;
				}
			} else if (typeof val === "object") {
				if (walkAndRewriteStrings(val, transform)) dirty = true;
			}
		}
		return dirty;
	}

	return false;
}

/**
 * Creates a string transformer that replaces legacy `${node-<oldId>.prop}`
 * token prefixes with `${node-<newId>.prop}` using the provided idMap.
 *
 * Returns `null` when no changes were made.
 */
function buildTokenRewriter(nodeIdMap: IdMap): (str: string) => string | null {
	return (str: string) => {
		if (!str.includes("${")) return null;

		let changed = false;
		const result = str.replace(TOKEN_RE, (match, path: string) => {
			const trimmed = path.trim();
			if (/^secret\./.test(trimmed)) return match;

			const dotIdx = trimmed.indexOf(".");
			const firstSeg = dotIdx >= 0 ? trimmed.slice(0, dotIdx) : trimmed;
			const rest = dotIdx >= 0 ? trimmed.slice(dotIdx) : "";

			const newId = nodeIdMap.get(firstSeg);
			if (newId) {
				changed = true;
				return `\${${newId}${rest}}`;
			}

			return match;
		});

		return changed ? result : null;
	};
}

/**
 * Remaps flag and flag-option references inside FlagChange node configs.
 */
function remapFlagReferences(
	nodes: WorkflowNode[],
	flagIdMap: IdMap,
	optionIdMap: IdMap,
): void {
	for (const node of nodes) {
		if (node.type !== "FlagChange") continue;

		const flagChanges = node.config.flagChanges;
		if (!Array.isArray(flagChanges)) continue;

		node.config.flagChanges = flagChanges.map(
			(fc: { flagId: string; optionId: string }) => ({
				...fc,
				flagId: flagIdMap.get(fc.flagId) ?? fc.flagId,
				optionId: optionIdMap.get(fc.optionId) ?? fc.optionId,
			}),
		);
	}
}

/**
 * Remaps `failureHandling.checkpointId` references in API and NLS nodes.
 */
function remapCheckpointReferences(
	nodes: WorkflowNode[],
	nodeIdMap: IdMap,
): void {
	for (const node of nodes) {
		if (node.type !== "API" && node.type !== "NLS") continue;

		const fh = node.config.failureHandling as
			| (Record<string, unknown> & { checkpointId?: string })
			| undefined;

		if (
			fh?.onFailure === "return-to-checkpoint" &&
			fh.checkpointId &&
			nodeIdMap.has(fh.checkpointId)
		) {
			fh.checkpointId = nodeIdMap.get(fh.checkpointId)!;
		}
	}
}

/**
 * Regenerates IDs for nodes, edges, flags and their options, producing
 * deterministic maps from old→new IDs. Rewrites all internal references
 * (edges from/to, FlagChange flagId/optionId, failureHandling checkpointId,
 * and ${node-id} tokens in config strings).
 *
 * Pure function — returns new arrays without mutating the originals (except
 * for token rewriting which operates on deep-cloned configs).
 */
export function remapDefinitionIds(
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
	flags: Flag[],
	opts?: RemapOptions,
): RemapResult {
	const {
		regenerateNodeIds = true,
		regenerateFlagIds = true,
		rewriteTokens = true,
	} = opts ?? {};

	const nodeIdMap: IdMap = new Map();
	const edgeIdMap: IdMap = new Map();
	const flagIdMap: IdMap = new Map();
	const optionIdMap: IdMap = new Map();

	const timestamp = Date.now();

	// --- Nodes ---
	const newNodes: WorkflowNode[] = nodes.map((node, index) => {
		const newId = regenerateNodeIds ? `node-${timestamp}-${index}` : node.id;
		if (regenerateNodeIds) nodeIdMap.set(node.id, newId);
		return {
			...node,
			id: newId,
			config: JSON.parse(JSON.stringify(node.config)),
		};
	});

	// --- Edges ---
	const newEdges: WorkflowEdge[] = edges.map((edge, index) => {
		const newId = regenerateNodeIds ? `edge-${timestamp}-${index}` : edge.id;
		if (regenerateNodeIds) edgeIdMap.set(edge.id, newId);
		return {
			...edge,
			id: newId,
			from: nodeIdMap.get(edge.from) ?? edge.from,
			to: nodeIdMap.get(edge.to) ?? edge.to,
		};
	});

	// --- Flags ---
	const newFlags: Flag[] = flags.map((flag, fi) => {
		const newFlagId = regenerateFlagIds ? `flag-${timestamp}-${fi}` : flag.id;
		if (regenerateFlagIds) flagIdMap.set(flag.id, newFlagId);

		const newOptions: FlagOption[] = flag.options.map((opt, oi) => {
			const newOptId = regenerateFlagIds
				? `opt-${timestamp}-${fi}-${oi}`
				: opt.id;
			if (regenerateFlagIds) optionIdMap.set(opt.id, newOptId);
			return { ...opt, id: newOptId };
		});

		return { ...flag, id: newFlagId, options: newOptions };
	});

	// --- Remap internal references ---
	if (regenerateFlagIds) {
		remapFlagReferences(newNodes, flagIdMap, optionIdMap);
	}

	if (regenerateNodeIds) {
		remapCheckpointReferences(newNodes, nodeIdMap);

		if (rewriteTokens) {
			const rewriter = buildTokenRewriter(nodeIdMap);
			for (const node of newNodes) {
				walkAndRewriteStrings(node.config, rewriter);
			}
		}
	}

	return {
		nodes: newNodes,
		edges: newEdges,
		flags: newFlags,
		nodeIdMap,
		edgeIdMap,
		flagIdMap,
		optionIdMap,
	};
}
