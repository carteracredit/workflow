import type { NodeType, WorkflowNode, WorkflowEdge } from "./types";

const MULTI_OUTPUT_NODE_TYPES: NodeType[] = ["Decision", "Challenge"];

function isMultiOutputNode(type: NodeType): boolean {
	return MULTI_OUTPUT_NODE_TYPES.includes(type);
}

function getPortName(type: NodeType, port: "top" | "bottom"): string {
	if (type === "Challenge") {
		return port === "top" ? "accepted" : "rejected";
	}
	// Decision mantiene la terminología original
	return port === "top" ? "verde (positiva)" : "roja (negativa)";
}

/**
 * Identifica si una conexión (edge) es una conexión de reintento.
 * Las conexiones de reintento son informativas y muestran a dónde regresa un nodo
 * (Reject con allowRetry o API con return-to-checkpoint) en caso de fallo.
 *
 * Se identifica principalmente por el label 'Reintento' (semántico, no depende del color).
 * El color puede cambiar sin afectar esta identificación.
 *
 * @param edge - Conexión a verificar
 * @returns true si es una conexión de reintento, false en caso contrario
 */
export function isRetryEdge(edge: WorkflowEdge): boolean {
	// Identificar por label (semántico, no depende del color)
	return edge.label === "Reintento";
}

/**
 * Obtiene el número máximo de conexiones de salida permitidas para un tipo de nodo.
 *
 * Reglas de negocio:
 * - Nodos normales: máximo 1 salida
 * - Nodos de decisión (Decision): máximo 2 salidas
 * - Nodo unión (Join): máximo 1 salida
 * - Nodos terminales (End, Reject sin allowRetry, API con onFailure='stop'): 0 salidas
 *
 * @param nodeType - Tipo de nodo
 * @returns Número máximo de conexiones de salida permitidas
 */
export function getMaxOutgoingConnections(nodeType: NodeType): number {
	// Nodos de decisión: máximo 2 salidas
	if (nodeType === "Decision" || nodeType === "Challenge") {
		return 2;
	}

	// Nodo unión: máximo 1 salida
	if (nodeType === "Join") {
		return 1;
	}

	// Nodos normales: máximo 1 salida
	// (Start, Form, Transform, API, Message, Checkpoint, FlagChange, etc.)
	return 1;
}

/**
 * Obtiene el número máximo de conexiones de entrada permitidas para un tipo de nodo.
 *
 * Reglas de negocio:
 * - Nodo unión (Join): múltiples entradas permitidas (sin límite)
 * - Nodo inicio (Start): 0 entradas (es el punto de inicio)
 * - Todos los demás nodos: máximo 1 entrada
 *   - Nota: Los checkpoints permiten 1 entrada normal, pero las conexiones de reintento
 *     (amarillas, informativas) no cuentan para este límite
 *
 * @param nodeType - Tipo de nodo
 * @returns Número máximo de conexiones de entrada permitidas, o null si no hay límite
 */
export function getMaxIncomingConnections(nodeType: NodeType): number | null {
	// Nodo inicio: no puede tener entradas
	if (nodeType === "Start") {
		return 0;
	}

	// Nodo unión: puede tener múltiples entradas (sin límite)
	if (nodeType === "Join") {
		return null; // null significa sin límite
	}

	// Todos los demás nodos (incluyendo Checkpoint): máximo 1 entrada normal
	// Las conexiones de reintento (amarillas) se excluyen del conteo en canCreateConnection
	return 1;
}

/**
 * Verifica si un nodo puede tener conexiones de salida según su configuración.
 *
 * Algunos nodos pueden ser terminales según su configuración:
 * - Reject sin allowRetry: terminal (0 salidas)
 * - API con onFailure='stop': terminal (0 salidas)
 *
 * @param node - Nodo a verificar
 * @returns true si el nodo puede tener conexiones de salida, false si es terminal
 */
