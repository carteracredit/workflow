import type {
	WorkflowNode,
	WorkflowEdge,
	OutputSchema,
	OutputSchemaProperty,
	SchemaPropertyType,
} from "./types";
import { cloneCaseVariables } from "./case-variables";
import { cloneChallengeOutputSchemaForType } from "./challenge-output";
import { clonePromotionOutputSchema } from "./promotion-output";
import { cloneGeneratePdfOutputSchema } from "./generate-pdf-output";
import { getNlsOutputFieldsFromCache } from "./nls-functions-cache";
import { cloneNlsOutputFieldsToSchema } from "./nls-output-mapper";
import { buildAliasMap } from "./node-alias";
import type { NLSNodeConfig } from "./types";

/**
 * Encuentra el checkpoint anterior más próximo a un nodo dado.
 * Recorre el flujo hacia atrás desde el nodo hasta encontrar el primer checkpoint.
 *
 * @param nodeId - ID del nodo desde el cual buscar hacia atrás
 * @param nodes - Array de todos los nodos del flujo
 * @param edges - Array de todas las conexiones del flujo
 * @returns ID del checkpoint encontrado o null si no hay checkpoint anterior
 */
export function findNearestPreviousCheckpoint(
	nodeId: string,
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
): string | null {
	const visited = new Set<string>();
	const queue: string[] = [nodeId];

	while (queue.length > 0) {
		const currentId = queue.shift()!;

		if (visited.has(currentId)) {
			continue;
		}
		visited.add(currentId);

		// Encontrar todos los nodos que apuntan al nodo actual (entradas)
		const incomingEdges = edges.filter((edge) => edge.to === currentId);

		for (const edge of incomingEdges) {
			const sourceNode = nodes.find((n) => n.id === edge.from);

			if (!sourceNode) {
				continue;
			}

			// Si encontramos un checkpoint, lo retornamos
			if (sourceNode.type === "Checkpoint") {
				return sourceNode.id;
			}

			// Si es el nodo Start, no hay checkpoint anterior
			if (sourceNode.type === "Start") {
				continue;
			}

			// Continuar buscando hacia atrás
			if (!visited.has(sourceNode.id)) {
				queue.push(sourceNode.id);
			}
		}
	}

	return null;
}

/**
 * Encuentra todos los checkpoints anteriores a la misma distancia mínima.
 * Útil cuando hay múltiples checkpoints a la misma distancia (ej: después de un nodo Join).
 *
 * @param nodeId - ID del nodo desde el cual buscar hacia atrás
 * @param nodes - Array de todos los nodos del flujo
 * @param edges - Array de todas las conexiones del flujo
 * @returns Array de IDs de checkpoints encontrados a la distancia mínima
 */
export function findAllNearestPreviousCheckpoints(
	nodeId: string,
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
): string[] {
	const visited = new Set<string>();
	const queue: Array<{ id: string; distance: number }> = [
		{ id: nodeId, distance: 0 },
	];
	const checkpoints: string[] = [];
	let minDistance = Infinity;

	while (queue.length > 0) {
		const current = queue.shift()!;

		if (visited.has(current.id)) {
			continue;
		}
		visited.add(current.id);

		// Si ya encontramos checkpoints a una distancia menor, no continuar
		if (current.distance > minDistance) {
			continue;
		}

		// Encontrar todos los nodos que apuntan al nodo actual (entradas)
		const incomingEdges = edges.filter((edge) => edge.to === current.id);

		for (const edge of incomingEdges) {
			const sourceNode = nodes.find((n) => n.id === edge.from);

			if (!sourceNode) {
				continue;
			}

			const nextDistance = current.distance + 1;

			// Si encontramos un checkpoint
			if (sourceNode.type === "Checkpoint") {
				if (nextDistance < minDistance) {
					// Nuevo checkpoint más cercano, reiniciar la lista
					minDistance = nextDistance;
					checkpoints.length = 0;
					checkpoints.push(sourceNode.id);
				} else if (nextDistance === minDistance) {
					// Checkpoint a la misma distancia mínima
					if (!checkpoints.includes(sourceNode.id)) {
						checkpoints.push(sourceNode.id);
					}
				}
				continue;
			}

			// Si es el nodo Start, no hay checkpoint anterior
			if (sourceNode.type === "Start") {
				continue;
			}

			// Continuar buscando hacia atrás
			if (!visited.has(sourceNode.id)) {
				queue.push({ id: sourceNode.id, distance: nextDistance });
			}
		}
	}

	return checkpoints;
}

/**
 * Finds all upstream nodes reachable by traversing edges backward from a given nodeId.
 * Returns them in approximate topological order (closest first).
 */
