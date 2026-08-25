import type {
	WorkflowNode,
	WorkflowEdge,
	ValidationError,
	APIFailureHandling,
	APICallType,
	AINameMatchConfig,
	ChallengeNodeConfig,
	Flag,
	MessageNodeConfig,
	NLSNodeConfig,
	ExternalLinkNodeConfig,
	GeneratePdfNodeConfig,
	TimeoutUnit,
} from "./types";
import { MAX_CHALLENGE_RETRIES, ROLE_OPTIONS } from "./types";
import {
	findNearestPreviousCheckpoint,
	findUpstreamNodes,
	buildVariableSourceNodes,
	type VariableLeafNode,
	type VariableSourceNode,
} from "./graph-utils";
import {
	validateTransformCode,
	validateConditionExpression,
} from "./validate-code";
import { buildAliasMap } from "./node-alias";
import { findOrphanedTokens, findInvalidPathTokens } from "./migrate-tokens";

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

const TIMEOUT_UNIT_LABEL_ES: Record<TimeoutUnit, string> = {
	seconds: "segundos",
	minutes: "minutos",
	hours: "horas",
	days: "días",
};

function formatTimeoutForMessage(config: {
	value: number;
	unit: TimeoutUnit;
}): string {
	return `${config.value} ${TIMEOUT_UNIT_LABEL_ES[config.unit] ?? config.unit}`;
}

const DEFAULT_CHALLENGE_RESULTS: ChallengeResult[] = ["accepted", "rejected"];
const CHALLENGE_RESULT_CONFIG_KEYS = [
	"enabledResults",
	"results",
	"activeResults",
] as const;

