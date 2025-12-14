"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
		const viewportWidth = window.innerWidth - 256 - 320;
		const viewportHeight = window.innerHeight - 56;

		// Para layout vertical: centrar horizontalmente, posicionar verticalmente según el último nodo o viewport
		// Usar ancho promedio de nodo (aproximadamente 200-320px, usar 240px como promedio)
		const centerX = (viewportWidth / 2 - pan.x) / zoom - 120; // 120 = NODE_WIDTH promedio / 2
		const centerY = (viewportHeight / 2 - pan.y) / zoom;

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
			className={cn(
				"relative flex flex-col border-r border-border bg-card transition-[width] duration-200 ease-in-out",
				isCollapsed ? "w-16" : "w-64",
			)}
		>
			<div className="border-b border-border p-3">
				{!isCollapsed && (
					<div>
						<p className="text-sm font-semibold text-foreground">Componentes</p>
						<p className="text-xs text-muted-foreground">
							Haz clic para agregarlos al lienzo
						</p>
					</div>
				)}
				{!isCollapsed && (
					<div className="mt-3 flex flex-col gap-3">
						<Input
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							placeholder="Buscar por nombre o tipo..."
							aria-label="Buscar nodos"
							className="h-9"
						/>
						<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
							<span>
								{visibleNodes} de {totalNodes} nodos visibles
							</span>
						</div>
					</div>
				)}
			</div>

			{isCollapsed ? (
				<div className="flex-1 overflow-y-auto min-h-0">
					<div className="flex flex-col gap-4 px-2 py-4">
						{NODE_CATEGORIES.map((category) => (
							<div
								key={category.id}
								className="flex flex-col items-center gap-2"
							>
								<Separator className="w-8 opacity-30" />
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
							</div>
						))}
					</div>
				</div>
			) : (
				<ScrollArea className="flex-1 min-h-0">
					<div className="p-2">
						{!hasResults && (
							<div className="rounded-md border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
								No encontramos nodos que coincidan con “{searchTerm}”.
								<div className="mt-2 text-xs">
									Intenta con otro término o limpia el filtro.
								</div>
							</div>
						)}

						{categoriesToRender.map((category) => (
							<div key={category.id} className="mb-2">
								<Button
									variant="ghost"
									size="sm"
									className="w-full justify-start text-muted-foreground dark:text-muted-foreground font-medium text-xs uppercase"
									onClick={() => toggleSection(category.id)}
								>
									{expandedSections.has(category.id) ? (
										<ChevronDown className="mr-2 h-4 w-4" />
									) : (
										<ChevronRight className="mr-2 h-4 w-4" />
									)}
									{category.label}
								</Button>

								{expandedSections.has(category.id) ? (
									<div className="mt-2 space-y-1 pl-2">
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
														<span className="text-sm font-medium text-blue-900 dark:text-white">
															{label}
														</span>
													</div>
												</Button>
											),
										)}
									</div>
								) : (
									<div className="mt-3 flex flex-wrap gap-2 pl-2">
										{category.nodes.map(
											({ type, label, icon, bgColor, iconColorVar }) => (
												<button
													key={type}
													type="button"
													className="flex h-10 w-10 items-center justify-center rounded-md border border-border/70 bg-card transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
													onClick={() => handleAddNode(type, label)}
													title={label}
													aria-label={`Agregar ${label}`}
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
											),
										)}
									</div>
								)}
							</div>
						))}
					</div>
				</ScrollArea>
			)}

			<div className="border-t border-border/80 bg-muted/40">
				{isCollapsed ? (
					<div className="flex flex-col items-center gap-2.5 p-3">
						<div className="flex flex-col items-center gap-1 group relative">
							<Circle className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="text-[10px] font-semibold text-foreground leading-none">
								{stats.nodes}
							</span>
							<span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-[9999] whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[10px] font-medium text-popover-foreground shadow-lg opacity-0 transition-opacity duration-75 group-hover:opacity-100">
								Nodos
							</span>
						</div>
						<div className="flex flex-col items-center gap-1 group relative">
							<ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="text-[10px] font-semibold text-foreground leading-none">
								{stats.edges}
							</span>
							<span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-[9999] whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[10px] font-medium text-popover-foreground shadow-lg opacity-0 transition-opacity duration-75 group-hover:opacity-100">
								Transiciones
							</span>
						</div>
						<div className="flex flex-col items-center gap-1 group relative">
							{validationState.status === "valid" ? (
								<CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
							) : validationState.status === "invalid" ? (
								<AlertCircle className="h-3.5 w-3.5 text-destructive" />
							) : (
								<AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
							)}
							<span
								className={cn(
									"text-[10px] font-semibold leading-none",
									validationState.status === "valid" &&
										"text-emerald-600 dark:text-emerald-400",
									validationState.status === "invalid" && "text-destructive",
									validationState.status === "idle" && "text-muted-foreground",
								)}
							>
								{validationState.status === "valid"
									? "✓"
									: validationState.status === "invalid"
										? validationState.errorsCount
										: "—"}
							</span>
							<span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-[9999] whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[10px] font-medium text-popover-foreground shadow-lg opacity-0 transition-opacity duration-75 group-hover:opacity-100">
								{validationState.status === "valid"
									? "Sin errores"
									: validationState.status === "invalid"
										? `${validationState.errorsCount} pendientes`
										: "Pendiente"}
							</span>
						</div>
					</div>
				) : (
					<div className="p-4">
						<div className="space-y-3 text-xs">
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Nodos</span>
								<span className="font-semibold text-foreground">
									{stats.nodes}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Transiciones</span>
								<span className="font-semibold text-foreground">
									{stats.edges}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Validación</span>
								<span
									className={cn(
										"font-semibold",
										validationState.status === "valid" &&
											"text-emerald-600 dark:text-emerald-400",
										validationState.status === "invalid" && "text-destructive",
									)}
								>
									{validationState.status === "valid"
										? "Sin errores"
										: validationState.status === "invalid"
											? `${validationState.errorsCount} pendientes`
											: "Pendiente"}
								</span>
							</div>
						</div>
					</div>
				)}
			</div>

			<div className="border-t border-border/60 p-2.5">
				<div className="flex items-center justify-center w-full">
					<button
						type="button"
						className="flex h-8 w-8 items-center justify-center rounded-md text-base text-muted-foreground transition-all hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						onClick={() => setIsCollapsed((prev) => !prev)}
						title={isCollapsed ? "Expandir panel" : "Colapsar panel"}
						aria-label={isCollapsed ? "Expandir panel" : "Colapsar panel"}
					>
						<span className="leading-none">{isCollapsed ? "▶" : "◀"}</span>
					</button>
				</div>
			</div>
		</div>
	);
}
