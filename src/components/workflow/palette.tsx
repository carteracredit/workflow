"use client";

import { useRef } from "react";
import type { WorkflowNode, NodeType } from "@/lib/workflow/types";
import { createDefaultChallengeConfig } from "@/lib/workflow/types";
import {
	XCircle,
	FileText,
	GitBranch,
	Code,
	Globe,
	Mail,
	Flag,
	Merge,
	Tag,
	Circle,
	Play,
	Shield,
} from "lucide-react";

interface PaletteProps {
	onAddNode: (node: WorkflowNode) => void;
	zoom: number;
	pan: { x: number; y: number };
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

export function Palette({ onAddNode, zoom, pan }: PaletteProps) {
	const containerRef = useRef<HTMLDivElement>(null);

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

	return (
		<div
			ref={containerRef}
			className="flex-shrink-0 border-b border-border bg-card px-4 py-3 shadow-sm"
		>
			<div className="flex flex-col gap-3">
				<div className="flex items-center gap-2 overflow-x-auto pb-1">
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
												style={{ opacity: 0 }}
											>
												{label}
											</span>
										</div>
									);
								},
							)}
							{index < NODE_CATEGORIES.length - 1 && (
								<div
									className="hidden h-8 w-px bg-border/40 last:hidden md:block"
									aria-hidden="true"
								/>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
