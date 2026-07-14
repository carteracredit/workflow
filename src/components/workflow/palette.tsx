"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import type { WorkflowNode, NodeType } from "@/lib/workflow/types";
import {
	ROLE_OPTIONS,
	createDefaultChallengeConfig,
	createDefaultPromotionConfig,
	createDefaultNLSConfig,
	createDefaultExternalLinkConfig,
	createDefaultAddCardConfig,
	createDefaultGeneratePdfConfig,
} from "@/lib/workflow/types";
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
	BadgePercent,
	Banknote,
	ExternalLink,
	CreditCard,
	FileOutput,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

const NODES_WITH_VISIBILITY_ROLES = new Set<NodeType>([
	"Form",
	"Challenge",
	"Message",
	"Promotion",
	"Decision",
	"Transform",
	"API",
	"Checkpoint",
	"FlagChange",
	"NLS",
	"ExternalLink",
	"AddCard",
	"GeneratePDF",
]);

interface PaletteProps {
	onAddNode: (node: WorkflowNode) => void;
	zoom: number;
	pan: { x: number; y: number };
	className?: string;
}

const NODE_CATEGORIES = [
	{
		id: "core",
		labelKey: "palette.categoryCore",
		nodes: [
			{
				type: "Start" as NodeType,
				labelKey: "palette.nodeStart",
				icon: <Play className="h-4 w-4" />,
				bgColor: "var(--node-bg-start)",
				iconColorVar: "--node-icon-start",
			},
		],
	},
	{
		id: "logic",
		labelKey: "palette.categoryLogic",
		nodes: [
			{
				type: "Decision" as NodeType,
				labelKey: "palette.nodeDecision",
				icon: <GitBranch className="h-4 w-4" />,
				bgColor: "var(--node-bg-decision)",
				iconColorVar: "--node-icon-decision",
			},
			{
				type: "Challenge" as NodeType,
				labelKey: "palette.nodeChallenge",
				icon: <Shield className="h-4 w-4" />,
				bgColor: "var(--node-bg-challenge)",
				iconColorVar: "--node-icon-challenge",
			},
			{
				type: "Checkpoint" as NodeType,
				labelKey: "palette.nodeCheckpoint",
				icon: <Flag className="h-4 w-4" />,
				bgColor: "var(--node-bg-checkpoint)",
				iconColorVar: "--node-icon-checkpoint",
			},
			{
				type: "Join" as NodeType,
				labelKey: "palette.nodeJoin",
				icon: <Merge className="h-4 w-4" />,
				bgColor: "var(--node-bg-join)",
				iconColorVar: "--node-icon-join",
			},
			{
				type: "FlagChange" as NodeType,
				labelKey: "palette.nodeFlagChange",
				icon: <Tag className="h-4 w-4" />,
				bgColor: "var(--node-bg-status)",
				iconColorVar: "--node-icon-status",
			},
		],
	},
	{
		id: "data",
		labelKey: "palette.categoryData",
		nodes: [
			{
				type: "Form" as NodeType,
				labelKey: "palette.nodeForm",
				icon: <FileText className="h-4 w-4" />,
				bgColor: "var(--node-bg-form)",
				iconColorVar: "--node-icon-form",
			},
			{
				type: "Transform" as NodeType,
				labelKey: "palette.nodeTransform",
				icon: <Code className="h-4 w-4" />,
				bgColor: "var(--node-bg-transform)",
				iconColorVar: "--node-icon-transform",
			},
			{
				type: "API" as NodeType,
				labelKey: "palette.nodeApi",
				icon: <Globe className="h-4 w-4" />,
				bgColor: "var(--node-bg-api)",
				iconColorVar: "--node-icon-api",
			},
			{
				type: "Message" as NodeType,
				labelKey: "palette.nodeMessage",
				icon: <Mail className="h-4 w-4" />,
				bgColor: "var(--node-bg-message)",
				iconColorVar: "--node-icon-message",
			},
			{
				type: "Promotion" as NodeType,
				labelKey: "palette.nodePromotion",
				icon: <BadgePercent className="h-4 w-4" />,
				bgColor: "var(--node-bg-promotion)",
				iconColorVar: "--node-icon-promotion",
			},
			{
				type: "ExternalLink" as NodeType,
				labelKey: "palette.nodeExternalLink",
				icon: <ExternalLink className="h-4 w-4" />,
				bgColor: "var(--node-bg-external-link)",
				iconColorVar: "--node-icon-external-link",
			},
			{
				type: "AddCard" as NodeType,
				labelKey: "palette.nodeAddCard",
				icon: <CreditCard className="h-4 w-4" />,
				bgColor: "var(--node-bg-add-card)",
				iconColorVar: "--node-icon-add-card",
			},
			{
				type: "GeneratePDF" as NodeType,
				labelKey: "palette.nodeGeneratePdf",
				icon: <FileOutput className="h-4 w-4" />,
				bgColor: "var(--node-bg-generate-pdf)",
				iconColorVar: "--node-icon-generate-pdf",
			},
		],
	},
	{
		id: "integrations",
		labelKey: "palette.categoryIntegrations",
		nodes: [
			{
				type: "NLS" as NodeType,
				labelKey: "palette.nodeNLS",
				icon: <Banknote className="h-4 w-4" />,
				bgColor: "var(--node-bg-nls)",
				iconColorVar: "--node-icon-nls",
			},
		],
	},
	{
		id: "terminal",
		labelKey: "palette.categoryTerminal",
		nodes: [
			{
				type: "End" as NodeType,
				labelKey: "palette.nodeEnd",
				icon: <Circle className="h-4 w-4" />,
				bgColor: "var(--node-bg-end)",
				iconColorVar: "--node-icon-end",
			},
			{
				type: "Reject" as NodeType,
				labelKey: "palette.nodeReject",
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
	if (type === "Promotion") {
		return createDefaultPromotionConfig();
	}
	if (type === "Message") {
		return { channel: "email", mergeVars: [] };
	}
	if (type === "NLS") {
		return createDefaultNLSConfig();
	}
	if (type === "ExternalLink") {
		return createDefaultExternalLinkConfig();
	}
	if (type === "AddCard") {
		return createDefaultAddCardConfig();
	}
	if (type === "GeneratePDF") {
		return createDefaultGeneratePdfConfig();
	}
	return {};
};

export function Palette({ onAddNode, zoom, pan, className }: PaletteProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const { t } = useLanguage();

	const handleAddNode = (type: NodeType, labelKey: string) => {
		const label = t(labelKey);
		// For the Start node we always use the canonical English title so that the
		// alias derived from it (titleToCamelCase → "start") is language-agnostic.
		// The localized label is stored in titleEs for display purposes only.
		const canonicalTitle = type === "Start" ? "Start" : label;
		const titleEs = type === "Start" ? t(labelKey) : undefined;
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
			title: canonicalTitle,
			titleEs,
			description: "",
			roles: [],
			visibilityRoles: NODES_WITH_VISIBILITY_ROLES.has(type)
				? [...ROLE_OPTIONS]
				: undefined,
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
			className={cn(
				"flex flex-nowrap items-center justify-center gap-2",
				className,
			)}
		>
			{NODE_CATEGORIES.map((category, index) => (
				<div key={category.id} className="flex items-center gap-2">
					{category.nodes.map(
						({ type, labelKey, icon, bgColor, iconColorVar }) => (
							<Tooltip key={type} delayDuration={200}>
								<TooltipTrigger asChild>
									<button
										type="button"
										className="group flex h-10 w-10 items-center justify-center rounded-md border border-border/70 bg-card transition-all hover:border-border hover:bg-accent hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										onClick={() => handleAddNode(type, labelKey)}
										aria-label={t("palette.addNodeLabel").replace(
											"{label}",
											t(labelKey),
										)}
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
								</TooltipTrigger>
								<TooltipContent side="bottom" sideOffset={8}>
									<p>{t(labelKey)}</p>
								</TooltipContent>
							</Tooltip>
						),
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
	);
}
