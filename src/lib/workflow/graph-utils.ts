import type {
	WorkflowNode,
	WorkflowEdge,
	OutputSchema,
	OutputSchemaProperty,
	SchemaPropertyType,
} from "./types";

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
 * Converts an array of upstream WorkflowNodes (those that have an outputSchema
 * in their config) into VariableSourceNode[] suitable for the variable picker.
 */
export function buildVariableSourceNodes(
	upstreamNodes: WorkflowNode[],
): VariableSourceNode[] {
	const result: VariableSourceNode[] = [];

	for (const node of upstreamNodes) {
		const schema = node.config.outputSchema as OutputSchema | undefined;
		if (!schema || !schema.properties || schema.properties.length === 0) {
			continue;
		}

		const variables: VariableLeafNode[] = schema.properties.map((prop) =>
			schemaPropertyToVariable(prop, node.id),
		);

		result.push({
			id: node.id,
			name: node.title || node.type,
			variables,
		});
	}

	return result;
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
