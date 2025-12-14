"use client";

import { useState, useEffect } from "react";
import type {
	WorkflowNode,
	WorkflowEdge,
	Role,
	WorkflowMetadata,
	Flag,
	APIFailureHandling,
	StaleTimeoutConfig,
	ChallengeNodeConfig,
	ChallengeType,
	ChallengeDeliveryMethod,
	ChallengeRetryConfig,
} from "@/lib/workflow/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
	findNearestPreviousCheckpoint,
	findAllNearestPreviousCheckpoints,
	getCheckpointNode,
} from "@/lib/workflow/graph-utils";
import { getColorValue } from "@/lib/flag-manager";
import { cn } from "@/lib/utils";
import {
	STALE_SUPPORTED_NODE_TYPES,
	createDefaultChallengeConfig,
	DEFAULT_CHALLENGE_TIMEOUT,
	ROLE_OPTIONS,
	MAX_CHALLENGE_RETRIES,
	DEFAULT_CHALLENGE_RETRY_CONFIG,
} from "@/lib/workflow/types";

interface PropertiesPanelProps {
	selectedNode: WorkflowNode | undefined;
	selectedEdge: WorkflowEdge | undefined;
	workflowMetadata: WorkflowMetadata;
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	flags: Flag[];
	onUpdateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
	onUpdateEdge: (edgeId: string, updates: Partial<WorkflowEdge>) => void;
	onUpdateMetadata: (updates: Partial<WorkflowMetadata>) => void;
	onAddEdge: (edge: WorkflowEdge) => void;
	onDeleteEdge: (edgeId: string) => void;
	showWorkflowProperties: boolean;
	onCloseWorkflowProperties: () => void;
}

const NODES_WITH_ROLES = ["Form", "Challenge"];

const EDGE_COLORS = [
	{ name: "Predeterminado", value: "default" },
	{ name: "Azul", value: "rgb(59, 130, 246)" },
	{ name: "Verde", value: "rgb(34, 197, 94)" },
	{ name: "Rojo", value: "rgb(239, 68, 68)" },
	{ name: "Amarillo", value: "rgb(234, 179, 8)" },
	{ name: "Morado", value: "rgb(168, 85, 247)" },
	{ name: "Rosa", value: "rgb(236, 72, 153)" },
	{ name: "Naranja", value: "rgb(249, 115, 22)" },
];

const DEFAULT_STALE_TIMEOUT: StaleTimeoutConfig = {
	value: 24,
	unit: "hours",
};

const STALE_TIMEOUT_UNITS: Array<{
	label: string;
	value: StaleTimeoutConfig["unit"];
}> = [
	{ label: "Horas", value: "hours" },
	{ label: "Días", value: "days" },
];

const CHALLENGE_TYPE_OPTIONS: Array<{
	label: string;
	value: ChallengeType;
	description: string;
}> = [
	{
		label: "Aceptación",
		value: "acceptance",
		description: "El usuario debe aceptar términos, condiciones o formularios.",
	},
	{
		label: "Firma",
		value: "signature",
		description: "El usuario debe firmar documentos o acuerdos.",
	},
];

const CHALLENGE_DELIVERY_METHODS = [
	{ label: "Ninguno", value: "none" },
	{ label: "SMS", value: "sms" },
	{ label: "Email", value: "email" },
	{ label: "Ambos", value: "both" },
] as const;

const CHALLENGE_TIMEOUT_UNITS = [
	{ label: "Segundos", value: "seconds" },
	{ label: "Minutos", value: "minutes" },
	{ label: "Horas", value: "hours" },
	{ label: "Días", value: "days" },
] as const;

