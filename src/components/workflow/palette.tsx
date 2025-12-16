"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkflowNode, NodeType } from "@/lib/workflow/types";
import { createDefaultChallengeConfig } from "@/lib/workflow/types";
import {
	XCircle,
	CheckCircle,
	FileText,
	GitBranch,
	Code,
	Globe,
	Mail,
	ChevronDown,
	ChevronRight,
	ChevronUp,
	Flag,
	Merge,
	Tag,
	Circle,
	ArrowRight,
	AlertCircle,
	Play,
	Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PaletteProps {
	onAddNode: (node: WorkflowNode) => void;
	zoom: number;
	pan: { x: number; y: number };
	stats: {
		nodes: number;
		edges: number;
	};
	validationState: {
		status: "idle" | "valid" | "invalid";
		errorsCount: number;
	};
}

const NODE_CATEGORIES = [
	{
		id: "core",
		label: "NÚCLEO",
		nodes: [
			{
				type: "Start" as NodeType,
				label: "Inicio",
				icon: <Play className="h-4 w-4" />,
				bgColor: "var(--node-bg-start)",
				iconColorVar: "--node-icon-start",
			},
		],
	},
	{
		id: "logic",
		label: "LÓGICA",
		nodes: [
			{
				type: "Decision" as NodeType,
				label: "Decisión",
				icon: <GitBranch className="h-4 w-4" />,
				bgColor: "var(--node-bg-decision)",
				iconColorVar: "--node-icon-decision",
			},
			{
				type: "Challenge" as NodeType,
				label: "Challenge",
				icon: <Shield className="h-4 w-4" />,
				bgColor: "var(--node-bg-challenge)",
				iconColorVar: "--node-icon-challenge",
			},
			{
				type: "Checkpoint" as NodeType,
				label: "Checkpoint",
				icon: <Flag className="h-4 w-4" />,
				bgColor: "var(--node-bg-checkpoint)",
				iconColorVar: "--node-icon-checkpoint",
			},
			{
				type: "Join" as NodeType,
				label: "Unión",
				icon: <Merge className="h-4 w-4" />,
				bgColor: "var(--node-bg-join)",
				iconColorVar: "--node-icon-join",
			},
			{
				type: "FlagChange" as NodeType,
				label: "Flag Change",
				icon: <Tag className="h-4 w-4" />,
				bgColor: "var(--node-bg-status)",
				iconColorVar: "--node-icon-status",
			},
		],
	},
	{
		id: "data",
		label: "DATOS",
		nodes: [
			{
				type: "Form" as NodeType,
				label: "Formulario",
				icon: <FileText className="h-4 w-4" />,
				bgColor: "var(--node-bg-form)",
				iconColorVar: "--node-icon-form",
			},
			{
				type: "Transform" as NodeType,
				label: "Transformación",
				icon: <Code className="h-4 w-4" />,
				bgColor: "var(--node-bg-transform)",
				iconColorVar: "--node-icon-transform",
			},
			{
				type: "API" as NodeType,
				label: "API",
				icon: <Globe className="h-4 w-4" />,
				bgColor: "var(--node-bg-api)",
				iconColorVar: "--node-icon-api",
			},
			{
				type: "Message" as NodeType,
				label: "Mensaje",
				icon: <Mail className="h-4 w-4" />,
				bgColor: "var(--node-bg-message)",
				iconColorVar: "--node-icon-message",
			},
		],
	},
	{
		id: "terminal",
		label: "FINALES",
		nodes: [
			{
				type: "End" as NodeType,
				label: "Fin",
				icon: <Circle className="h-4 w-4" />,
				bgColor: "var(--node-bg-end)",
				iconColorVar: "--node-icon-end",
			},
			{
				type: "Reject" as NodeType,
				label: "Rechazado",
				icon: <XCircle className="h-4 w-4" />,
				bgColor: "var(--node-bg-end-reject)",
				iconColorVar: "--node-icon-end-reject",
			},
		],
	},
];

const getDefaultConfigForType = (type: NodeType): WorkflowNode["config"] => {
	if (type === "Challenge") {
		return createDefaultChallengeConfig();
	}
	return {};
};

export function Palette({
	onAddNode,
	zoom,
	pan,
	stats,
	validationState,
}: PaletteProps) {
	const [expandedSections, setExpandedSections] = useState<Set<string>>(
		new Set(NODE_CATEGORIES.map((cat) => cat.id)),
	);
	const [searchTerm, setSearchTerm] = useState("");
	const [isCollapsed, setIsCollapsed] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const toggleSection = (section: string) => {
		setExpandedSections((prev) => {
			const next = new Set(prev);
			if (next.has(section)) {
				next.delete(section);
			} else {
				next.add(section);
			}
			return next;
		});
	};

	const handleAddNode = (type: NodeType, label: string) => {
		const propertiesPanel = document.querySelector<HTMLElement>(
			'[data-workflow-panel="properties"]',
		);
		const propertiesWidth = propertiesPanel?.offsetWidth ?? 0;
		const paletteHeight = containerRef.current?.offsetHeight ?? 0;
		const HEADER_HEIGHT = 64; // Aproximación del alto de la TopBar

		const availableWidth = Math.max(window.innerWidth - propertiesWidth, 320);
		const availableHeight = Math.max(
			window.innerHeight - HEADER_HEIGHT - paletteHeight,
			240,
		);

		// Para layout horizontal: centrar verticalmente y dejar espacio para conectar de izquierda a derecha
		// Usar ancho promedio de nodo (aproximadamente 200-320px, usar 240px como promedio)
		const centerX = (availableWidth / 2 - pan.x) / zoom - 120; // 120 = NODE_WIDTH promedio / 2
		const centerY = (availableHeight / 2 - pan.y) / zoom;

		const newNode: WorkflowNode = {
			id: `node-${Date.now()}`,
			type,
			checkpointType: type === "Checkpoint" ? "normal" : undefined,
			title: label,
			description: "",
			roles: [],
			config: getDefaultConfigForType(type),
			staleTimeout: null,
			position: { x: centerX, y: centerY },
			groupId: null,
		};
		onAddNode(newNode);
	};

	const normalizedSearch = searchTerm.trim().toLowerCase();
	const filteredCategories = useMemo(() => {
		if (!normalizedSearch) return NODE_CATEGORIES;
		return NODE_CATEGORIES.map((category) => ({
			...category,
			nodes: category.nodes.filter((node) =>
				node.label.toLowerCase().includes(normalizedSearch),
			),
		}));
	}, [normalizedSearch]);

	const categoriesToRender = normalizedSearch
		? filteredCategories.filter((category) => category.nodes.length > 0)
		: filteredCategories;
	const totalNodes = NODE_CATEGORIES.reduce(
		(acc, cat) => acc + cat.nodes.length,
		0,
	);
	const visibleNodes = categoriesToRender.reduce(
		(acc, cat) => acc + cat.nodes.length,
		0,
	);
	const hasResults = visibleNodes > 0;
	return (
		<div
			ref={containerRef}
			className={cn(
				"flex-shrink-0 border-b border-border bg-card transition-[max-height] duration-200 ease-in-out shadow-sm",
				isCollapsed ? "max-h-[120px]" : "max-h-[360px]",
			)}
		>
			<div className="flex flex-wrap items-center gap-3 px-4 py-3">
				<div className="min-w-[150px]">
					<p className="text-sm font-semibold text-foreground">Componentes</p>
					{!isCollapsed && (
						<p className="text-xs text-muted-foreground">
							Haz clic para agregarlos al lienzo
						</p>
					)}
				</div>

				{!isCollapsed && (
					<>
						<Input
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							placeholder="Buscar por nombre o tipo..."
							aria-label="Buscar nodos"
							className="h-9 min-w-[200px] flex-1 sm:max-w-sm md:max-w-md"
						/>
						<div className="text-xs text-muted-foreground">
							{visibleNodes} de {totalNodes} nodos visibles
						</div>
					</>
				)}

				<div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
					<div className="flex items-center gap-1 font-semibold text-foreground">
						<Circle className="h-3.5 w-3.5 text-muted-foreground" />
						<span>{stats.nodes}</span>
					</div>
					<div className="flex items-center gap-1 font-semibold text-foreground">
						<ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
						<span>{stats.edges}</span>
					</div>
					<div
						className={cn(
							"flex items-center gap-1 font-semibold",
							validationState.status === "valid" &&
								"text-emerald-600 dark:text-emerald-400",
							validationState.status === "invalid" && "text-destructive",
							validationState.status === "idle" && "text-muted-foreground",
						)}
					>
						{validationState.status === "valid" ? (
							<CheckCircle className="h-3.5 w-3.5" />
						) : (
							<AlertCircle className="h-3.5 w-3.5" />
						)}
						<span>
							{validationState.status === "valid"
								? "Sin errores"
								: validationState.status === "invalid"
									? `${validationState.errorsCount} pendientes`
									: "Pendiente"}
						</span>
					</div>
					<button
						type="button"
						className="flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						onClick={() => setIsCollapsed((prev) => !prev)}
						title={isCollapsed ? "Expandir panel" : "Colapsar panel"}
						aria-label={isCollapsed ? "Expandir panel" : "Colapsar panel"}
					>
						<span>{isCollapsed ? "Mostrar" : "Ocultar"}</span>
						{isCollapsed ? (
							<ChevronDown className="h-4 w-4" />
						) : (
							<ChevronUp className="h-4 w-4" />
						)}
					</button>
				</div>
			</div>

			{isCollapsed ? (
				<div className="border-t border-border/60 bg-muted/40">
					<div className="flex items-center gap-2 overflow-x-auto px-4 py-3">
						{NODE_CATEGORIES.map((category, index) => (
							<div key={category.id} className="flex items-center gap-2">
								{category.nodes.map(
									({ type, label, icon, bgColor, iconColorVar }) => {
										const tooltipId = `tooltip-${type}`;
										return (
											<div key={type} className="group relative">
												<button
													type="button"
													className="flex h-10 w-10 items-center justify-center rounded-md border border-border/70 bg-card transition-all hover:border-border hover:bg-accent hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
													onClick={() => handleAddNode(type, label)}
													aria-label={`Agregar ${label}`}
													onMouseEnter={(e) => {
														const tooltip = document.getElementById(tooltipId);
														if (tooltip) {
															const rect =
																e.currentTarget.getBoundingClientRect();
															tooltip.style.left = `${rect.right + 12}px`;
															tooltip.style.top = `${rect.top + rect.height / 2}px`;
															tooltip.style.transform = "translateY(-50%)";
															tooltip.style.opacity = "1";
															tooltip.style.pointerEvents = "none";
														}
													}}
													onMouseLeave={() => {
														const tooltip = document.getElementById(tooltipId);
														if (tooltip) {
															tooltip.style.opacity = "0";
														}
													}}
												>
													<div
														className="node-icon-container flex h-7 w-7 items-center justify-center rounded-md transition-transform group-hover:scale-110"
														style={{
															backgroundColor: bgColor,
															color: `var(${iconColorVar})`,
														}}
													>
														{icon}
													</div>
												</button>
												<span
													id={tooltipId}
													className="pointer-events-none fixed z-[9999] whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1.5 text-xs font-medium text-popover-foreground shadow-lg transition-opacity duration-0"
													style={{
														opacity: 0,
													}}
												>
													{label}
												</span>
											</div>
										);
									},
								)}
								{index < NODE_CATEGORIES.length - 1 && (
									<div
										className="hidden h-8 w-px bg-border/50 last:hidden md:block"
										aria-hidden="true"
									/>
								)}
							</div>
						))}
					</div>
				</div>
			) : (
				<div className="border-t border-border/60 bg-card/80">
					{!hasResults && (
						<div className="mx-4 mt-4 rounded-md border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
							No encontramos nodos que coincidan con “{searchTerm}”.
							<div className="mt-2 text-xs">
								Intenta con otro término o limpia el filtro.
							</div>
						</div>
					)}

					<div className="overflow-x-auto px-4 py-4">
						<div className="flex min-w-max gap-4">
							{categoriesToRender.map((category) => (
								<div
									key={category.id}
									className="min-w-[220px] flex-1 rounded-lg border border-border/60 bg-background/60 p-3 shadow-sm"
								>
									<button
										type="button"
										className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
										onClick={() => toggleSection(category.id)}
									>
										{category.label}
										{expandedSections.has(category.id) ? (
											<ChevronDown className="h-4 w-4" />
										) : (
											<ChevronRight className="h-4 w-4" />
										)}
									</button>

									{expandedSections.has(category.id) ? (
										<div className="mt-3 space-y-1">
											{category.nodes.map(
												({ type, label, icon, bgColor, iconColorVar }) => (
													<Button
														key={type}
														variant="ghost"
														size="sm"
														className="w-full justify-start text-sm"
														onClick={() => handleAddNode(type, label)}
														title={label}
													>
														<div className="flex items-center gap-2">
															<div
																className="node-icon-container flex h-7 w-7 items-center justify-center rounded-md"
																style={{
																	backgroundColor: bgColor,
																	color: `var(${iconColorVar})`,
																}}
															>
																{icon}
															</div>
															<span className="text-sm font-medium">
																{label}
															</span>
														</div>
													</Button>
												),
											)}
										</div>
									) : (
										<div className="mt-3 flex flex-wrap gap-2">
											{category.nodes.map(
												({ type, label, icon, bgColor, iconColorVar }) => {
													const tooltipId = `tooltip-${type}`;
													return (
														<div key={type} className="group relative">
															<button
																type="button"
																className="flex h-10 w-10 items-center justify-center rounded-md border border-border/70 bg-card transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
																onClick={() => handleAddNode(type, label)}
																title={label}
																aria-label={`Agregar ${label}`}
																onMouseEnter={(e) => {
																	const tooltip =
																		document.getElementById(tooltipId);
																	if (tooltip) {
																		const rect =
																			e.currentTarget.getBoundingClientRect();
																		tooltip.style.left = `${rect.left + rect.width / 2}px`;
																		tooltip.style.top = `${rect.top - 8}px`;
																		tooltip.style.transform =
																			"translate(-50%, -100%)";
																		tooltip.style.opacity = "1";
																		tooltip.style.pointerEvents = "none";
																	}
																}}
																onMouseLeave={() => {
																	const tooltip =
																		document.getElementById(tooltipId);
																	if (tooltip) {
																		tooltip.style.opacity = "0";
																	}
																}}
															>
																<div
																	className="node-icon-container flex h-7 w-7 items-center justify-center rounded-md"
																	style={{
																		backgroundColor: bgColor,
																		color: `var(${iconColorVar})`,
																	}}
																>
																	{icon}
																</div>
															</button>
															<span
																id={tooltipId}
																className="pointer-events-none fixed z-[9999] whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1.5 text-xs font-medium text-popover-foreground shadow-lg transition-opacity duration-0"
																style={{
																	opacity: 0,
																}}
															>
																{label}
															</span>
														</div>
													);
												},
											)}
										</div>
									)}
								</div>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