export function canNodeHaveOutgoingConnections(node: WorkflowNode): boolean {
	// Nodo Reject sin allowRetry: es terminal
	if (node.type === "Reject") {
		const allowRetry = (node.config.allowRetry as boolean) === true;
		if (!allowRetry) {
			return false;
		}
	}

	// Nodo API con onFailure='stop': es terminal
	if (node.type === "API") {
		const fh = node.config.failureHandling as
			| { onFailure?: string }
			| undefined;
		if (fh?.onFailure === "stop") {
			return false;
		}
	}

	return true;
}

/**
 * Valida si se puede crear una conexión desde un nodo origen hacia un nodo destino.
 *
 * @param sourceNode - Nodo origen de la conexión
 * @param targetNode - Nodo destino de la conexión
 * @param edges - Array de todas las conexiones existentes
 * @param fromPort - Puerto de salida desde el cual se crea la conexión ('top' para verde, 'bottom' para rojo en Decision)
 * @returns Objeto con allowed (boolean) y reason opcional (string) si no está permitido
 */
export function canCreateConnection(
	sourceNode: WorkflowNode,
	targetNode: WorkflowNode,
	edges: WorkflowEdge[],
	fromPort?: "top" | "bottom",
): { allowed: boolean; reason?: string } {
	// Verificar si el nodo origen puede tener conexiones de salida
	if (!canNodeHaveOutgoingConnections(sourceNode)) {
		return {
			allowed: false,
			reason: `El nodo "${sourceNode.title}" no puede tener conexiones de salida.`,
		};
	}

	// Para nodos Decision, validar por puerto (cada puerto solo puede tener 1 conexión)
	const isNodeWithPortLimit = isMultiOutputNode(sourceNode.type);
	if (isNodeWithPortLimit && fromPort) {
		// Verificar si ya existe una conexión en este puerto específico
		const existingConnectionOnPort = edges.find(
			(e) => e.from === sourceNode.id && e.fromPort === fromPort,
		);
		if (existingConnectionOnPort) {
			const portName = getPortName(sourceNode.type, fromPort);
			return {
				allowed: false,
				reason: `El nodo "${sourceNode.title}" ya tiene una conexión en el conector ${portName}. Cada conector solo puede tener una conexión.`,
			};
		}
	}

	// Verificar límite total de conexiones de salida del nodo origen
	const maxOutgoing = getMaxOutgoingConnections(sourceNode.type);
	const currentOutgoing = edges.filter((e) => e.from === sourceNode.id).length;

	if (currentOutgoing >= maxOutgoing) {
		const nodeTypeName =
			sourceNode.type === "Decision"
				? "decisión"
				: sourceNode.type === "Challenge"
					? "challenge"
					: sourceNode.type === "Join"
						? "unión"
						: "normal";
		return {
			allowed: false,
			reason: `El nodo "${sourceNode.title}" (${nodeTypeName}) ya tiene el máximo de conexiones de salida permitidas (${maxOutgoing}).`,
		};
	}

	// Verificar límite de conexiones de entrada del nodo destino
	const maxIncoming = getMaxIncomingConnections(targetNode.type);
	if (maxIncoming !== null) {
		let currentIncoming: number;

		// Caso especial: Solo para checkpoints, excluir conexiones de reintento del conteo
		// Las conexiones de reintento son informativas y muestran a dónde regresa un nodo
		// (Reject con allowRetry o API con return-to-checkpoint) en caso de fallo.
		// No deben bloquear la creación de conexiones normales al checkpoint
		if (targetNode.type === "Checkpoint") {
			currentIncoming = edges.filter(
				(e) => e.to === targetNode.id && !isRetryEdge(e),
			).length;
		} else {
			// Para todos los demás nodos, contar todas las conexiones normalmente
			currentIncoming = edges.filter((e) => e.to === targetNode.id).length;
		}

		if (currentIncoming >= maxIncoming) {
			const nodeTypeName = targetNode.type === "Start" ? "inicio" : "normal";
			return {
				allowed: false,
				reason: `El nodo "${targetNode.title}" (${nodeTypeName}) ya tiene el máximo de conexiones de entrada permitidas (${maxIncoming}).`,
			};
		}
	}
	// Si maxIncoming es null (Join), no hay límite y se permiten todas las conexiones

	return { allowed: true };
}