export function findUpstreamNodes(
	nodeId: string,
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
): WorkflowNode[] {
	const visited = new Set<string>();
	const queue: string[] = [nodeId];
	const result: WorkflowNode[] = [];

	while (queue.length > 0) {
		const currentId = queue.shift()!;
		if (visited.has(currentId)) continue;
		visited.add(currentId);

		if (currentId !== nodeId) {
			const node = nodes.find((n) => n.id === currentId);
			if (node) result.push(node);
		}

		const incomingEdges = edges.filter((e) => e.to === currentId);
		for (const edge of incomingEdges) {
			if (!visited.has(edge.from)) {
				queue.push(edge.from);
			}
		}
	}

	return result;
}

// ── Variable Source types ──────────────────────────────────────────────────
// These mirror the variable-picker component types so that graph-utils can
// produce the data structure the picker consumes without a circular import.

export type VariableNodeType =
	| "string"
	| "number"
	| "boolean"
	| "object"
	| "array"
	| "null"
	| "any";

export interface VariableLeafNode {
	name: string;
	type: VariableNodeType;
	path: string;
	children?: VariableLeafNode[];
	description?: string;
}

export interface VariableSourceNode {
	id: string;
	name: string;
	variables: VariableLeafNode[];
}

function schemaTypeToVariableType(t: SchemaPropertyType): VariableNodeType {
	switch (t) {
		case "enum":
			return "string";
		default:
			return t as VariableNodeType;
	}
}

function schemaPropertyToVariable(
	prop: OutputSchemaProperty,
	parentPath: string,
): VariableLeafNode {
	const path = parentPath ? `${parentPath}.${prop.name}` : prop.name;
	const varType = schemaTypeToVariableType(prop.type);
	const node: VariableLeafNode = {
		name: prop.name,
		type: varType,
		path,
		description: prop.description,
	};

	if (prop.type === "object" && prop.properties && prop.properties.length > 0) {
		node.children = prop.properties.map((child) =>
			schemaPropertyToVariable(child, path),
		);
	} else if (prop.type === "array" && prop.items) {
		const itemPath = `${path}[0]`;
		if (
			prop.items.type === "object" &&
			prop.items.properties &&
			prop.items.properties.length > 0
		) {
			node.children = prop.items.properties.map((child) =>
				schemaPropertyToVariable(child, itemPath),
			);
		} else {
			node.children = [schemaPropertyToVariable(prop.items, itemPath)];
		}
	}

	return node;
}

/**
 * Merges two `OutputSchemaProperty` arrays by `name`, letting `override`
 * replace entries that share the same top-level name. Used so the Start node
 * always exposes the fixed `CASE_VARIABLES` plus any user-defined custom
 * fields, without letting user fields accidentally shadow the system ones
 * (system wins).
 */
function mergePropertiesByName(
	base: OutputSchemaProperty[],
	extra: OutputSchemaProperty[],
): OutputSchemaProperty[] {
	const existing = new Set(base.map((p) => p.name));
	return [...base, ...extra.filter((p) => !existing.has(p.name))];
}

/**
 * Converts an array of upstream WorkflowNodes into VariableSourceNode[] for
 * the variable picker.
 *
 * Contract:
 *  - Non-Start nodes: contribute a source only if they declare a non-empty
 *    `config.outputSchema`.
 *  - Start node: ALWAYS contributes a source, merging the fixed case-level
 *    variables (`CASE_VARIABLES`) with any user-defined custom fields in its
 *    `outputSchema.properties`. System fields win on name collisions.
 *  - When `options.allNodes` is provided and contains a Start not already in
 *    `upstreamNodes` (e.g. the selected node is disconnected), the Start is
 *    still emitted as a source so case-level variables are never hidden.
 *
 * `options.allNodes` is also used to build the alias map so that variable
 * paths use the human-readable camelCase alias (e.g. `coapplicantForm.phone`)
 * instead of the raw node id (`node-1734056123.phone`).
 */
