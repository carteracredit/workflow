"use client";

import type React from "react";
import { useRef, useState, useEffect } from "react";
import type {
	WorkflowNode,
	ValidationError,
	Flag,
	APIFailureHandling,
	ChallengeNodeConfig,
	ChallengeType,
} from "@/lib/workflow/types";
import {
	Play,
	XCircle,
	Circle,
	FileText,
	GitBranch,
	Code,
	Globe,
	Mail,
	AlertCircle,
	Flag as FlagIcon,
	Merge,
	Tag,
	Clock3,
	ShieldCheck,
	Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getColorValue } from "@/lib/flag-manager";

interface NodeRendererProps {
	node: WorkflowNode;
	selected: boolean;
	errors: ValidationError[];
	connecting: boolean;
	highlightCheckpoint?: boolean; // Para iluminar checkpoint cuando API apunta a él
	flags?: Flag[]; // Flags disponibles para mostrar en nodos FlagChange
	onMouseDown: (e: React.MouseEvent) => void;
	onConnectorClick: (
		position: { x: number; y: number },
		e: React.MouseEvent,
		port?: "top" | "bottom" | "middle",
	) => void;
}

const NODE_ICONS = {
	Start: Play,
	Reject: XCircle,
	End: Circle,
	Form: FileText,
	Decision: GitBranch,
	Transform: Code,
	API: Globe,
	Message: Mail,
	Challenge: Shield,
	Checkpoint: FlagIcon,
	Join: Merge,
	FlagChange: Tag,
};

export const NODE_BG_COLORS = {
	Start: "var(--node-bg-start)",
	Reject: "var(--node-bg-end-reject)",
	End: "var(--node-bg-end)",
	Form: "var(--node-bg-form)",
	Decision: "var(--node-bg-decision)",
	Transform: "var(--node-bg-transform)",
	API: "var(--node-bg-api)",
	Message: "var(--node-bg-message)",
	Challenge: "var(--node-bg-challenge)",
	Checkpoint: "var(--node-bg-checkpoint)",
	Join: "var(--node-bg-join)",
	FlagChange: "var(--node-bg-status)",
};

export const NODE_ICON_COLORS = {
	Start: "var(--node-icon-start)",
	Reject: "var(--node-icon-end-reject)",
	End: "var(--node-icon-end)",
	Form: "var(--node-icon-form)",
	Decision: "var(--node-icon-decision)",
	Transform: "var(--node-icon-transform)",
	API: "var(--node-icon-api)",
	Message: "var(--node-icon-message)",
	Challenge: "var(--node-icon-challenge)",
	Checkpoint: "var(--node-icon-checkpoint)",
	Join: "var(--node-icon-join)",
	FlagChange: "var(--node-icon-status)",
};

const CHALLENGE_TYPE_LABELS: Record<ChallengeType, string> = {
	acceptance: "Aceptación",
	signature: "Firma",
};

