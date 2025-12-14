import type {
	WorkflowNode,
	WorkflowEdge,
	ValidationError,
	APIFailureHandling,
	ChallengeNodeConfig,
} from "./types";
import { MAX_CHALLENGE_RETRIES } from "./types";
import { findNearestPreviousCheckpoint } from "./graph-utils";

type ChallengeResult = "accepted" | "rejected" | "failed";

const CHALLENGE_RESULT_METADATA: Record<
	ChallengeResult,
	{ label: string; port: "top" | "bottom" | null }
> = {
	accepted: {
		label: "Aceptado",
		port: "top",
	},
	rejected: {
		label: "Rechazado",
		port: "bottom",
	},
	failed: {
		label: "Fallido",
		port: "bottom",
	},
};

const DEFAULT_CHALLENGE_RESULTS: ChallengeResult[] = ["accepted", "rejected"];
const CHALLENGE_RESULT_CONFIG_KEYS = [
	"enabledResults",
	"results",
	"activeResults",
] as const;

export function validateWorkflow(
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
): ValidationError[] {
	const errors: ValidationError[] = [];
	const { outgoingMap, incomingMap } = buildAdjacencyMaps(edges);

	// Validación 1: Exactamente un nodo de inicio
	const startNodes = nodes.filter((n) => n.type === "Start");
	if (startNodes.length === 0) {
		errors.push({
			message: "El flujo debe tener exactamente un nodo de Inicio",
			severity: "error",
		});
	} else if (startNodes.length > 1) {
		errors.push({
			message: "El flujo solo puede tener un nodo de Inicio",
			severity: "error",
		});
	}

	// Validación 2: Solo Form y Challenge requieren al menos un rol
	const NODES_WITH_REQUIRED_ROLES = ["Form", "Challenge"];
	nodes.forEach((node) => {
		if (
			NODES_WITH_REQUIRED_ROLES.includes(node.type) &&
			node.roles.length === 0
		) {
			errors.push({
				nodeId: node.id,
				message: `"${node.title}" debe tener al menos un rol asignado`,
				severity: "error",
			});
		}
	});

	// Validación 3: Nodos de decisión deben tener ambas ramas
	nodes
		.filter((n) => n.type === "Decision")
		.forEach((node) => {
			const outgoingEdges = edges.filter((e) => e.from === node.id);
			if (outgoingEdges.length < 2) {
				errors.push({
					nodeId: node.id,
					message: `"${node.title}" debe tener dos salidas conectadas (Sí/No o Aprobar/Rechazar)`,
					severity: "error",
				});
			}
		});

	// Validación 4: Todos los caminos deben terminar en Fin o Rechazado
	const endNodes = nodes.filter((n) => n.type === "End" || n.type === "Reject");
	if (endNodes.length === 0) {
		errors.push({
			message:
				"El flujo debe tener al menos un nodo de finalización (Fin o Rechazado)",
			severity: "error",
		});
	}
	const terminalNodeIds = new Set(endNodes.map((n) => n.id));

	// Validación 5: Nodos sin salidas (excepto nodos finales)
	nodes.forEach((node) => {
		const allowRetry = (node.config.allowRetry as boolean) === true;

		if (
			node.type !== "End" &&
			node.type !== "Reject" &&
			node.type !== "Challenge"
		) {
			const hasOutgoing = edges.some((e) => e.from === node.id);
			if (!hasOutgoing) {
				errors.push({
					nodeId: node.id,
					message: `"${node.title}" no tiene conexiones de salida`,
					severity: "warning",
				});
			}
		} else if (node.type === "Reject") {
			// Validación específica para nodos Reject
			const outgoingEdges = edges.filter((e) => e.from === node.id);

			if (allowRetry) {
				// Si allowRetry está activo, debe tener exactamente una salida hacia un checkpoint
				if (outgoingEdges.length === 0) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}" con reintentos habilitados debe tener una conexión hacia un checkpoint`,
						severity: "error",
					});
				} else if (outgoingEdges.length > 1) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}" con reintentos habilitados solo puede tener una conexión`,
						severity: "error",
					});
				} else {
					// Validar que la conexión vaya al checkpoint anterior más próximo
					const checkpointId = findNearestPreviousCheckpoint(
						node.id,
						nodes,
						edges,
					);
					const edge = outgoingEdges[0];

					if (checkpointId && edge.to !== checkpointId) {
						errors.push({
							nodeId: node.id,
							message: `"${node.title}" debe conectarse al checkpoint anterior más próximo`,
							severity: "error",
						});
					}

					// Validar que el destino sea un checkpoint
					const targetNode = nodes.find((n) => n.id === edge.to);
					if (targetNode && targetNode.type !== "Checkpoint") {
						errors.push({
							nodeId: node.id,
							message: `"${node.title}" solo puede conectarse a un checkpoint cuando los reintentos están habilitados`,
							severity: "error",
						});
					}
				}

				// Validar maxRetries
				const maxRetries = (node.config.maxRetries as number) ?? 0;
				if (maxRetries < 0) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}" el número máximo de reintentos debe ser >= 0`,
						severity: "error",
					});
				}
			} else {
				// Si allowRetry está desactivado, no debe tener salidas (es terminal)
				if (outgoingEdges.length > 0) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}" sin reintentos no debe tener conexiones de salida`,
						severity: "error",
					});
				}
			}
		}
	});

	// Validación 6: Configuración específica por tipo
	nodes.forEach((node) => {
		if (node.type === "Form" && !node.config.formId) {
			errors.push({
				nodeId: node.id,
				message: `"${node.title}" debe tener un formulario seleccionado`,
				severity: "error",
			});
		}

		if (node.type === "Decision" && !node.config.condition) {
			errors.push({
				nodeId: node.id,
				message: `"${node.title}" debe tener una condición definida`,
				severity: "error",
			});
		}

		if (node.type === "Transform" && !node.config.code) {
			errors.push({
				nodeId: node.id,
				message: `"${node.title}" debe tener código TypeScript`,
				severity: "error",
			});
		}

		if (node.type === "API") {
			// Validar URL
			if (!node.config.url) {
				errors.push({
					nodeId: node.id,
					message: `"${node.title}" debe tener una URL configurada`,
					severity: "error",
				});
			}

			// Validar failureHandling si existe
			const fh = node.config.failureHandling as
				| (APIFailureHandling & { checkpointId?: string })
				| undefined;
			if (fh) {
				// Validar maxRetries (máximo 2)
				if (fh.maxRetries > 2) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}": El número máximo de reintentos es 2`,
						severity: "error",
					});
				}

				if (fh.maxRetries < 0) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}": El número de reintentos no puede ser negativo`,
						severity: "error",
					});
				}

				// Validar checkpoint si return-to-checkpoint
				if (fh.onFailure === "return-to-checkpoint") {
					const checkpointId = findNearestPreviousCheckpoint(
						node.id,
						nodes,
						edges,
					);
					if (!checkpointId) {
						errors.push({
							nodeId: node.id,
							message: `"${node.title}": No hay checkpoint anterior para regresar en caso de fallo`,
							severity: "error",
						});
					}
				}

				// Validar timeout
				if (fh.timeout < 5000 || fh.timeout > 300000) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}": El timeout debe estar entre 5 y 300 segundos`,
						severity: "warning",
					});
				}

				// Validar que API con onFailure='stop' no tenga conexiones salientes
				if (fh.onFailure === "stop") {
					const outgoingEdges = edges.filter((e) => e.from === node.id);
					if (outgoingEdges.length > 0) {
						errors.push({
							nodeId: node.id,
							message: `"${node.title}": Un nodo API con "Detener Workflow" no puede tener conexiones salientes`,
							severity: "error",
						});
					}
				}

				// Validar que API con return-to-checkpoint tenga checkpoint configurado
				if (fh.onFailure === "return-to-checkpoint") {
					const checkpointId = findNearestPreviousCheckpoint(
						node.id,
						nodes,
						edges,
					);

					if (!fh.checkpointId) {
						errors.push({
							nodeId: node.id,
							message: `"${node.title}": Debe tener un checkpoint configurado`,
							severity: "error",
						});
					} else if (fh.checkpointId !== checkpointId) {
						errors.push({
							nodeId: node.id,
							message: `"${node.title}": El checkpoint configurado no es el más próximo`,
							severity: "warning",
						});
					}

					// Validar que no tenga conexiones salientes visibles (la conexión es lógica, no visual)
					const outgoingEdges = edges.filter((e) => e.from === node.id);
					if (outgoingEdges.length > 0) {
						errors.push({
							nodeId: node.id,
							message: `"${node.title}": No debe tener conexiones visuales. La conexión al checkpoint es automática.`,
							severity: "warning",
						});
					}
				}
			}
		}

		if (node.type === "Message" && !node.config.template) {
			errors.push({
				nodeId: node.id,
				message: `"${node.title}" debe tener un template de mensaje`,
				severity: "error",
			});
		}

		if (node.type === "Challenge") {
			const config = node.config as ChallengeNodeConfig | undefined;
			if (!config || !config.challengeType) {
				errors.push({
					nodeId: node.id,
					message: `"${node.title}" debe definir el tipo de challenge`,
					severity: "error",
				});
				return;
			}

			if (!config.challengeTimeout || config.challengeTimeout.value <= 0) {
				errors.push({
					nodeId: node.id,
					message: `"${node.title}" debe definir un timeout de challenge válido`,
					severity: "error",
				});
			}

			if (
				config.challengeType === "acceptance" ||
				config.challengeType === "signature"
			) {
				if (!config.deliveryMethod) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}" requiere un canal de entrega`,
						severity: "error",
					});
				}
			}

			if (config.retries) {
				if (
					typeof config.retries.maxRetries !== "number" ||
					!Number.isInteger(config.retries.maxRetries) ||
					config.retries.maxRetries < 1 ||
					config.retries.maxRetries > MAX_CHALLENGE_RETRIES
				) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}": El número de reintentos debe estar entre 1 y ${MAX_CHALLENGE_RETRIES}`,
						severity: "error",
					});
				}

				if (
					!Array.isArray(config.retries.roles) ||
					config.retries.roles.length === 0
				) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}": Selecciona al menos un rol responsable de los reintentos`,
						severity: "error",
					});
				} else if (
					config.retries.roles.some(
						(role) => typeof role !== "string" || role.trim().length === 0,
					)
				) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}": Los roles de reintento deben ser válidos`,
						severity: "error",
					});
				}
			}

			validateChallengeResultConnections(node, config, edges, errors);
		}
	});

	// Validación 7: Nodos con staleTimeout deben tener checkpoints SAFE previos y posteriores
	const startNodeIds = new Set(startNodes.map((n) => n.id));
	const safeCheckpointIds = new Set(
		nodes
			.filter(
				(node) => node.type === "Checkpoint" && node.checkpointType === "safe",
			)
			.map((node) => node.id),
	);

	nodes.forEach((node) => {
		if (!node.staleTimeout) {
			return;
		}

		const forwardSeeds = outgoingMap.get(node.id) ?? [];
		const backwardSeeds = incomingMap.get(node.id) ?? [];

		const hasSafeAhead = canReachNode(forwardSeeds, outgoingMap, (nodeId) =>
			safeCheckpointIds.has(nodeId),
		);
		const canFinishFlow = canReachNode(forwardSeeds, outgoingMap, (nodeId) =>
			terminalNodeIds.has(nodeId),
		);

		if (!hasSafeAhead && !canFinishFlow) {
			errors.push({
				nodeId: node.id,
				message:
					'Este nodo con "staleTimeout" no tiene un checkpoint SAFE posterior ni un fin de flujo alcanzable.',
				severity: "warning",
			});
		}

		const hasSafeBehind = canReachNode(backwardSeeds, incomingMap, (nodeId) =>
			safeCheckpointIds.has(nodeId),
		);
		const reachesStart = canReachNode(backwardSeeds, incomingMap, (nodeId) =>
			startNodeIds.has(nodeId),
		);

		if (!hasSafeBehind && !reachesStart) {
			errors.push({
				nodeId: node.id,
				message:
					"Este nodo debe tener un checkpoint SAFE previo o el Inicio como punto de retorno si se pudre.",
				severity: "warning",
			});
		}
	});

	return errors;
}

