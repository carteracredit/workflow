import type { WorkflowNode, WorkflowEdge } from "./types";

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