export function PropertiesPanel({
	selectedNode,
	selectedEdge,
	workflowMetadata,
	nodes,
	edges,
	flags,
	onUpdateNode,
	onUpdateEdge,
	onUpdateMetadata,
	onAddEdge,
	onDeleteEdge,
	showWorkflowProperties,
	onCloseWorkflowProperties,
}: PropertiesPanelProps) {
	// Estado local para el input de maxRetries del nodo API
	const [apiMaxRetriesInput, setApiMaxRetriesInput] = useState<string>("");

	// Sincronizar el estado local con el valor del nodo cuando cambia
	useEffect(() => {
		if (selectedNode?.type === "API") {
			const failureHandling = (selectedNode.config.failureHandling as
				| (APIFailureHandling & { checkpointId?: string })
				| undefined) || {
				onFailure: "stop",
				maxRetries: 0,
				retryCount: 0,
				cacheStrategy: "always-execute",
				timeout: 30000,
			};
			const maxRetries = failureHandling.maxRetries;
			// Normalizar: si es 0 o inválido, mostrar 1; si es válido (1 o 2), mostrar el valor
			if (maxRetries === 0 || maxRetries < 1 || maxRetries > 2) {
				setApiMaxRetriesInput("1");
			} else {
				setApiMaxRetriesInput(String(maxRetries));
			}
		}
	}, [selectedNode?.id, selectedNode?.config, selectedNode?.type]);

	useEffect(() => {
		if (selectedNode?.type !== "Challenge") {
			return;
		}
		const currentConfig = selectedNode.config as
			| ChallengeNodeConfig
			| undefined;
		if (!currentConfig || !currentConfig.challengeType) {
			onUpdateNode(selectedNode.id, { config: createDefaultChallengeConfig() });
			return;
		}

		// Migrar configuraciones antiguas a la nueva estructura
		const oldTypes = ["otp", "knowledge", "document"];
		if (oldTypes.includes(currentConfig.challengeType as string)) {
			// Migrar a 'acceptance' por defecto, preservando challengeTimeout y deliveryMethod si existen
			const migratedConfig: ChallengeNodeConfig = {
				challengeType: "acceptance",
				challengeTimeout:
					currentConfig.challengeTimeout ?? DEFAULT_CHALLENGE_TIMEOUT,
				deliveryMethod:
					(currentConfig as { deliveryMethod?: ChallengeDeliveryMethod })
						.deliveryMethod ?? "none",
			};
			onUpdateNode(selectedNode.id, { config: migratedConfig });
			return;
		} else if (
			currentConfig.challengeType !== "acceptance" &&
			currentConfig.challengeType !== "signature"
		) {
			// Si es un tipo desconocido, migrar a 'acceptance'
			const migratedConfig: ChallengeNodeConfig = {
				challengeType: "acceptance",
				challengeTimeout:
					currentConfig.challengeTimeout ?? DEFAULT_CHALLENGE_TIMEOUT,
				deliveryMethod:
					(currentConfig as { deliveryMethod?: ChallengeDeliveryMethod })
						.deliveryMethod ?? "none",
			};
			onUpdateNode(selectedNode.id, { config: migratedConfig });
			return;
		}

		if (!currentConfig.deliveryMethod) {
			onUpdateNode(selectedNode.id, {
				config: {
					...currentConfig,
					deliveryMethod: "none",
				},
			});
		}
	}, [
		selectedNode?.id,
		selectedNode?.type,
		selectedNode?.config,
		onUpdateNode,
	]);

	// Prioridad: Si showWorkflowProperties está activo, mostrar propiedades del flujo
	// (incluso si hay un nodo o edge seleccionado)
	if (showWorkflowProperties && !selectedNode && !selectedEdge) {
		return (
			<div className="w-80 border-l border-border bg-card overflow-hidden flex flex-col">
				<div className="border-b border-border p-4 flex items-center justify-between flex-shrink-0">
					<h2 className="font-semibold">Propiedades del Flujo</h2>
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6"
						onClick={onCloseWorkflowProperties}
						title="Cerrar"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</Button>
				</div>

				<ScrollArea className="flex-1 overflow-y-auto overflow-x-hidden">
					<div className="space-y-4 p-4">
						{/* Workflow Name */}
						<div className="space-y-2">
							<Label htmlFor="workflow-name">Nombre del Flujo</Label>
							<Input
								id="workflow-name"
								value={workflowMetadata.name}
								onChange={(e) => onUpdateMetadata({ name: e.target.value })}
								placeholder="Mi Flujo de Crédito"
							/>
						</div>

						{/* Workflow Description */}
						<div className="space-y-2">
							<Label htmlFor="workflow-description">Descripción</Label>
							<Textarea
								id="workflow-description"
								value={workflowMetadata.description}
								onChange={(e) =>
									onUpdateMetadata({ description: e.target.value })
								}
								placeholder="Descripción del flujo de trabajo..."
								rows={4}
							/>
						</div>

						{/* Version */}
						<div className="space-y-2">
							<Label htmlFor="workflow-version">Versión</Label>
							<Input
								id="workflow-version"
								value={workflowMetadata.version}
								onChange={(e) => onUpdateMetadata({ version: e.target.value })}
								placeholder="1.0.0"
							/>
						</div>

						{/* Author */}
						<div className="space-y-2">
							<Label htmlFor="workflow-author">Autor</Label>
							<Input
								id="workflow-author"
								value={workflowMetadata.author}
								onChange={(e) => onUpdateMetadata({ author: e.target.value })}
								placeholder="Nombre del autor"
							/>
						</div>

						{/* Tags */}
						<div className="space-y-2">
							<Label htmlFor="workflow-tags">
								Etiquetas (separadas por comas)
							</Label>
							<Input
								id="workflow-tags"
								value={workflowMetadata.tags.join(", ")}
								onChange={(e) =>
									onUpdateMetadata({
										tags: e.target.value
											.split(",")
											.map((t) => t.trim())
											.filter(Boolean),
									})
								}
								placeholder="crédito, aprobación, automático"
							/>
						</div>

						{/* Timestamps */}
						<div className="space-y-2">
							<Label>Información de Fechas</Label>
							<div className="rounded-md bg-muted p-3 text-xs">
								<div className="space-y-1">
									<div>
										<span className="font-medium">Creado:</span>{" "}
										{new Date(workflowMetadata.createdAt).toLocaleString(
											"es-MX",
										)}
									</div>
									<div>
										<span className="font-medium">Actualizado:</span>{" "}
										{new Date(workflowMetadata.updatedAt).toLocaleString(
											"es-MX",
										)}
									</div>
								</div>
							</div>
						</div>

						{/* Help Text */}
						<div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
							<p className="font-medium">Información:</p>
							<p className="mt-1">
								Estas propiedades describen el flujo de trabajo completo.
								Selecciona un nodo o flecha para editar sus propiedades
								específicas.
							</p>
						</div>
					</div>
				</ScrollArea>
			</div>
		);
	}

	if (selectedEdge) {
		return (
			<div className="w-80 border-l border-border bg-card overflow-hidden flex flex-col">
				<div className="border-b border-border p-4 flex-shrink-0">
					<h2 className="font-semibold">Propiedades de Flecha</h2>
				</div>

				<ScrollArea className="flex-1 overflow-y-auto overflow-x-hidden">
					<div className="space-y-4 p-4">
						{/* Edge Label */}
						<div className="space-y-2">
							<Label htmlFor="edge-label">Etiqueta</Label>
							<Input
								id="edge-label"
								value={selectedEdge.label || ""}
								onChange={(e) =>
									onUpdateEdge(selectedEdge.id, {
										label: e.target.value || null,
									})
								}
								placeholder="Etiqueta de la flecha"
							/>
						</div>

						{/* Edge Color */}
						<div className="space-y-2">
							<Label htmlFor="edge-color">Color</Label>
							<Select
								value={selectedEdge.color || "default"}
								onValueChange={(value) =>
									onUpdateEdge(selectedEdge.id, {
										color: value === "default" ? undefined : value,
									})
								}
							>
								<SelectTrigger id="edge-color">
									<SelectValue placeholder="Seleccionar color" />
								</SelectTrigger>
								<SelectContent>
									{EDGE_COLORS.map((color) => (
										<SelectItem key={color.value} value={color.value}>
											<div className="flex items-center gap-2">
												{color.value !== "default" && (
													<div
														className="h-4 w-4 rounded-full border"
														style={{ backgroundColor: color.value }}
													/>
												)}
												{color.name}
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Edge Thickness */}
						<div className="space-y-2">
							<Label htmlFor="edge-thickness">
								Grosor: {selectedEdge.thickness || 2}px
							</Label>
							<Slider
								id="edge-thickness"
								min={1}
								max={5}
								step={0.5}
								value={[selectedEdge.thickness || 2]}
								onValueChange={(value) =>
									onUpdateEdge(selectedEdge.id, { thickness: value[0] })
								}
								className="w-full"
							/>
						</div>

						{/* Visual Preview */}
						<div className="space-y-2">
							<Label>Vista Previa</Label>
							<div className="flex h-20 items-center justify-center rounded-md border bg-muted/50 p-4">
								<svg width="200" height="40" className="overflow-visible">
									<defs>
										<marker
											id="preview-arrow"
											markerWidth="10"
											markerHeight="10"
											refX="9"
											refY="3"
											orient="auto"
											markerUnits="strokeWidth"
										>
											<polygon
												points="0 0, 10 3, 0 6"
												fill={selectedEdge.color || "var(--muted-foreground)"}
											/>
										</marker>
									</defs>
									<path
										d="M 10 20 L 190 20"
										stroke={selectedEdge.color || "var(--muted-foreground)"}
										strokeWidth={selectedEdge.thickness || 2}
										fill="none"
										markerEnd="url(#preview-arrow)"
									/>
									{selectedEdge.label && (
										<text
											x="100"
											y="12"
											textAnchor="middle"
											className="fill-foreground text-xs font-medium"
										>
											{selectedEdge.label}
										</text>
									)}
								</svg>
							</div>
						</div>

						{/* Help Text */}
						<div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
							<p className="font-medium">Atajos:</p>
							<ul className="mt-1 space-y-1">
								<li>• Click: Seleccionar flecha</li>
								<li>• Shift + Click: Eliminar flecha</li>
								<li>• Delete: Eliminar seleccionada</li>
							</ul>
						</div>
					</div>
				</ScrollArea>
			</div>
		);
	}

	// Si no hay nodo ni edge seleccionado, solo mostrar si showWorkflowProperties está activo
	if (!selectedNode && !selectedEdge) {
		if (!showWorkflowProperties) {
			return null;
		}
		// Mostrar propiedades del flujo (ya está renderizado arriba)
		// Este return nunca se alcanzará porque ya retornamos arriba, pero lo dejamos para claridad
		return null;
	}

	// Si llegamos aquí, hay un nodo seleccionado (selectedEdge ya se manejó arriba)
	if (!selectedNode) {
		return null;
	}

	const handleRoleToggle = (role: Role) => {
		const newRoles = selectedNode.roles.includes(role)
			? selectedNode.roles.filter((r) => r !== role)
			: [...selectedNode.roles, role];
		onUpdateNode(selectedNode.id, { roles: newRoles });
	};

	const supportsStaleTimeout = STALE_SUPPORTED_NODE_TYPES.includes(
		selectedNode.type,
	);
	const checkpointType =
		selectedNode.type === "Checkpoint"
			? (selectedNode.checkpointType ?? "normal")
			: null;
	const isSafeCheckpoint = checkpointType === "safe";
	const isChallengeNode = selectedNode.type === "Challenge";
	const challengeConfig = isChallengeNode
		? ((selectedNode.config as ChallengeNodeConfig | undefined) ??
			createDefaultChallengeConfig())
		: null;
	const challengeTimeout =
		challengeConfig?.challengeTimeout ?? DEFAULT_CHALLENGE_TIMEOUT;
	// Asegurar que selectedChallengeType siempre sea seguro, incluso si el tipo no existe
	const selectedChallengeType = challengeConfig
		? (CHALLENGE_TYPE_OPTIONS.find(
				(option) => option.value === challengeConfig.challengeType,
			) ?? null)
		: null;
	const challengeRetryConfig = challengeConfig?.retries;
	const challengeRetryMax =
		challengeRetryConfig?.maxRetries ??
		DEFAULT_CHALLENGE_RETRY_CONFIG.maxRetries;
	const challengeRetryRoles =
		challengeRetryConfig?.roles ?? DEFAULT_CHALLENGE_RETRY_CONFIG.roles;
	const challengeRetriesEnabled = Boolean(challengeRetryConfig);

	const setChallengeConfig = (nextConfig: ChallengeNodeConfig) => {
		onUpdateNode(selectedNode.id, { config: nextConfig });
	};

	const updateChallengeTimeout = (
		updates: Partial<ChallengeNodeConfig["challengeTimeout"]>,
	) => {
		if (!challengeConfig) return;
		setChallengeConfig({
			...challengeConfig,
			challengeTimeout: { ...challengeTimeout, ...updates },
		});
	};

	const handleChallengeTypeChange = (value: ChallengeType) => {
		const nextConfig = createDefaultChallengeConfig(value, {
			challengeTimeout,
		});
		setChallengeConfig(nextConfig);
	};

	const clampChallengeRetryCount = (value: number) =>
		Math.max(1, Math.min(MAX_CHALLENGE_RETRIES, value));

	const setChallengeRetries = (
		nextRetries: ChallengeRetryConfig | undefined,
	) => {
		if (!challengeConfig) return;
		if (!nextRetries) {
			const restConfig = { ...challengeConfig };
			delete restConfig.retries;
			setChallengeConfig(restConfig as ChallengeNodeConfig);
			return;
		}
		setChallengeConfig({
			...challengeConfig,
			retries: {
				maxRetries: clampChallengeRetryCount(nextRetries.maxRetries),
				roles: Array.from(new Set(nextRetries.roles)),
			},
		});
	};

	const enableChallengeRetries = () => {
		const seed = challengeRetryConfig ?? DEFAULT_CHALLENGE_RETRY_CONFIG;
		setChallengeRetries({
			maxRetries: seed.maxRetries,
			roles: [...seed.roles],
		});
	};

	const disableChallengeRetries = () => {
		setChallengeRetries(undefined);
	};

	const handleChallengeRetryCountChange = (rawValue: string) => {
		if (!challengeRetryConfig) return;
		const parsed = Number.parseInt(rawValue, 10);
		const normalized = Number.isNaN(parsed)
			? DEFAULT_CHALLENGE_RETRY_CONFIG.maxRetries
			: clampChallengeRetryCount(parsed);
		setChallengeRetries({
			...challengeRetryConfig,
			maxRetries: normalized,
		});
	};

	const handleChallengeRetryRoleToggle = (role: Role) => {
		if (!challengeRetryConfig) return;
		const roles = challengeRetryConfig.roles.includes(role)
			? challengeRetryConfig.roles.filter((item) => item !== role)
			: [...challengeRetryConfig.roles, role];
		setChallengeRetries({
			...challengeRetryConfig,
			roles,
		});
	};

	const handleStaleToggle = (enabled: boolean) => {
		if (enabled) {
			onUpdateNode(selectedNode.id, {
				staleTimeout: selectedNode.staleTimeout ?? DEFAULT_STALE_TIMEOUT,
			});
			return;
		}
		onUpdateNode(selectedNode.id, { staleTimeout: null });
	};

	const updateStaleTimeout = (updates: Partial<StaleTimeoutConfig>) => {
		if (!selectedNode.staleTimeout) return;
		onUpdateNode(selectedNode.id, {
			staleTimeout: { ...selectedNode.staleTimeout, ...updates },
		});
	};

	const handleStaleDurationChange = (value: string) => {
		if (!selectedNode.staleTimeout) return;
		const parsedValue = Number.parseInt(value, 10);
		if (Number.isNaN(parsedValue)) return;
		updateStaleTimeout({ value: Math.max(1, parsedValue) });
	};

	const handleStaleDurationBlur = (value: string) => {
		if (!selectedNode.staleTimeout) return;
		if (value === "") {
			updateStaleTimeout({ value: DEFAULT_STALE_TIMEOUT.value });
		}
	};

	const handleStaleUnitChange = (unit: StaleTimeoutConfig["unit"]) => {
		if (!selectedNode.staleTimeout) return;
		updateStaleTimeout({ unit });
	};

	return (
		<div className="w-80 border-l border-border bg-card overflow-hidden flex flex-col">
			<div className="border-b border-border p-4 flex-shrink-0">
				<h2 className="font-semibold">Propiedades de Nodo</h2>
			</div>

			<ScrollArea className="flex-1 overflow-y-auto overflow-x-hidden">
				<div className="space-y-4 p-4">
					{/* Title */}
					<div className="space-y-2 w-full">
						<Label htmlFor="title">Título</Label>
						<Input
							id="title"
							value={selectedNode.title}
							onChange={(e) =>
								onUpdateNode(selectedNode.id, { title: e.target.value })
							}
							placeholder="Título del nodo"
							className="w-full"
						/>
					</div>

					{/* Description */}
					<div className="space-y-2 w-full">
						<Label htmlFor="description">Descripción</Label>
						<Textarea
							id="description"
							value={selectedNode.description}
							onChange={(e) =>
								onUpdateNode(selectedNode.id, { description: e.target.value })
							}
							placeholder="Descripción del nodo"
							rows={3}
							className="w-full"
						/>
					</div>

					{supportsStaleTimeout && (
						<div className="space-y-3 rounded-md border border-border/60 p-3">
							<div className="flex items-center justify-between gap-4">
								<div>
									<Label htmlFor="stale-toggle">Timeout Stale</Label>
									<p className="text-xs text-muted-foreground">
										Activa un recordatorio para nodos que llevan mucho tiempo
										sin resolverse.
									</p>
								</div>
								<Switch
									id="stale-toggle"
									checked={Boolean(selectedNode.staleTimeout)}
									onCheckedChange={handleStaleToggle}
								/>
							</div>

							{selectedNode.staleTimeout && (
								<div className="grid gap-3 md:grid-cols-2">
									<div className="space-y-1">
										<Label htmlFor="stale-duration">Duración (valor)</Label>
										<Input
											id="stale-duration"
											type="number"
											min={1}
											value={selectedNode.staleTimeout.value}
											onChange={(event) =>
												handleStaleDurationChange(event.target.value)
											}
											onBlur={(event) =>
												handleStaleDurationBlur(event.target.value)
											}
										/>
									</div>
									<div className="space-y-1">
										<Label htmlFor="stale-unit">Unidad</Label>
										<Select
											value={selectedNode.staleTimeout.unit}
											onValueChange={(value) =>
												handleStaleUnitChange(
													value as StaleTimeoutConfig["unit"],
												)
											}
											data-testid="stale-unit-select"
										>
											<SelectTrigger id="stale-unit">
												<SelectValue placeholder="Selecciona unidad" />
											</SelectTrigger>
											<SelectContent>
												{STALE_TIMEOUT_UNITS.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>
							)}
						</div>
					)}

					{NODES_WITH_ROLES.includes(selectedNode.type) && (
						<div className="space-y-2">
							<Label>Roles Responsables</Label>
							<div className="space-y-2">
								{ROLE_OPTIONS.map((role) => (
									<div key={role} className="flex items-center space-x-2">
										<Checkbox
											id={`role-${role}`}
											checked={selectedNode.roles.includes(role)}
											onCheckedChange={() => handleRoleToggle(role)}
										/>
										<label
											htmlFor={`role-${role}`}
											className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
										>
											{role}
										</label>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Type-specific configuration */}
					{selectedNode.type === "Form" && (
						<div className="space-y-2">
							<Label htmlFor="form-select">Formulario</Label>
							<Select
								value={selectedNode.config.formId as string}
								onValueChange={(value) =>
									onUpdateNode(selectedNode.id, {
										config: { ...selectedNode.config, formId: value },
									})
								}
							>
								<SelectTrigger id="form-select">
									<SelectValue placeholder="Seleccionar formulario" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="form-1">
										Formulario de Solicitud
									</SelectItem>
									<SelectItem value="form-2">
										Formulario de Verificación
									</SelectItem>
									<SelectItem value="form-3">
										Formulario de Documentos
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					)}

					{selectedNode.type === "Decision" && (
						<div className="space-y-2">
							<Label htmlFor="condition">Condición</Label>
							<Textarea
								id="condition"
								value={(selectedNode.config.condition as string) || ""}
								onChange={(e) =>
									onUpdateNode(selectedNode.id, {
										config: {
											...selectedNode.config,
											condition: e.target.value,
										},
									})
								}
								placeholder="Ej: creditScore > 700"
								rows={3}
							/>
						</div>
					)}

					{selectedNode.type === "Transform" && (
						<div className="space-y-2">
							<Label htmlFor="transform-code">Código TypeScript</Label>
							<Textarea
								id="transform-code"
								value={(selectedNode.config.code as string) || ""}
								onChange={(e) =>
									onUpdateNode(selectedNode.id, {
										config: { ...selectedNode.config, code: e.target.value },
									})
								}
								placeholder="// Transformar datos aquí"
								rows={6}
								className="font-mono text-xs"
							/>
							<Button size="sm" variant="secondary" className="w-full">
								Validar Código
							</Button>
						</div>
					)}

					{selectedNode.type === "API" &&
						(() => {
							const failureHandling = (selectedNode.config.failureHandling as
								| (APIFailureHandling & { checkpointId?: string })
								| undefined) || {
								onFailure: "stop",
								maxRetries: 0,
								retryCount: 0,
								cacheStrategy: "always-execute",
								timeout: 30000,
							};
							const allCheckpoints = findAllNearestPreviousCheckpoints(
								selectedNode.id,
								nodes,
								edges,
							);
							const hasCheckpoint = allCheckpoints.length > 0;
							const hasMultipleCheckpoints = allCheckpoints.length > 1;
							// Usar el checkpoint seleccionado en config o el primero disponible
							const selectedCheckpointId =
								(failureHandling.checkpointId as string) ||
								allCheckpoints[0] ||
								null;

							return (
								<div className="space-y-4">
									{/* Configuración básica de API */}
									<div className="space-y-2">
										<Label htmlFor="api-method">Método</Label>
										<Select
											value={(selectedNode.config.method as string) || "GET"}
											onValueChange={(value) =>
												onUpdateNode(selectedNode.id, {
													config: { ...selectedNode.config, method: value },
												})
											}
										>
											<SelectTrigger id="api-method">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="GET">GET</SelectItem>
												<SelectItem value="POST">POST</SelectItem>
												<SelectItem value="PUT">PUT</SelectItem>
												<SelectItem value="DELETE">DELETE</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label htmlFor="api-url">URL</Label>
										<Input
											id="api-url"
											value={(selectedNode.config.url as string) || ""}
											onChange={(e) =>
												onUpdateNode(selectedNode.id, {
													config: {
														...selectedNode.config,
														url: e.target.value,
													},
												})
											}
											placeholder="https://api.example.com/endpoint"
										/>
									</div>

									<Button size="sm" variant="secondary" className="w-full">
										Probar con Mock
									</Button>

									{/* Separador */}
									<div className="border-t border-border pt-4">
										<h3 className="mb-3 font-semibold">Manejo de Fallos</h3>

										{/* Estrategia ante fallo */}
										<div className="space-y-2">
											<Label htmlFor="api-on-failure">
												Si la llamada falla:
											</Label>
											<Select
												value={failureHandling.onFailure}
												onValueChange={(value) => {
													// Buscar TODOS los edges salientes del nodo
													const outgoingEdges = edges.filter(
														(e) => e.from === selectedNode.id,
													);

													// Si cambia a stop, eliminar TODOS los edges salientes PRIMERO (será terminal)
													if (value === "stop") {
														outgoingEdges.forEach((edge) =>
															onDeleteEdge(edge.id),
														);
														onUpdateNode(selectedNode.id, {
															config: {
																...selectedNode.config,
																failureHandling: {
																	...failureHandling,
																	onFailure: value,
																	checkpointId: undefined, // Limpiar checkpointId si existe
																},
															},
														});
														return;
													}

													// Si cambia a return-to-checkpoint, guardar el checkpoint ID en config (sin crear edge visible)
													// NOTA: No eliminamos edges salientes porque el flujo normal de éxito debe continuar
													// Solo en caso de fallo regresará al checkpoint
													if (
														value === "return-to-checkpoint" &&
														hasCheckpoint
													) {
														onUpdateNode(selectedNode.id, {
															config: {
																...selectedNode.config,
																failureHandling: {
																	...failureHandling,
																	onFailure: value,
																	checkpointId:
																		selectedCheckpointId || allCheckpoints[0], // Guardar referencia al checkpoint
																},
															},
														});
														return;
													}

													// Si cambia de return-to-checkpoint a otra opción, limpiar checkpointId
													if (
														failureHandling.onFailure ===
															"return-to-checkpoint" &&
														value !== "return-to-checkpoint"
													) {
														onUpdateNode(selectedNode.id, {
															config: {
																...selectedNode.config,
																failureHandling: {
																	...failureHandling,
																	onFailure: value,
																	checkpointId: undefined,
																},
															},
														});
														return;
													}

													// Para cualquier otra opción (continue, retry)
													onUpdateNode(selectedNode.id, {
														config: {
															...selectedNode.config,
															failureHandling: {
																...failureHandling,
																onFailure: value,
															},
														},
													});
												}}
											>
												<SelectTrigger id="api-on-failure">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="stop">
														❌ Detener Workflow
													</SelectItem>
													<SelectItem value="continue">
														⚠️ Continuar (ignorar error)
													</SelectItem>
													<SelectItem value="retry">
														🔄 Reintentar en este nodo
													</SelectItem>
													<SelectItem
														value="return-to-checkpoint"
														disabled={!hasCheckpoint}
													>
														⏮️ Regresar a Checkpoint
													</SelectItem>
												</SelectContent>
											</Select>
											<p className="text-xs text-muted-foreground">
												{failureHandling.onFailure === "stop" &&
													"El workflow se detendrá inmediatamente con error"}
												{failureHandling.onFailure === "continue" &&
													"El workflow continuará con datos vacíos o error"}
												{failureHandling.onFailure === "retry" &&
													"Se reintentará la llamada en el mismo nodo"}
												{failureHandling.onFailure === "return-to-checkpoint" &&
													"Regresará al checkpoint anterior más próximo"}
											</p>
										</div>

										{/* Reintentos - Solo para retry */}
										{failureHandling.onFailure === "retry" && (
											<div className="mt-3 space-y-2">
												<Label htmlFor="api-max-retries">
													Número de Reintentos
												</Label>
												<Input
													id="api-max-retries"
													type="number"
													min={1}
													max={2}
													value={apiMaxRetriesInput}
													onChange={(e) => {
														const inputValue = e.target.value;
														// Permitir que el usuario borre el valor temporalmente
														setApiMaxRetriesInput(inputValue);

														// Si el campo está vacío, no actualizar el estado del nodo
														if (inputValue === "") {
															return;
														}

														const parsedValue = Number.parseInt(inputValue, 10);
														// Solo aceptar valores válidos entre 1 y 2
														if (!Number.isNaN(parsedValue)) {
															// Si el valor es menor a 1, establecer 1
															// Si el valor es mayor a 2, establecer 2
															const value = Math.min(
																2,
																Math.max(1, parsedValue),
															);
															onUpdateNode(selectedNode.id, {
																config: {
																	...selectedNode.config,
																	failureHandling: {
																		...failureHandling,
																		maxRetries: value,
																	},
																},
															});
														}
													}}
													onBlur={(e) => {
														// Cuando pierde el foco, asegurar que tenga un valor válido (1 o 2)
														const inputValue = e.target.value;
														if (inputValue === "") {
															// Si está vacío, establecer 1
															setApiMaxRetriesInput("1");
															onUpdateNode(selectedNode.id, {
																config: {
																	...selectedNode.config,
																	failureHandling: {
																		...failureHandling,
																		maxRetries: 1,
																	},
																},
															});
															return;
														}
														const parsedValue = Number.parseInt(inputValue, 10);
														if (
															Number.isNaN(parsedValue) ||
															parsedValue < 1 ||
															parsedValue > 2
														) {
															// Si es inválido, establecer 1
															setApiMaxRetriesInput("1");
															onUpdateNode(selectedNode.id, {
																config: {
																	...selectedNode.config,
																	failureHandling: {
																		...failureHandling,
																		maxRetries: 1,
																	},
																},
															});
														} else {
															// Si es válido, asegurar que el estado local esté sincronizado
															setApiMaxRetriesInput(String(parsedValue));
														}
													}}
												/>
												<p className="text-xs text-muted-foreground">
													Máximo 2 reintentos. Después de agotarlos, el workflow
													se detendrá.
												</p>
											</div>
										)}

										{/* Estrategia de caché */}
										<div className="mt-3 space-y-2">
											<Label htmlFor="api-cache-strategy">
												Estrategia de Ejecución
											</Label>
											<Select
												value={failureHandling.cacheStrategy}
												onValueChange={(value) =>
													onUpdateNode(selectedNode.id, {
														config: {
															...selectedNode.config,
															failureHandling: {
																...failureHandling,
																cacheStrategy: value,
															},
														},
													})
												}
											>
												<SelectTrigger id="api-cache-strategy">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="always-execute">
														Siempre Ejecutar
													</SelectItem>
													<SelectItem value="cache-until-checkpoint-reset">
														Cachear hasta reinicio de checkpoint
													</SelectItem>
													<SelectItem value="cache-until-workflow-end">
														Cachear para todo el workflow
													</SelectItem>
												</SelectContent>
											</Select>
											<p className="text-xs text-muted-foreground">
												{failureHandling.cacheStrategy === "always-execute" &&
													"Se ejecutará cada vez que el flujo pase por este nodo"}
												{failureHandling.cacheStrategy ===
													"cache-until-checkpoint-reset" &&
													"Se ejecutará solo una vez por ciclo de checkpoint"}
												{failureHandling.cacheStrategy ===
													"cache-until-workflow-end" &&
													"Se ejecutará solo una vez en todo el workflow"}
											</p>
										</div>

										{/* Timeout */}
										<div className="mt-3 space-y-2">
											<Label htmlFor="api-timeout">Timeout (segundos)</Label>
											<Input
												id="api-timeout"
												type="number"
												min={5}
												max={300}
												value={failureHandling.timeout / 1000}
												onChange={(e) => {
													const seconds = Math.min(
														300,
														Math.max(5, Number.parseInt(e.target.value) || 30),
													);
													onUpdateNode(selectedNode.id, {
														config: {
															...selectedNode.config,
															failureHandling: {
																...failureHandling,
																timeout: seconds * 1000,
															},
														},
													});
												}}
											/>
											<p className="text-xs text-muted-foreground">
												Tiempo máximo de espera para la respuesta (5-300
												segundos)
											</p>
										</div>

										{/* Selector de checkpoint si return-to-checkpoint */}
										{failureHandling.onFailure === "return-to-checkpoint" &&
											hasCheckpoint && (
												<div className="mt-3 space-y-2">
													<Label htmlFor="api-checkpoint-select">
														{hasMultipleCheckpoints
															? "Seleccionar Checkpoint de Destino"
															: "Checkpoint de Destino"}
													</Label>
													{hasMultipleCheckpoints ? (
														<Select
															value={selectedCheckpointId || ""}
															onValueChange={(value) => {
																onUpdateNode(selectedNode.id, {
																	config: {
																		...selectedNode.config,
																		failureHandling: {
																			...failureHandling,
																			checkpointId: value,
																		},
																	},
																});
															}}
														>
															<SelectTrigger id="api-checkpoint-select">
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																{allCheckpoints.map((cpId) => {
																	const checkpoint = getCheckpointNode(
																		cpId,
																		nodes,
																	);
																	const displayName =
																		checkpoint?.title ||
																		(checkpoint?.config
																			.checkpointName as string) ||
																		cpId;
																	return (
																		<SelectItem key={cpId} value={cpId}>
																			{displayName}
																		</SelectItem>
																	);
																})}
															</SelectContent>
														</Select>
													) : (
														<div className="rounded-md bg-muted p-3 text-sm">
															<p className="text-xs text-muted-foreground">
																{(() => {
																	const checkpoint = getCheckpointNode(
																		selectedCheckpointId,
																		nodes,
																	);
																	return (
																		checkpoint?.title ||
																		(checkpoint?.config
																			.checkpointName as string) ||
																		selectedCheckpointId ||
																		"N/A"
																	);
																})()}
															</p>
														</div>
													)}
													{hasMultipleCheckpoints && (
														<p className="text-xs text-muted-foreground">
															Hay múltiples checkpoints a la misma distancia.
															Selecciona el checkpoint al que deseas regresar.
														</p>
													)}
												</div>
											)}

										{/* Advertencia si return-to-checkpoint sin checkpoint */}
										{failureHandling.onFailure === "return-to-checkpoint" &&
											!hasCheckpoint && (
												<div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
													<p className="font-medium">
														⚠️ No hay checkpoint anterior disponible
													</p>
													<p className="mt-1 text-xs">
														Para usar esta opción, debe existir un checkpoint
														anterior en el flujo.
													</p>
												</div>
											)}

										{/* Info si stop (terminal) */}
										{failureHandling.onFailure === "stop" && (
											<div className="mt-3 rounded-md bg-muted p-3 text-sm text-muted-foreground">
												<p className="font-medium">ℹ️ Nodo Terminal</p>
												<p className="mt-1 text-xs">
													Este nodo no puede conectarse a otros nodos. El
													workflow terminará aquí en caso de fallo.
												</p>
											</div>
										)}
									</div>
								</div>
							);
						})()}

					{selectedNode.type === "Message" && (
						<div className="space-y-2">
							<div className="space-y-2">
								<Label htmlFor="message-channel">Canal</Label>
								<Select
									value={(selectedNode.config.channel as string) || "email"}
									onValueChange={(value) =>
										onUpdateNode(selectedNode.id, {
											config: { ...selectedNode.config, channel: value },
										})
									}
								>
									<SelectTrigger id="message-channel">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="email">Email</SelectItem>
										<SelectItem value="sms">SMS</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label htmlFor="message-template">Template</Label>
								<Textarea
									id="message-template"
									value={(selectedNode.config.template as string) || ""}
									onChange={(e) =>
										onUpdateNode(selectedNode.id, {
											config: {
												...selectedNode.config,
												template: e.target.value,
											},
										})
									}
									placeholder="Hola {{nombre}}, tu solicitud ha sido..."
									rows={4}
								/>
							</div>
						</div>
					)}

					{selectedNode.type === "Challenge" && challengeConfig && (
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="challenge-type">Tipo de challenge</Label>
								<Select
									value={
										challengeConfig.challengeType === "acceptance" ||
										challengeConfig.challengeType === "signature"
											? challengeConfig.challengeType
											: "acceptance"
									}
									onValueChange={(value) =>
										handleChallengeTypeChange(value as ChallengeType)
									}
								>
									<SelectTrigger id="challenge-type">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{CHALLENGE_TYPE_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{selectedChallengeType && (
									<p className="text-xs text-muted-foreground">
										{selectedChallengeType.description}
									</p>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="challenge-delivery">Canal de entrega</Label>
								<Select
									value={challengeConfig.deliveryMethod}
									onValueChange={(method) =>
										setChallengeConfig({
											...challengeConfig,
											deliveryMethod:
												method as typeof challengeConfig.deliveryMethod,
										})
									}
								>
									<SelectTrigger id="challenge-delivery" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{CHALLENGE_DELIVERY_METHODS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<p className="text-xs text-muted-foreground">
									Selecciona cómo se enviará el challenge (SMS, Email, Ambos o
									Ninguno).
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="challenge-timeout-value">
									Tiempo límite (challengeTimeout)
								</Label>
								<div className="grid gap-3 md:grid-cols-2">
									<div className="space-y-1 min-w-0">
										<Input
											id="challenge-timeout-value"
											type="number"
											min={1}
											value={challengeTimeout.value}
											onChange={(e) => {
												const value = Number.parseInt(e.target.value, 10);
												updateChallengeTimeout({
													value: Number.isNaN(value)
														? DEFAULT_CHALLENGE_TIMEOUT.value
														: Math.max(1, value),
												});
											}}
											className="w-full"
										/>
									</div>
									<div className="space-y-1 min-w-0">
										<Select
											value={challengeTimeout.unit}
											onValueChange={(unit) =>
												updateChallengeTimeout({
													unit: unit as ChallengeNodeConfig["challengeTimeout"]["unit"],
												})
											}
										>
											<SelectTrigger
												id="challenge-timeout-unit"
												className="w-full"
											>
												<SelectValue placeholder="Selecciona unidad" />
											</SelectTrigger>
											<SelectContent>
												{CHALLENGE_TIMEOUT_UNITS.map((unit) => (
													<SelectItem key={unit.value} value={unit.value}>
														{unit.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>
								<p className="text-xs text-muted-foreground">
									Tiempo en el que debe resolverse el challenge o durante el
									cual es válido.
								</p>
							</div>

							<div className="space-y-3 rounded-md border border-border/60 p-3">
								<div className="flex items-center justify-between gap-4">
									<div>
										<Label htmlFor="challenge-retry-toggle">Reintentos</Label>
										<p className="text-xs text-muted-foreground">
											Controla si este challenge permite reintentos y quiénes
											pueden ejecutarlos.
										</p>
									</div>
									<Switch
										id="challenge-retry-toggle"
										checked={challengeRetriesEnabled}
										onCheckedChange={(checked) =>
											checked
												? enableChallengeRetries()
												: disableChallengeRetries()
										}
									/>
								</div>

								{challengeRetryConfig && (
									<div className="space-y-3">
										<div className="space-y-1">
											<Label htmlFor="challenge-retry-count">
												Cantidad de reintentos
											</Label>
											<Input
												id="challenge-retry-count"
												type="number"
												min={1}
												max={MAX_CHALLENGE_RETRIES}
												value={challengeRetryMax}
												onChange={(event) =>
													handleChallengeRetryCountChange(event.target.value)
												}
											/>
											<p className="text-xs text-muted-foreground">
												Máximo {MAX_CHALLENGE_RETRIES} reintentos permitidos.
											</p>
										</div>

										<div className="space-y-2">
											<Label>Roles responsables (reintentos)</Label>
											<div className="space-y-2">
												{ROLE_OPTIONS.map((role) => (
													<div
														key={role}
														className="flex items-center space-x-2"
													>
														<Checkbox
															id={`retry-role-${role}`}
															data-testid={`retry-role-${role}`}
															checked={challengeRetryRoles.includes(role)}
															onCheckedChange={() =>
																handleChallengeRetryRoleToggle(role)
															}
														/>
														<label
															htmlFor={`retry-role-${role}`}
															className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
														>
															{role}
														</label>
													</div>
												))}
											</div>
											{challengeRetryRoles.length === 0 && (
												<p className="text-xs text-muted-foreground">
													Selecciona al menos un rol autorizado para ejecutar
													reintentos.
												</p>
											)}
										</div>
									</div>
								)}
							</div>

							<div className="rounded-md bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
								<p className="font-medium">Notas</p>
								<p className="mt-1">
									Los challenges de aceptación y firma permiten pausar el flujo
									hasta que el usuario complete la acción requerida (aceptar
									términos o firmar documentos) respetando el timeout
									configurado.
								</p>
								<p className="mt-2">
									<span className="font-semibold">
										Comportamiento en caso de fallo:
									</span>{" "}
									Si el challenge falla (timeout o rechazo), el flujo retorna
									automáticamente al checkpoint previo más próximo.
								</p>
							</div>
						</div>
					)}

					{selectedNode.type === "Checkpoint" && (
						<div className="space-y-3">
							<div className="space-y-3 rounded-md border border-border/60 p-3">
								<div className="flex items-center justify-between gap-4">
									<div>
										<Label htmlFor="checkpoint-safe-toggle">
											Checkpoint seguro
										</Label>
										<p className="text-xs text-muted-foreground">
											Marca este checkpoint como &quot;safe&quot; para usarlo
											como etapa protegida.
										</p>
									</div>
									<Switch
										id="checkpoint-safe-toggle"
										checked={isSafeCheckpoint}
										onCheckedChange={(checked) =>
											onUpdateNode(selectedNode.id, {
												checkpointType: checked ? "safe" : "normal",
											})
										}
									/>
								</div>
								<div
									data-testid="checkpoint-safe-status"
									className={cn(
										"rounded-md p-3 text-xs",
										isSafeCheckpoint
											? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
											: "bg-muted text-muted-foreground",
									)}
								>
									<p
										className={cn(
											"font-medium",
											isSafeCheckpoint
												? "text-emerald-700 dark:text-emerald-200"
												: "text-foreground",
										)}
									>
										{isSafeCheckpoint
											? "Safe checkpoint activo"
											: "Checkpoint normal"}
									</p>
									<p className="mt-1">
										{isSafeCheckpoint
											? "Se usa para saltos controlados desde nodos especiales sin perder contexto."
											: "Funciona como checkpoint convencional dentro del flujo."}
									</p>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="checkpoint-name">Nombre del Checkpoint</Label>
								<Input
									id="checkpoint-name"
									value={(selectedNode.config.checkpointName as string) || ""}
									onChange={(e) =>
										onUpdateNode(selectedNode.id, {
											config: {
												...selectedNode.config,
												checkpointName: e.target.value,
											},
										})
									}
									placeholder="Ej: Verificación Inicial"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="checkpoint-notes">Notas</Label>
								<Textarea
									id="checkpoint-notes"
									value={(selectedNode.config.notes as string) || ""}
									onChange={(e) =>
										onUpdateNode(selectedNode.id, {
											config: { ...selectedNode.config, notes: e.target.value },
										})
									}
									placeholder="Notas sobre este checkpoint..."
									rows={3}
								/>
							</div>
						</div>
					)}

					{selectedNode.type === "FlagChange" && (
						<div className="space-y-4">
							<div className="space-y-1">
								<Label>Flags a Cambiar</Label>
								<p className="text-xs text-muted-foreground">
									Selecciona los flags que deseas cambiar en este nodo
								</p>
							</div>

							{flags.length === 0 ? (
								<div className="rounded-md bg-muted p-3 text-center text-sm text-muted-foreground">
									<p>No hay flags definidos</p>
									<p className="text-xs mt-1">
										Usa el botón &quot;Gestionar Flags&quot; en la barra
										superior para crear flags
									</p>
								</div>
							) : (
								<ScrollArea className={flags.length > 5 ? "h-64" : "max-h-64"}>
									<div className="space-y-2 pr-3">
										{flags.map((flag) => {
											const flagChanges =
												(selectedNode.config.flagChanges as
													| Array<{ flagId: string; optionId: string }>
													| undefined) || [];
											const currentChange = flagChanges.find(
												(fc) => fc.flagId === flag.id,
											);
											const isSelected = !!currentChange;
											const selectedOption = isSelected
												? flag.options.find(
														(opt) => opt.id === currentChange?.optionId,
													)
												: null;

											return (
												<div
													key={flag.id}
													className={cn(
														"border rounded-md p-2 transition-colors",
														isSelected && "bg-accent/50",
													)}
												>
													<div className="flex items-center gap-2">
														<Checkbox
															checked={isSelected}
															onCheckedChange={(checked) => {
																const currentFlagChanges =
																	(selectedNode.config.flagChanges as
																		| Array<{
																				flagId: string;
																				optionId: string;
																		  }>
																		| undefined) || [];
																if (checked) {
																	// Agregar flag con la primera opción por defecto
																	onUpdateNode(selectedNode.id, {
																		config: {
																			...selectedNode.config,
																			flagChanges: [
																				...currentFlagChanges,
																				{
																					flagId: flag.id,
																					optionId: flag.options[0].id,
																				},
																			],
																		},
																	});
																} else {
																	// Remover flag
																	onUpdateNode(selectedNode.id, {
																		config: {
																			...selectedNode.config,
																			flagChanges: currentFlagChanges.filter(
																				(fc) => fc.flagId !== flag.id,
																			),
																		},
																	});
																}
															}}
														/>
														<Label className="font-medium cursor-pointer flex-1 min-w-0">
															{flag.name}
														</Label>
														{isSelected && (
															<Select
																value={currentChange?.optionId || ""}
																onValueChange={(optionId) => {
																	const currentFlagChanges =
																		(selectedNode.config.flagChanges as
																			| Array<{
																					flagId: string;
																					optionId: string;
																			  }>
																			| undefined) || [];
																	onUpdateNode(selectedNode.id, {
																		config: {
																			...selectedNode.config,
																			flagChanges: currentFlagChanges.map(
																				(fc) =>
																					fc.flagId === flag.id
																						? { flagId: flag.id, optionId }
																						: fc,
																			),
																		},
																	});
																}}
															>
																<SelectTrigger className="h-8 w-auto min-w-[140px]">
																	<SelectValue>
																		{selectedOption && (
																			<div className="flex items-center gap-2">
																				<div
																					className="h-3 w-3 rounded-full flex-shrink-0"
																					style={{
																						backgroundColor: getColorValue(
																							selectedOption.color,
																						),
																					}}
																				/>
																				<span className="truncate">
																					{selectedOption.label}
																				</span>
																			</div>
																		)}
																	</SelectValue>
																</SelectTrigger>
																<SelectContent>
																	{flag.options.map((option) => (
																		<SelectItem
																			key={option.id}
																			value={option.id}
																		>
																			<div className="flex items-center gap-2">
																				<div
																					className="h-3 w-3 rounded-full flex-shrink-0"
																					style={{
																						backgroundColor: getColorValue(
																							option.color,
																						),
																					}}
																				/>
																				<span>{option.label}</span>
																			</div>
																		</SelectItem>
																	))}
																</SelectContent>
															</Select>
														)}
													</div>
												</div>
											);
										})}
									</div>
								</ScrollArea>
							)}

							{/* Preview de flags seleccionados */}
							{(() => {
								const flagChanges =
									(selectedNode.config.flagChanges as
										| Array<{ flagId: string; optionId: string }>
										| undefined) || [];
								if (flagChanges.length === 0) return null;

								return (
									<div className="rounded-md bg-muted p-2.5">
										<p className="text-xs font-medium mb-2">Preview:</p>
										<div className="flex flex-wrap gap-1.5">
											{flagChanges.map((flagChange) => {
												const flag = flags.find(
													(f) => f.id === flagChange.flagId,
												);
												const option = flag?.options.find(
													(opt) => opt.id === flagChange.optionId,
												);
												if (!flag || !option) return null;
												return (
													<span
														key={`${flagChange.flagId}-${flagChange.optionId}`}
														className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-white"
														style={{
															backgroundColor: getColorValue(option.color),
														}}
													>
														<span>{flag.name}:</span>
														<span>{option.label}</span>
													</span>
												);
											})}
										</div>
									</div>
								);
							})()}

							<div className="rounded-md bg-muted p-2.5 text-xs text-muted-foreground">
								<p className="font-medium mb-1">Información:</p>
								<p>
									Este nodo permite cambiar múltiples flags del workflow.
									Selecciona los flags que deseas modificar y elige la opción
									para cada uno.
								</p>
							</div>
						</div>
					)}

					{selectedNode.type === "Reject" &&
						(() => {
							const checkpointId = findNearestPreviousCheckpoint(
								selectedNode.id,
								nodes,
								edges,
							);
							const checkpoint = getCheckpointNode(checkpointId, nodes);
							const allowRetry =
								(selectedNode.config.allowRetry as boolean) === true;
							const existingEdge = edges.find(
								(e) => e.from === selectedNode.id,
							);

							const handleAllowRetryChange = (checked: boolean) => {
								if (checked) {
									// Activar reintentos: crear edge automáticamente hacia el checkpoint
									if (checkpointId && !existingEdge) {
										const newEdge: WorkflowEdge = {
											id: `edge-${Date.now()}`,
											from: selectedNode.id,
											to: checkpointId,
											label: "Reintento",
											color: "rgb(234, 179, 8)", // Amarillo para reintentos
											thickness: 3, // Más grueso para destacar
										};
										onAddEdge(newEdge);
									}
									onUpdateNode(selectedNode.id, {
										config: {
											...selectedNode.config,
											allowRetry: true,
											retryCount: selectedNode.config.retryCount || 0,
										},
									});
								} else {
									// Desactivar reintentos: eliminar edge si existe
									if (existingEdge) {
										onDeleteEdge(existingEdge.id);
									}
									onUpdateNode(selectedNode.id, {
										config: {
											...selectedNode.config,
											allowRetry: false,
										},
									});
								}
							};

							return (
								<div className="space-y-2">
									{!checkpointId ? (
										<div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
											<p className="font-medium">
												No hay checkpoint anterior disponible
											</p>
											<p className="mt-1 text-xs">
												Para habilitar reintentos, debe existir un checkpoint
												anterior en el flujo.
											</p>
										</div>
									) : (
										<>
											<div className="space-y-2">
												<div className="flex items-center justify-between">
													<Label htmlFor="allow-retry">
														Permitir Reintentos
													</Label>
													<Switch
														id="allow-retry"
														checked={allowRetry}
														onCheckedChange={handleAllowRetryChange}
													/>
												</div>
												<p className="text-xs text-muted-foreground">
													Permite que el flujo regrese al checkpoint anterior
													más próximo
												</p>
											</div>

											{allowRetry && (
												<>
													<div className="space-y-2">
														<Label htmlFor="max-retries">
															Número Máximo de Reintentos
														</Label>
														<Input
															id="max-retries"
															type="number"
															min={0}
															value={
																selectedNode.config.maxRetries === undefined ||
																selectedNode.config.maxRetries === null
																	? ""
																	: (selectedNode.config.maxRetries as number)
															}
															onChange={(e) => {
																const inputValue = e.target.value;
																// Permitir campo vacío temporalmente
																if (inputValue === "") {
																	onUpdateNode(selectedNode.id, {
																		config: {
																			...selectedNode.config,
																			maxRetries: undefined,
																		},
																	});
																	return;
																}
																const value = Number.parseInt(inputValue, 10);
																if (!Number.isNaN(value) && value >= 0) {
																	onUpdateNode(selectedNode.id, {
																		config: {
																			...selectedNode.config,
																			maxRetries: value,
																		},
																	});
																}
															}}
															onBlur={(e) => {
																// Cuando pierde el foco, si está vacío, establecer 0
																if (e.target.value === "") {
																	onUpdateNode(selectedNode.id, {
																		config: {
																			...selectedNode.config,
																			maxRetries: 0,
																		},
																	});
																}
															}}
															placeholder="0 = ilimitados"
														/>
														<p className="text-xs text-muted-foreground">
															{(selectedNode.config.maxRetries as number) ===
																0 ||
															selectedNode.config.maxRetries === undefined ||
															selectedNode.config.maxRetries === null
																? "0 = ilimitados (sin límite de reintentos)"
																: "Número máximo de veces que se puede reintentar"}
														</p>
													</div>

													{checkpoint && (
														<div className="rounded-md bg-muted p-3 text-sm">
															<p className="font-medium">
																Checkpoint de destino:
															</p>
															<p className="mt-1 text-xs text-muted-foreground">
																{checkpoint.title ||
																	(checkpoint.config
																		.checkpointName as string) ||
																	checkpoint.id}
															</p>
														</div>
													)}
												</>
											)}
										</>
									)}
								</div>
							);
						})()}
				</div>
			</ScrollArea>
		</div>
	);
}