export function NodeRenderer({
	node,
	selected,
	errors,
	connecting,
	highlightCheckpoint,
	flags = [],
	onMouseDown,
	onConnectorClick,
}: NodeRendererProps) {
	const nodeRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const [hoveredConnector, setHoveredConnector] = useState<string | null>(null);
	const [actualNodeHeight, setActualNodeHeight] = useState<number>(0);
	const rightConnectorRef = useRef<HTMLDivElement>(null);
	const Icon = NODE_ICONS[node.type];
	const baseIconBackground = NODE_BG_COLORS[node.type];
	const baseIconColor = NODE_ICON_COLORS[node.type];
	const hasErrors = errors.length > 0;
	const hasStaleTimeout = Boolean(node.staleTimeout);
	const isSafeCheckpoint =
		node.type === "Checkpoint" && node.checkpointType === "safe";
	const isChallengeNode = node.type === "Challenge";
	const challengeConfig = isChallengeNode
		? (node.config as ChallengeNodeConfig | undefined)
		: undefined;
	const challengeRetries = challengeConfig?.retries;
	const iconBackgroundColor = isSafeCheckpoint
		? "var(--node-safe-icon-bg)"
		: baseIconBackground;
	const iconColor = isSafeCheckpoint
		? "var(--node-safe-icon-color)"
		: baseIconColor;

	// Detectar si este nodo API tiene return-to-checkpoint configurado
	// Solo iluminar si el nodo está seleccionado
	const isAPIWithCheckpoint =
		selected &&
		node.type === "API" &&
		(
			node.config.failureHandling as
				| (APIFailureHandling & { checkpointId?: string })
				| undefined
		)?.onFailure === "return-to-checkpoint";

	// Determinar si debe iluminarse (API con checkpoint seleccionado o checkpoint siendo referenciado por API seleccionado)
	const shouldHighlight = isAPIWithCheckpoint || highlightCheckpoint;

	const baseBorderColor = isSafeCheckpoint
		? "var(--node-safe-border)"
		: "var(--border)";
	const borderColor = selected
		? "var(--ring)"
		: shouldHighlight
			? "rgb(249, 115, 22)"
			: baseBorderColor;
	const safeBackground = isSafeCheckpoint
		? "var(--node-safe-surface)"
		: undefined;
	const accentShadow = isSafeCheckpoint
		? "inset 4px 0 0 var(--node-safe-border)"
		: null;
	const glowShadow = isSafeCheckpoint
		? "0 14px 32px var(--node-safe-glow)"
		: null;
	const highlightShadow = shouldHighlight
		? "0 0 20px rgba(249, 115, 22, 0.5)"
		: null;
	const nodeBoxShadow =
		[accentShadow, glowShadow, highlightShadow].filter(Boolean).join(", ") ||
		undefined;

	const hasDecisionOutputs = node.type === "Decision";
	const hasChallengeOutputs = isChallengeNode;
	const hasTwoOutputs = hasDecisionOutputs || hasChallengeOutputs;
	// Un nodo Reject es terminal solo si allowRetry es false o no está configurado
	const isRejectWithRetry =
		node.type === "Reject" && (node.config.allowRetry as boolean) === true;
	// Un nodo API es terminal si onFailure='stop'
	const isAPITerminal =
		node.type === "API" &&
		(
			node.config.failureHandling as
				| (APIFailureHandling & { checkpointId?: string })
				| undefined
		)?.onFailure === "stop";
	const isTerminalNode =
		node.type === "End" ||
		(node.type === "Reject" && !isRejectWithRetry) ||
		isAPITerminal;
	const isStartNode = node.type === "Start";

	// Obtener información de reintentos para mostrar contador
	const allowRetry = (node.config.allowRetry as boolean) === true;
	const retryCount = (node.config.retryCount as number) || 0;
	const maxRetries = (node.config.maxRetries as number) ?? 0;

	// Tamaños dinámicos basados en contenido - estilo OpenAI compacto
	const MIN_NODE_WIDTH = 180; // Reducido para permitir nodos más estrechos
	const MAX_NODE_WIDTH = 320;
	const MIN_NODE_HEIGHT = 60;
	const PADDING_X = 16; // Restaurado
	const PADDING_Y = 12; // Restaurado
	const ICON_SIZE = 20;
	const ICON_CONTAINER_SIZE = 40;
	const CONNECTOR_SIZE = 12; // Reducido de 16px a 12px para nodos más compactos
	const GAP = 12;

	// Calcular ancho dinámico basado en contenido real
	const titleWidth = node.title.length * 9;
	const descWidth = node.description ? node.description.length * 7.5 : 0;

	// Calcular ancho real de badges de flags basado en el texto
	let flagsMaxWidth = 0;
	if (
		node.type === "FlagChange" &&
		node.config.flagChanges &&
		flags.length > 0
	) {
		const flagChanges = node.config.flagChanges as Array<{
			flagId: string;
			optionId: string;
		}>;
		flagChanges.forEach((flagChange) => {
			const flag = flags.find((f) => f.id === flagChange.flagId);
			const option = flag?.options.find(
				(opt) => opt.id === flagChange.optionId,
			);
			if (flag && option) {
				// Calcular ancho aproximado del badge: nombre + ":" + opción + padding
				const badgeText = `${flag.name}: ${option.label}`;
				const badgeWidth = badgeText.length * 7 + 24; // 7px por carácter + padding
				flagsMaxWidth = Math.max(flagsMaxWidth, badgeWidth);
			}
		});
	}

	// El ancho debe ser el máximo entre título, descripción y el badge más ancho
	const contentWidth =
		Math.max(titleWidth, descWidth, flagsMaxWidth) +
		ICON_CONTAINER_SIZE +
		GAP +
		PADDING_X * 2;
	const NODE_WIDTH = Math.max(
		MIN_NODE_WIDTH,
		Math.min(MAX_NODE_WIDTH, contentWidth),
	);

	// Calcular altura estimada (se ajustará con medida real)
	const hasDescription = !!node.description;
	const hasRoles = node.roles.length > 0;
	const flagChangesCount =
		node.type === "FlagChange" && node.config.flagChanges
			? (node.config.flagChanges as Array<{ flagId: string; optionId: string }>)
					.length
			: 0;
	const hasSpecialBadges =
		(allowRetry && node.type === "Reject") ||
		flagChangesCount > 0 ||
		(node.type === "API" && node.config.failureHandling) ||
		isSafeCheckpoint ||
		(isChallengeNode && challengeConfig);

	let estimatedHeight = MIN_NODE_HEIGHT;
	if (hasDescription) estimatedHeight += 22;
	if (hasRoles) {
		const rolesRows = Math.ceil(node.roles.length / 3); // Aproximación: 3 roles por fila
		estimatedHeight += rolesRows * 28;
	}
	if (hasSpecialBadges) {
		if (flagChangesCount > 0) {
			const flagRows = Math.ceil(flagChangesCount / 2); // Aproximación: 2 flags por fila
			estimatedHeight += flagRows * 28;
		} else {
			estimatedHeight += 28;
		}
	}

	const NODE_HEIGHT = Math.max(
		estimatedHeight,
		actualNodeHeight || estimatedHeight,
	);

	// Usar altura real medida o estimada
	const realHeight = actualNodeHeight || NODE_HEIGHT;

	// Conectores de salida en el costado derecho (layout horizontal)
	// Las posiciones representan el centro del círculo conector
	const singleOutputCenterY = node.position.y + realHeight / 2;
	const multiOutputPositiveRatio = hasChallengeOutputs ? 0.35 : 0.33;
	const multiOutputNegativeRatio = hasChallengeOutputs ? 0.65 : 0.67;

	const rightConnectorPos = hasTwoOutputs
		? null
		: {
				x: node.position.x + NODE_WIDTH + CONNECTOR_SIZE / 2,
				y: singleOutputCenterY,
			};

	const rightTopConnectorPos = hasTwoOutputs
		? {
				x: node.position.x + NODE_WIDTH + CONNECTOR_SIZE / 2,
				y: node.position.y + realHeight * multiOutputPositiveRatio,
			}
		: null;

	const rightBottomConnectorPos = hasTwoOutputs
		? {
				x: node.position.x + NODE_WIDTH + CONNECTOR_SIZE / 2,
				y: node.position.y + realHeight * multiOutputNegativeRatio,
			}
		: null;

	// Conectores de entrada en el costado izquierdo (layout horizontal)
	const leftConnectorPos = {
		x: node.position.x - CONNECTOR_SIZE / 2,
		y: singleOutputCenterY,
	};

	const handleConnectorClick = (
		position: { x: number; y: number },
		e: React.MouseEvent,
		port?: "top" | "bottom" | "middle",
	) => {
		e.stopPropagation();
		e.preventDefault();
		console.warn("[v0] Connector clicked:", {
			nodeId: node.id,
			position,
			port,
		});
		onConnectorClick(position, e, port);
	};

	// Medir altura real del contenido después del render
	useEffect(() => {
		if (contentRef.current) {
			// Usar requestAnimationFrame para asegurar que el DOM esté actualizado
			requestAnimationFrame(() => {
				if (contentRef.current) {
					const height = contentRef.current.offsetHeight;
					// Solo actualizar si hay un cambio significativo (más de 1px de diferencia)
					if (Math.abs(height - actualNodeHeight) > 1) {
						setActualNodeHeight(height);
					}
				}
			});
		}
	}, [
		node.title,
		node.description,
		node.roles,
		node.config,
		flags,
		actualNodeHeight,
	]);

	return (
		<div
			ref={nodeRef}
			className="pointer-events-auto absolute"
			style={{
				left: node.position.x,
				top: node.position.y,
				width: NODE_WIDTH,
				pointerEvents: "auto",
			}}
			onMouseDown={onMouseDown}
		>
			<div
				className={cn(
					"workflow-node relative cursor-move select-none rounded-lg border bg-card shadow-md transition-all",
					selected && "selected ring-2 ring-ring ring-offset-1",
					hasErrors && "border-destructive",
					connecting && "ring-2 ring-primary",
					shouldHighlight && "ring-2 ring-orange-500 animate-pulse",
				)}
				data-safe-checkpoint={isSafeCheckpoint ? "true" : undefined}
				style={{
					width: NODE_WIDTH,
					borderColor,
					boxShadow: nodeBoxShadow,
					background: safeBackground,
				}}
			>
				{(hasStaleTimeout || (isSafeCheckpoint && !hasStaleTimeout)) && (
					<div
						className={cn(
							"absolute -right-1 -top-1 z-20 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none shadow-md ring-1 backdrop-blur-sm",
							hasStaleTimeout &&
								"bg-amber-500/90 text-white ring-amber-600/50 dark:bg-amber-500 dark:ring-amber-400/50",
							!hasStaleTimeout &&
								isSafeCheckpoint &&
								"bg-emerald-500/90 text-white ring-emerald-600/50 dark:bg-emerald-500 dark:ring-emerald-400/50",
						)}
						data-testid={hasStaleTimeout ? "stale-indicator" : "safe-indicator"}
						title={
							hasStaleTimeout
								? `Timeout Stale: ${node.staleTimeout?.value} ${
										node.staleTimeout?.unit === "hours"
											? "horas"
											: node.staleTimeout?.unit === "days"
												? "días"
												: node.staleTimeout?.unit
									}`
								: "Safe checkpoint"
						}
						aria-label={
							hasStaleTimeout
								? "Nodo con timeout stale configurado"
								: "Checkpoint seguro"
						}
					>
						{hasStaleTimeout ? (
							<>
								<Clock3
									className="h-2.5 w-2.5 shrink-0 text-white"
									aria-hidden="true"
								/>
								<span>STALE</span>
							</>
						) : (
							<>
								<ShieldCheck
									className="h-2.5 w-2.5 shrink-0 text-white"
									aria-hidden="true"
								/>
								<span>SAFE</span>
							</>
						)}
					</div>
				)}
				<div
					ref={contentRef}
					className="flex items-start gap-3"
					style={{
						padding: `${PADDING_Y}px ${PADDING_X}px`,
					}}
				>
					{/* Icono dentro del nodo - estilo Figma */}
					<div
						className="node-icon-container flex shrink-0 items-center justify-center rounded-md"
						style={{
							width: ICON_CONTAINER_SIZE,
							height: ICON_CONTAINER_SIZE,
							backgroundColor: iconBackgroundColor,
							color: iconColor, // Icon color: dark in light theme, white in dark theme (via CSS variable)
						}}
					>
						<Icon size={ICON_SIZE} />
					</div>

					{/* Contenido principal */}
					<div className="min-w-0 flex-1">
						<div className="flex items-start justify-between gap-2">
							<div className="min-w-0 flex-1">
								<div className="text-base font-semibold leading-tight text-foreground">
									{node.title}
								</div>
								{node.description && (
									<div className="mt-1 text-sm leading-relaxed text-muted-foreground line-clamp-2">
										{node.description}
									</div>
								)}
							</div>
							{hasErrors && (
								<AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
							)}
						</div>
						{/* Roles */}
						{node.roles.length > 0 && (
							<div className="mt-2 flex flex-wrap gap-1">
								{node.roles.slice(0, 2).map((role) => (
									<span
										key={role}
										className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
									>
										{role}
									</span>
								))}
								{node.roles.length > 2 && (
									<span className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
										+{node.roles.length - 2}
									</span>
								)}
							</div>
						)}

						{/* Badge de tipo de challenge para nodos Challenge */}
						{isChallengeNode && challengeConfig && (
							<div className="mt-2">
								<span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
									<Shield className="h-3 w-3" />
									{CHALLENGE_TYPE_LABELS[challengeConfig.challengeType]}
								</span>
							</div>
						)}

						{isChallengeNode && challengeRetries && (
							<div className="mt-2 flex flex-wrap gap-1">
								<span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:text-orange-300">
									Reintentos: {challengeRetries.maxRetries}
								</span>
								{challengeRetries.roles.length > 0 && (
									<span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
										{challengeRetries.roles.slice(0, 2).join(", ")}
										{challengeRetries.roles.length > 2 &&
											` +${challengeRetries.roles.length - 2}`}
									</span>
								)}
							</div>
						)}

						{/* Contador de reintentos para nodos Reject con allowRetry */}
						{allowRetry && node.type === "Reject" && (
							<div className="mt-2">
								<span className="rounded-full bg-orange-500/20 px-2 py-1 text-xs font-semibold text-orange-700 dark:text-orange-400">
									{maxRetries > 0
										? `Reintentos: ${retryCount}/${maxRetries}`
										: `Reintentos: ${retryCount} (∞)`}
								</span>
							</div>
						)}

						{/* Badges de flags para nodos FlagChange */}
						{node.type === "FlagChange" &&
						(node.config.flagChanges as
							| Array<{ flagId: string; optionId: string }>
							| undefined) ? (
							<div className="mt-2 flex flex-wrap gap-1">
								{(
									node.config.flagChanges as Array<{
										flagId: string;
										optionId: string;
									}>
								).map((flagChange) => {
									const flag = flags.find((f) => f.id === flagChange.flagId);
									const option = flag?.options.find(
										(opt) => opt.id === flagChange.optionId,
									);
									if (!flag || !option) return null;
									return (
										<span
											key={`${flagChange.flagId}-${flagChange.optionId}`}
											className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-white"
											style={{ backgroundColor: getColorValue(option.color) }}
										>
											<span className="truncate max-w-[100px]">
												{flag.name}:
											</span>
											<span className="truncate max-w-[80px]">
												{option.label}
											</span>
										</span>
									);
								})}
							</div>
						) : null}

						{/* Badge de manejo de fallos para nodos API */}
						{node.type === "API" && node.config.failureHandling
							? (() => {
									const fh = node.config.failureHandling as
										| (APIFailureHandling & { checkpointId?: string })
										| undefined;
									if (!fh) return null;
									const icons = {
										stop: "❌",
										continue: "⚠️",
										retry: "🔄",
										"return-to-checkpoint": "⏮️",
									};
									const labels = {
										stop: "Detener",
										continue: "Continuar",
										retry: "Reintentar",
										"return-to-checkpoint": "Checkpoint",
									};
									return (
										<div className="mt-2 flex items-center gap-1">
											<span className="flex-1 truncate rounded-md bg-blue-500/10 px-2 py-1 text-center text-xs font-semibold text-blue-700 dark:text-blue-400">
												{icons[fh.onFailure as keyof typeof icons]}{" "}
												{labels[fh.onFailure as keyof typeof labels]}
											</span>
											{(fh.onFailure === "retry" ||
												fh.onFailure === "return-to-checkpoint") && (
												<span className="rounded-md bg-orange-500/10 px-2 py-1 text-xs font-semibold text-orange-700 dark:text-orange-400">
													{fh.maxRetries || 0}
												</span>
											)}
										</div>
									);
								})()
							: null}
					</div>
				</div>

				{/* Conectores de salida */}
				{!isTerminalNode && (
					<>
						{hasDecisionOutputs ? (
							<>
								<div
									className={cn(
										"workflow-connector pointer-events-auto absolute z-10 h-4 w-4 cursor-pointer rounded-full border-2 border-green-500 bg-background transition-transform",
										connecting &&
											"scale-125 animate-pulse border-primary bg-primary",
									)}
									style={{
										right: `${-CONNECTOR_SIZE / 2}px`,
										top: `${realHeight * multiOutputPositiveRatio - CONNECTOR_SIZE / 2}px`,
										transform:
											hoveredConnector === "right-top"
												? "scale(1.25)"
												: "scale(1)",
										transformOrigin: "center center",
									}}
									title="Salida positiva (Sí)"
									onClick={(e) =>
										handleConnectorClick(rightTopConnectorPos!, e, "top")
									}
									onMouseDown={(e) => e.stopPropagation()}
									onMouseEnter={() => setHoveredConnector("right-top")}
									onMouseLeave={() => setHoveredConnector(null)}
									data-testid="output-connector-positive"
								/>
								<div
									className={cn(
										"workflow-connector pointer-events-auto absolute z-10 h-4 w-4 cursor-pointer rounded-full border-2 border-red-500 bg-background transition-transform",
										connecting &&
											"scale-125 animate-pulse border-primary bg-primary",
									)}
									style={{
										right: `${-CONNECTOR_SIZE / 2}px`,
										top: `${realHeight * multiOutputNegativeRatio - CONNECTOR_SIZE / 2}px`,
										transform:
											hoveredConnector === "right-bottom"
												? "scale(1.25)"
												: "scale(1)",
										transformOrigin: "center center",
									}}
									title="Salida negativa (No / Rechazado)"
									onClick={(e) =>
										handleConnectorClick(rightBottomConnectorPos!, e, "bottom")
									}
									onMouseDown={(e) => e.stopPropagation()}
									onMouseEnter={() => setHoveredConnector("right-bottom")}
									onMouseLeave={() => setHoveredConnector(null)}
									data-testid="output-connector-negative"
								/>
							</>
						) : hasChallengeOutputs ? (
							<>
								<div
									className={cn(
										"workflow-connector pointer-events-auto absolute z-10 h-4 w-4 cursor-pointer rounded-full border-2 border-green-500 bg-background transition-transform",
										connecting &&
											"scale-125 animate-pulse border-primary bg-primary",
									)}
									style={{
										right: `${-CONNECTOR_SIZE / 2}px`,
										top: `${realHeight * multiOutputPositiveRatio - CONNECTOR_SIZE / 2}px`,
										transform:
											hoveredConnector === "right-top"
												? "scale(1.25)"
												: "scale(1)",
										transformOrigin: "center center",
									}}
									title="Salida positiva (Aceptado)"
									onClick={(e) =>
										handleConnectorClick(rightTopConnectorPos!, e, "top")
									}
									onMouseDown={(e) => e.stopPropagation()}
									onMouseEnter={() => setHoveredConnector("right-top")}
									onMouseLeave={() => setHoveredConnector(null)}
									data-testid="output-connector-positive"
								/>
								<div
									className={cn(
										"workflow-connector pointer-events-auto absolute z-10 h-4 w-4 cursor-pointer rounded-full border-2 border-red-500 bg-background transition-transform",
										connecting &&
											"scale-125 animate-pulse border-primary bg-primary",
									)}
									style={{
										right: `${-CONNECTOR_SIZE / 2}px`,
										top: `${realHeight * multiOutputNegativeRatio - CONNECTOR_SIZE / 2}px`,
										transform:
											hoveredConnector === "right-bottom"
												? "scale(1.25)"
												: "scale(1)",
										transformOrigin: "center center",
									}}
									title="Salida negativa (Rechazado)"
									onClick={(e) =>
										handleConnectorClick(rightBottomConnectorPos!, e, "bottom")
									}
									onMouseDown={(e) => e.stopPropagation()}
									onMouseEnter={() => setHoveredConnector("right-bottom")}
									onMouseLeave={() => setHoveredConnector(null)}
									data-testid="output-connector-negative"
								/>
							</>
						) : (
							<div
								ref={rightConnectorRef}
								className={cn(
									"workflow-connector pointer-events-auto absolute z-10 h-4 w-4 cursor-pointer rounded-full border-2 border-primary bg-background transition-transform",
									connecting &&
										"scale-125 animate-pulse border-primary bg-primary",
								)}
								style={{
									right: `${-CONNECTOR_SIZE / 2}px`,
									top: `${realHeight / 2 - CONNECTOR_SIZE / 2}px`,
									transform:
										hoveredConnector === "right" ? "scale(1.25)" : "scale(1)",
									transformOrigin: "center center",
								}}
								title="Conectar a otro nodo"
								onClick={(e) => handleConnectorClick(rightConnectorPos!, e)}
								onMouseDown={(e) => e.stopPropagation()}
								onMouseEnter={() => setHoveredConnector("right")}
								onMouseLeave={() => setHoveredConnector(null)}
								data-testid="output-connector"
							/>
						)}
					</>
				)}

				{/* Conector de entrada */}
				{!isStartNode && (
					<div
						className={cn(
							"workflow-connector pointer-events-auto absolute z-30 h-4 w-4 cursor-pointer rounded-full border-2 border-primary bg-background transition-transform",
							connecting && "scale-125 animate-pulse border-primary bg-primary",
						)}
						style={{
							left: `${-CONNECTOR_SIZE / 2}px`,
							top: `${realHeight / 2 - CONNECTOR_SIZE / 2}px`,
							transform:
								hoveredConnector === "left" ? "scale(1.25)" : "scale(1)",
							transformOrigin: "center center",
						}}
						title="Punto de entrada"
						onClick={(e) => handleConnectorClick(leftConnectorPos, e, "middle")}
						onMouseDown={(e) => e.stopPropagation()}
						onMouseEnter={() => setHoveredConnector("left")}
						onMouseLeave={() => setHoveredConnector(null)}
						data-testid="input-connector"
					/>
				)}
			</div>
		</div>
	);
}