export function validateWorkflow(
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
	flags: Flag[] = [],
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

	// Validación 2: Form, Challenge y Promotion requieren al menos un rol
	const NODES_WITH_REQUIRED_ROLES = [
		"Form",
		"Challenge",
		"Promotion",
		"AddCard",
	];
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

	// Validación 2b: visibilityRoles solo puede contener valores permitidos
	const VALID_ROLES = new Set(ROLE_OPTIONS);
	nodes.forEach((node) => {
		if (node.visibilityRoles === undefined) return;
		const invalid = node.visibilityRoles.filter((r) => !VALID_ROLES.has(r));
		if (invalid.length > 0) {
			errors.push({
				nodeId: node.id,
				message: `"${node.title}" tiene roles de visibilidad no válidos: ${invalid.join(", ")}`,
				severity: "error",
			});
		}
	});

	// Validación 2c: warning si nodos con Responsible Roles tienen visibilityRoles vacío
	const NODES_WITH_REQUIRED_INTERACTION_ROLES = [
		"Form",
		"Challenge",
		"Promotion",
		"AddCard",
	];
	nodes.forEach((node) => {
		if (
			NODES_WITH_REQUIRED_INTERACTION_ROLES.includes(node.type) &&
			node.visibilityRoles !== undefined &&
			node.visibilityRoles.length === 0
		) {
			errors.push({
				nodeId: node.id,
				message: `"${node.title}" no tiene roles de visibilidad asignados, nadie podrá ver este nodo en el caso`,
				severity: "warning",
			});
		}
	});

	// Validación 2d: responsible roles must be included in visibility roles
	nodes.forEach((node) => {
		if (node.visibilityRoles === undefined) return;
		if (node.roles.length === 0) return;
		const visSet = new Set(node.visibilityRoles);
		const missing = node.roles.filter((r) => !visSet.has(r));
		if (missing.length > 0) {
			errors.push({
				nodeId: node.id,
				message: `"${node.title}" tiene roles responsables que no están en roles de visibilidad: ${missing.join(", ")}`,
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

		const isExternalLinkChallenge =
			node.type === "ExternalLink" &&
			(node.config as ExternalLinkNodeConfig | undefined)?.mode === "challenge";
		if (
			node.type !== "End" &&
			node.type !== "Reject" &&
			node.type !== "Challenge" &&
			!isExternalLinkChallenge
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

	// Validación: Títulos duplicados dentro del mismo tipo de nodo
	const titlesByType = new Map<string, Map<string, WorkflowNode[]>>();
	for (const node of nodes) {
		if (node.type === "Start" || node.type === "End") continue;
		const trimmedTitle = node.title.trim();
		if (!trimmedTitle) continue;
		if (!titlesByType.has(node.type)) {
			titlesByType.set(node.type, new Map());
		}
		const typeMap = titlesByType.get(node.type)!;
		if (!typeMap.has(trimmedTitle)) {
			typeMap.set(trimmedTitle, []);
		}
		typeMap.get(trimmedTitle)!.push(node);
	}
	for (const [, typeMap] of titlesByType) {
		for (const [title, dupes] of typeMap) {
			if (dupes.length > 1) {
				for (const node of dupes) {
					errors.push({
						nodeId: node.id,
						message: `"${title}" tiene un nombre duplicado — cada nodo debe tener un título único`,
						severity: "error",
					});
				}
			}
		}
	}

	// Validación 6: Configuración específica por tipo
	nodes.forEach((node) => {
		if (node.type === "Form" && !node.config.formId) {
			errors.push({
				nodeId: node.id,
				message: `"${node.title}" debe tener un formulario seleccionado`,
				severity: "error",
			});
		}

		if (
			node.type === "Decision" &&
			!(node.config.condition as string)?.trim()
		) {
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

		if (node.type === "FlagChange") {
			const flagChanges =
				(node.config.flagChanges as
					| Array<{ flagId: string; optionId: string }>
					| undefined) || [];
			if (flagChanges.length === 0) {
				errors.push({
					nodeId: node.id,
					message: `"${node.title}" debe tener al menos un cambio de flag configurado`,
					severity: "warning",
				});
			}
		}

		if (node.type === "API") {
			const callType: APICallType =
				(node.config.callType as APICallType | undefined) ?? "http";

			if (callType === "ai-name-match") {
				const aiNameMatch = node.config.aiNameMatchConfig as
					| AINameMatchConfig
					| undefined;
				const namesToVerify = aiNameMatch?.namesToVerify ?? [];
				const referenceNames = aiNameMatch?.referenceNames ?? [];

				// A "full" entry needs fullName; a "parts" entry needs BOTH
				// firstName and lastName (middleName is always optional) — mirrors
				// how proxy-svc's normalizeNameInput composes NameParts.
				const validateEntries = (
					entries: typeof namesToVerify,
					listLabel: string,
				) => {
					entries.forEach((entry, idx) => {
						const mode = entry.mode ?? "full";
						const position = `${listLabel} #${idx + 1}`;
						if (mode === "parts") {
							if (!entry.firstName?.trim()) {
								errors.push({
									nodeId: node.id,
									message: `"${node.title}": ${position} (modo "por partes") requiere un nombre`,
									severity: "error",
								});
							}
							if (!entry.lastName?.trim()) {
								errors.push({
									nodeId: node.id,
									message: `"${node.title}": ${position} (modo "por partes") requiere un apellido`,
									severity: "error",
								});
							}
						} else if (!entry.fullName?.trim()) {
							errors.push({
								nodeId: node.id,
								message: `"${node.title}": ${position} (modo "nombre completo") requiere una expresión configurada`,
								severity: "error",
							});
						}
					});
				};

				if (namesToVerify.length === 0) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}" debe tener al menos un nombre a verificar configurado`,
						severity: "error",
					});
				} else {
					validateEntries(namesToVerify, "el nombre a verificar");
				}

				if (referenceNames.length === 0) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}" debe tener al menos un nombre de referencia configurado`,
						severity: "error",
					});
				} else {
					validateEntries(referenceNames, "el nombre de referencia");
				}

				const minConfidence = aiNameMatch?.minConfidence;
				if (
					minConfidence !== undefined &&
					(minConfidence < 0 || minConfidence > 100)
				) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}": la confianza mínima debe estar entre 0 y 100`,
						severity: "error",
					});
				}
			} else if (!node.config.url) {
				// Validar URL (solo aplica al modo HTTP externo)
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

		if (node.type === "NLS") {
			const nlsCfg = node.config as NLSNodeConfig | undefined;

			if (!nlsCfg?.functionId) {
				errors.push({
					nodeId: node.id,
					message: `"${node.title}" debe tener una función NLS seleccionada`,
					severity: "error",
				});
			}

			// Validations specific to prequalification function
			if (nlsCfg?.functionId === "prequalification") {
				const fields = nlsCfg.fields ?? [];
				const fieldMap: Record<string, string> = {};
				for (const f of fields) {
					fieldMap[f.fieldId] = f.value;
				}

				const actorType = fieldMap["actorType"] ?? "applicant";
				const isCoapplicant =
					actorType === "coapplicant" || actorType === '"coapplicant"';

				if (isCoapplicant) {
					const requiredCoapplicantFields = [
						"firstName",
						"lastName",
						"email",
						"addressStreetNumber",
						"addressStreetName",
						"addressCity",
						"addressState",
						"addressZipCode",
					];
					const missingFields = requiredCoapplicantFields.filter(
						(f) => !fieldMap[f]?.trim(),
					);
					if (missingFields.length > 0) {
						errors.push({
							nodeId: node.id,
							message: `"${node.title}": En modo cosolicitante, faltan campos requeridos de identidad: ${missingFields.join(", ")}`,
							severity: "error",
						});
					}
				}
			}

			// Validations specific to findPrequalificationMatches function
			if (nlsCfg?.functionId === "findPrequalificationMatches") {
				const fields = nlsCfg.fields ?? [];
				const fieldMap: Record<string, string> = {};
				for (const f of fields) {
					fieldMap[f.fieldId] = f.value;
				}

				const matchFields = ["taxIdNumber", "phone", "email", "userId"];
				const hasAtLeastOne = matchFields.some((f) => fieldMap[f]?.trim());
				if (!hasAtLeastOne) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}": Se requiere al menos un campo de búsqueda (SSN/ITIN, teléfono, email o userId)`,
						severity: "error",
					});
				}
			}

			const fh = nlsCfg?.failureHandling as
				| (APIFailureHandling & { checkpointId?: string })
				| undefined;
			if (fh) {
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
				if (fh.timeout < 5000 || fh.timeout > 300000) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}": El timeout debe estar entre 5 y 300 segundos`,
						severity: "warning",
					});
				}
				if (fh.onFailure === "stop") {
					// onFailure='stop' solo aplica al camino de error:
					// el nodo puede y debe tener conexiones salientes para el camino de éxito.
				}
			}

			if (nlsCfg?.functionId === "createLoan") {
				const loanAmountMapped = (nlsCfg.fields ?? []).some(
					(f) => f.fieldId === "loanAmount" && Boolean(f.value?.trim()),
				);
				const hasUpstreamPromotion = findUpstreamNodes(
					node.id,
					nodes,
					edges,
				).some((n) => n.type === "Promotion");
				if (hasUpstreamPromotion && !loanAmountMapped) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}": hay un nodo Promotion aguas arriba; mapea loanAmount a \${promo.netLoanAmount} del nodo de promoción que corresponda`,
						severity: "warning",
					});
				}
			}
		}

		if (node.type === "GeneratePDF") {
			const pdfCfg = node.config as GeneratePdfNodeConfig | undefined;

			if (!pdfCfg?.pdfTemplateId) {
				errors.push({
					nodeId: node.id,
					message: `"${node.title}" debe tener una plantilla PDF seleccionada`,
					severity: "error",
				});
			}

			const mappings = pdfCfg?.fieldMappings ?? [];
			const emptyMappings = mappings.filter((m) => !m.value?.trim());
			if (mappings.length > 0 && emptyMappings.length === mappings.length) {
				errors.push({
					nodeId: node.id,
					message: `"${node.title}": Ningún campo del PDF tiene un valor asignado`,
					severity: "warning",
				});
			}

			if (pdfCfg?.pdfTemplateId && !pdfCfg.pdfTemplateVersionId) {
				errors.push({
					nodeId: node.id,
					message: `"${node.title}": No tiene una versión de plantilla fijada — usará la versión activa al momento de generar el PDF`,
					severity: "warning",
				});
			}
		}

		if (node.type === "Message") {
			const config = node.config as MessageNodeConfig | undefined;
			const channel = config?.channel ?? "email";

			if (!config?.channel) {
				errors.push({
					nodeId: node.id,
					message: `"${node.title}" debe tener un canal de entrega definido`,
					severity: "error",
				});
			}

			if (node.roles.length === 0) {
				errors.push({
					nodeId: node.id,
					message: `"${node.title}" debe tener al menos un rol destinatario`,
					severity: "error",
				});
			}

			if (channel === "email") {
				if (!config?.templateName) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}" debe tener un nombre de template de Mandrill`,
						severity: "error",
					});
				}
			} else if (channel === "sms") {
				if (!config?.body) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}" debe tener el cuerpo del mensaje SMS`,
						severity: "error",
					});
				}
			}
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

			const hasValidChallengeTimeout = Boolean(
				config.challengeTimeout && config.challengeTimeout.value > 0,
			);
			const challengeTimeoutLabel = hasValidChallengeTimeout
				? formatTimeoutForMessage(config.challengeTimeout!)
				: null;
			validateChallengeResultConnections(
				node,
				config,
				edges,
				errors,
				challengeTimeoutLabel,
			);
		}

		if (node.type === "ExternalLink") {
			const config = node.config as ExternalLinkNodeConfig | undefined;
			if (!config) {
				errors.push({
					nodeId: node.id,
					message: `"${node.title}" debe tener una configuración definida`,
					severity: "error",
				});
			} else {
				if (!config.channels || config.channels.length === 0) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}" debe tener al menos un canal de entrega (email/sms)`,
						severity: "error",
					});
				}

				if (config.channels?.includes("email")) {
					if (!config.recipient?.emailExpression?.trim()) {
						errors.push({
							nodeId: node.id,
							message: `"${node.title}" requiere una expresión de email cuando el canal email está activo`,
							severity: "error",
						});
					}
					if (!config.emailConfig?.templateName?.trim()) {
						errors.push({
							nodeId: node.id,
							message: `"${node.title}" debe tener un nombre de template de Mandrill`,
							severity: "error",
						});
					}
				}

				if (config.channels?.includes("sms")) {
					if (!config.recipient?.phoneExpression?.trim()) {
						errors.push({
							nodeId: node.id,
							message: `"${node.title}" requiere una expresión de teléfono cuando el canal SMS está activo`,
							severity: "error",
						});
					}
				}

				if (config.mode === "form") {
					if (!config.formConfig?.formId) {
						errors.push({
							nodeId: node.id,
							message: `"${node.title}" debe tener un formulario seleccionado`,
							severity: "error",
						});
					}
				}

				if (config.mode === "challenge") {
					const hasValidTimeout = Boolean(
						config.challengeConfig?.timeout &&
						config.challengeConfig.timeout.value > 0,
					);
					if (!hasValidTimeout) {
						errors.push({
							nodeId: node.id,
							message: `"${node.title}" debe definir un timeout válido para el challenge`,
							severity: "error",
						});
					}

					const outgoingEdges = edges.filter((e) => e.from === node.id);
					const hasRedBranch = outgoingEdges.some(
						(e) => e.fromPort === "bottom",
					);
					const canFallbackToRedBranch =
						outgoingEdges.length === 1 && !outgoingEdges[0].fromPort;
					if (!hasRedBranch && !canFallbackToRedBranch) {
						errors.push({
							nodeId: node.id,
							message: buildRedBranchMessage(
								node.title,
								"Rechazado",
								hasValidTimeout
									? formatTimeoutForMessage(config.challengeConfig!.timeout)
									: null,
							),
							severity: "warning",
						});
					}
				}

				if (!config.linkTtl || config.linkTtl.value <= 0) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}" debe tener un TTL de link válido`,
						severity: "error",
					});
				} else {
					const ttlHours =
						config.linkTtl.unit === "days"
							? config.linkTtl.value * 24
							: config.linkTtl.value;
					if (ttlHours < 1 || ttlHours > 720) {
						errors.push({
							nodeId: node.id,
							message: `"${node.title}" el TTL del link debe estar entre 1 hora y 30 días`,
							severity: "error",
						});
					}
				}
			}
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

	// Validación 8: El título de un nodo no debe empezar con número o carácter especial
	nodes.forEach((node) => {
		if (
			node.type === "Start" ||
			node.type === "End" ||
			node.type === "Reject"
		) {
			return;
		}
		const trimmedTitle = node.title.trim();
		if (trimmedTitle.length > 0 && /^[^a-zA-Z_]/.test(trimmedTitle)) {
			errors.push({
				nodeId: node.id,
				message: `"${node.title}" no debe empezar con un número o carácter especial`,
				severity: "warning",
			});
		}
	});

	// Validación 9: FlagChange nodes no pueden referenciar flags u opciones inexistentes
	if (flags.length > 0) {
		const flagMap = new Map(flags.map((f) => [f.id, f]));

		nodes
			.filter((n) => n.type === "FlagChange")
			.forEach((node) => {
				const flagChanges =
					(node.config.flagChanges as
						| Array<{ flagId: string; optionId: string }>
						| undefined) || [];

				flagChanges.forEach(({ flagId, optionId }) => {
					const flag = flagMap.get(flagId);
					if (!flag) {
						errors.push({
							nodeId: node.id,
							message: `"${node.title}": referencia a un flag inexistente (${flagId})`,
							severity: "error",
						});
						return;
					}

					const optionExists = flag.options.some((opt) => opt.id === optionId);
					if (!optionExists) {
						errors.push({
							nodeId: node.id,
							message: `"${node.title}": referencia a una opción inexistente del flag "${flag.name}" (${optionId})`,
							severity: "error",
						});
					}
				});
			});
	}

	// Validación: tokens huérfanos (referencias a alias que no existen en el workflow)
	// y validación de paths completos contra el outputSchema de los nodos upstream.
	{
		const aliasMap = buildAliasMap(nodes);
		const knownAliases = new Set(aliasMap.values());

		for (const node of nodes) {
			// 1. Tokens cuyo alias raíz no existe (nodo eliminado o renombrado)
			const orphans = findOrphanedTokens(node, aliasMap);
			if (orphans.length > 0) {
				const uniqueOrphans = [...new Set(orphans)];
				errors.push({
					nodeId: node.id,
					message: `"${node.title}": referencia a variable(s) huérfana(s) — ${uniqueOrphans.join(", ")}. El nodo de origen ya no existe o fue renombrado.`,
					severity: "error",
				});
			}

			// 2. Tokens con alias conocido pero path inválido en el outputSchema upstream
			const upstreamNodes = findUpstreamNodes(node.id, nodes, edges);
			const sources = buildVariableSourceNodes(upstreamNodes, {
				allNodes: nodes,
			});
			const validPaths = collectVariablePaths(sources);

			const invalidPaths = findInvalidPathTokens(
				node,
				validPaths,
				knownAliases,
			);
			if (invalidPaths.length > 0) {
				const unique = [...new Set(invalidPaths)];
				errors.push({
					nodeId: node.id,
					message: `"${node.title}": referencia(s) a propiedad(es) que no existen en el schema del nodo origen — ${unique.join(", ")}. Revisa el nombre de la propiedad o el schema del nodo de origen.`,
					severity: "error",
				});
			}
		}
	}

	return errors;
}