function buildAdjacencyMaps(edges: WorkflowEdge[]) {
	const outgoingMap = new Map<string, string[]>();
	const incomingMap = new Map<string, string[]>();

	edges.forEach((edge) => {
		if (!outgoingMap.has(edge.from)) {
			outgoingMap.set(edge.from, []);
		}
		outgoingMap.get(edge.from)!.push(edge.to);

		if (!incomingMap.has(edge.to)) {
			incomingMap.set(edge.to, []);
		}
		incomingMap.get(edge.to)!.push(edge.from);
	});

	return { outgoingMap, incomingMap };
}

function canReachNode(
	initialNodeIds: string[],
	adjacencyMap: Map<string, string[]>,
	predicate: (nodeId: string) => boolean,
): boolean {
	if (initialNodeIds.length === 0) {
		return false;
	}

	const visited = new Set<string>();
	const queue: string[] = [];

	initialNodeIds.forEach((id) => {
		if (!visited.has(id)) {
			visited.add(id);
			queue.push(id);
		}
	});

	while (queue.length > 0) {
		const currentId = queue.shift()!;

		if (predicate(currentId)) {
			return true;
		}

		const neighbors = adjacencyMap.get(currentId) ?? [];
		neighbors.forEach((neighborId) => {
			if (!visited.has(neighborId)) {
				visited.add(neighborId);
				queue.push(neighborId);
			}
		});
	}

	return false;
}