export function buildVariableSourceNodes(
	upstreamNodes: WorkflowNode[],
	options?: { allNodes?: WorkflowNode[] },
): VariableSourceNode[] {
	const result: VariableSourceNode[] = [];
	const seenStart = new Set<string>();

	// Build the alias map from ALL nodes so aliases are deterministically unique
	// across the entire workflow, not just the visible upstream slice.
	const aliasMap = buildAliasMap(options?.allNodes ?? upstreamNodes);

	const emitStartSource = (startNode: WorkflowNode) => {
		if (seenStart.has(startNode.id)) return;
		seenStart.add(startNode.id);

		const schema = startNode.config.outputSchema as OutputSchema | undefined;
		const customProps = schema?.properties ?? [];
		const merged = mergePropertiesByName(cloneCaseVariables(), customProps);

		const alias = aliasMap.get(startNode.id) ?? startNode.id;
		const variables: VariableLeafNode[] = merged.map((prop) =>
			schemaPropertyToVariable(prop, alias),
		);

		result.push({
			id: alias,
			name: startNode.title || "Start",
			variables,
		});
	};

	for (const node of upstreamNodes) {
		if (node.type === "Start") {
			emitStartSource(node);
			continue;
		}

		const schema = node.config.outputSchema as OutputSchema | undefined;
		const customProps = schema?.properties ?? [];

		// Challenge, Promotion, GeneratePDF, and NLS nodes always expose a fixed output schema.
		// User-declared custom properties are merged on top, but fixed fields
		// win on collisions so downstream references are always resolvable at runtime.
		let properties: OutputSchemaProperty[];
		if (node.type === "Challenge") {
			properties = mergePropertiesByName(
				cloneChallengeOutputSchemaForType(
					(node.config as { challengeType?: string }).challengeType,
				),
				customProps,
			);
		} else if (
			node.type === "ExternalLink" &&
			(node.config as { mode?: string }).mode === "challenge"
		) {
			properties = mergePropertiesByName(
				cloneChallengeOutputSchemaForType("acceptance"),
				customProps,
			);
		} else if (node.type === "Promotion") {
			properties = mergePropertiesByName(
				clonePromotionOutputSchema(),
				customProps,
			);
		} else if (node.type === "GeneratePDF") {
			properties = mergePropertiesByName(
				cloneGeneratePdfOutputSchema(),
				customProps,
			);
		} else if (node.type === "NLS") {
			const nlsConfig = node.config as NLSNodeConfig;
			const cachedFields = getNlsOutputFieldsFromCache(nlsConfig.functionId);
			properties = mergePropertiesByName(
				cloneNlsOutputFieldsToSchema(cachedFields ?? [], nlsConfig.functionId),
				customProps,
			);
		} else {
			properties = customProps;
		}

		if (properties.length === 0) {
			continue;
		}

		const alias = aliasMap.get(node.id) ?? node.id;
		const variables: VariableLeafNode[] = properties.map((prop) =>
			schemaPropertyToVariable(prop, alias),
		);

		result.push({
			id: alias,
			name: node.title || node.type,
			variables,
		});
	}

	// Guarantee the Start source is present even when upstream traversal did not
	// reach it (e.g. the selected node is disconnected from the Start yet).
	if (seenStart.size === 0 && options?.allNodes) {
		const start = options.allNodes.find((n) => n.type === "Start");
		if (start) emitStartSource(start);
	}

	return result;
}

/**
 * Stable id used for the virtual "Secrets / workflow variables" source so
 * code generators and UI consumers can detect it with a single check.
 */
export const SECRETS_SOURCE_ID = "__secrets__";

/** Minimal shape of a workflow-svc variable needed by the picker. */
export interface WorkflowSecretLike {
	name: string;
	is_secret?: boolean;
	environment?: string;
	description?: string | null;
}

/**
 * Builds a virtual `VariableSourceNode` that exposes workflow-level variables
 * and secrets to the picker. Selected entries produce tokens of the form
 * `${secret.NAME}` (via the standard `${${variable.path}}` templating),
 * which the code generator later maps to `this.env.NAME`.
 *
 * Returns `null` when there are no variables to expose so callers can cheaply
 * skip the source.
 */
export function buildSecretsSource(
	vars: WorkflowSecretLike[],
	options?: { name?: string },
): VariableSourceNode | null {
	if (!vars || vars.length === 0) return null;

	const variables: VariableLeafNode[] = vars
		.slice()
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((v) => {
			const descParts: string[] = [];
			if (v.is_secret) descParts.push("secret");
			if (v.environment && v.environment !== "all") {
				descParts.push(v.environment);
			}
			if (v.description) descParts.push(v.description);
			return {
				name: v.name,
				type: "string" as VariableNodeType,
				path: `secret.${v.name}`,
				description: descParts.length > 0 ? descParts.join(" · ") : undefined,
			};
		});

	return {
		id: SECRETS_SOURCE_ID,
		name: options?.name ?? "Secrets",
		variables,
	};
}

/**
 * Obtiene el nodo checkpoint por su ID
 */
export function getCheckpointNode(
	checkpointId: string | null,
	nodes: WorkflowNode[],
): WorkflowNode | null {
	if (!checkpointId) {
		return null;
	}
	const checkpoint = nodes.find(
		(n) => n.id === checkpointId && n.type === "Checkpoint",
	);
	return checkpoint || null;
}