function collectVariablePaths(sources: VariableSourceNode[]): Set<string> {
	const paths = new Set<string>();

	const walkLeaf = (leaves: VariableLeafNode[]): void => {
		for (const leaf of leaves) {
			paths.add(leaf.path);
			if (leaf.children) walkLeaf(leaf.children);
		}
	};

	for (const src of sources) walkLeaf(src.variables);
	return paths;
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

/**
 * Ports "bottom" concentran los resultados negativos del Challenge
 * (rechazado/fallido). Como un `challengeTimeout` vencido se normaliza a
 * este mismo camino (ver code-generator `waitForEventDurable` + timedOut →
 * rejected), si ese puerto queda sin conexión el timeout llevaría a un
 * camino inexistente y la instancia terminaría silenciosamente sin pasar
 * por un End/Reject. Ver `buildRedBranchMessage` más abajo.
 */
function buildRedBranchMessage(
	nodeTitle: string,
	resultLabel: string,
	challengeTimeoutLabel: string | null,
): string {
	if (challengeTimeoutLabel) {
		return (
			`"${nodeTitle}": el resultado "${resultLabel}" (rama roja) no tiene una conexión de salida configurada. ` +
			`Como el timeout de challenge (${challengeTimeoutLabel}) también lleva a este camino, si se cumple el tiempo ` +
			`límite la instancia se quedará sin ruta a seguir.`
		);
	}
	return `"${nodeTitle}": El resultado "${resultLabel}" no tiene una conexión de salida configurada`;
}

function validateChallengeResultConnections(
	node: WorkflowNode,
	config: ChallengeNodeConfig,
	edges: WorkflowEdge[],
	errors: ValidationError[],
	challengeTimeoutLabel: string | null = null,
) {
	const configuredResults = getConfiguredChallengeResults(config);
	if (configuredResults.length === 0) {
		return;
	}

	const outgoingEdges = edges.filter((edge) => edge.from === node.id);
	if (outgoingEdges.length === 0) {
		configuredResults.forEach((result) => {
			const metadata = CHALLENGE_RESULT_METADATA[result];
			const label = metadata?.label ?? result;
			const isRedBranch = metadata?.port === "bottom";
			errors.push({
				nodeId: node.id,
				message: isRedBranch
					? buildRedBranchMessage(node.title, label, challengeTimeoutLabel)
					: `"${node.title}": El resultado "${label}" no tiene una conexión de salida configurada`,
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
			const isRedBranch = metadata?.port === "bottom";
			errors.push({
				nodeId: node.id,
				message: isRedBranch
					? buildRedBranchMessage(node.title, label, challengeTimeoutLabel)
					: `"${node.title}": El resultado "${label}" no tiene una conexión de salida configurada`,
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

/**
 * Extended validation that includes async TypeScript syntax checks for
 * Transform (error) and Decision (warning) nodes, in addition to all the
 * structural checks performed by validateWorkflow().
 *
 * Use this in the editor's "Validate" action to give early feedback before
 * publishing.  The publish pipeline also runs validateNodeCodeSyntax()
 * independently inside generateWorkflowCodeWithProgress().
 */
export async function validateWorkflowWithSyntax(
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
	flags: Flag[] = [],
): Promise<ValidationError[]> {
	const errors = validateWorkflow(nodes, edges, flags);

	const syntaxChecks = nodes
		.filter(
			(n) =>
				(n.type === "Transform" && (n.config.code as string)?.trim()) ||
				(n.type === "Decision" && (n.config.condition as string)?.trim()),
		)
		.map(async (node) => {
			if (node.type === "Transform") {
				const result = await validateTransformCode(node.config.code as string);
				if (!result.valid) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}": código TypeScript inválido — ${result.error}`,
						severity: "error",
					});
				}
			} else if (node.type === "Decision") {
				const result = await validateConditionExpression(
					node.config.condition as string,
				);
				if (!result.valid) {
					errors.push({
						nodeId: node.id,
						message: `"${node.title}": condición inválida — ${result.error}`,
						severity: "warning",
					});
				}
			}
		});

	await Promise.all(syntaxChecks);
	return errors;
}