function validateChallengeResultConnections(
	node: WorkflowNode,
	config: ChallengeNodeConfig,
	edges: WorkflowEdge[],
	errors: ValidationError[],
) {
	const configuredResults = getConfiguredChallengeResults(config);
	if (configuredResults.length === 0) {
		return;
	}

	const outgoingEdges = edges.filter((edge) => edge.from === node.id);
	if (outgoingEdges.length === 0) {
		configuredResults.forEach((result) => {
			const label = CHALLENGE_RESULT_METADATA[result]?.label ?? result;
			errors.push({
				nodeId: node.id,
				message: `"${node.title}": El resultado "${label}" no tiene una conexión de salida configurada`,
				severity: "warning",
			});
		});
		return;
	}

	const availableEdges = [...outgoingEdges].sort((a, b) => {
		if ((a.fromPort && !b.fromPort) || (!a.fromPort && b.fromPort)) {
			return a.fromPort ? 1 : -1;
		}
		return 0;
	});

	const takeEdgeById = (edgeId: string | undefined): boolean => {
		if (!edgeId) {
			return false;
		}
		const index = availableEdges.findIndex((edge) => edge.id === edgeId);
		if (index >= 0) {
			availableEdges.splice(index, 1);
			return true;
		}
		return false;
	};

	configuredResults.forEach((result) => {
		const metadata = CHALLENGE_RESULT_METADATA[result];
		const expectedPort = metadata?.port ?? null;
		let satisfied = false;

		if (expectedPort) {
			const matchingEdge = outgoingEdges.find(
				(edge) => edge.fromPort === expectedPort,
			);
			satisfied = takeEdgeById(matchingEdge?.id);
		}

		if (!satisfied && availableEdges.length > 0) {
			availableEdges.shift();
			satisfied = true;
		}

		if (!satisfied) {
			const label = metadata?.label ?? result;
			errors.push({
				nodeId: node.id,
				message: `"${node.title}": El resultado "${label}" no tiene una conexión de salida configurada`,
				severity: "warning",
			});
		}
	});
}

function getConfiguredChallengeResults(
	config: ChallengeNodeConfig,
): ChallengeResult[] {
	for (const key of CHALLENGE_RESULT_CONFIG_KEYS) {
		const rawValue = (config as Record<string, unknown>)[key];
		if (!Array.isArray(rawValue)) {
			continue;
		}

		const normalized = rawValue
			.map((value) =>
				typeof value === "string" ? value.trim().toLowerCase() : "",
			)
			.filter(
				(value): value is ChallengeResult =>
					value === "accepted" || value === "rejected" || value === "failed",
			);

		if (normalized.length > 0) {
			return Array.from(new Set(normalized));
		}
	}

	return DEFAULT_CHALLENGE_RESULTS;
}
