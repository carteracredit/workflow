"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type {
	WorkflowNode,
	WorkflowEdge,
	Role,
	WorkflowMetadata,
	Flag,
	APIFailureHandling,
	APIAuthConfig,
	APIAuthType,
	APIHeaderEntry,
	APIBodyConfig,
	APIBodyMode,
	APIResponseConfig,
	StaleTimeoutConfig,
	ChallengeNodeConfig,
	ChallengeType,
	ChallengeDeliveryMethod,
	ChallengeRetryConfig,
	MessageNodeConfig,
	MessageMergeVar,
	MessageChannel,
	OutputSchema,
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
	findUpstreamNodes,
	buildVariableSourceNodes,
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
import {
	validateTransformCode,
	validateConditionExpression,
} from "@/lib/workflow/validate-code";
import { OutputSchemaEditor } from "@/components/workflow/output-schema-editor";
import {
	VariableTemplateInput,
	VariablePicker,
} from "@/components/workflow/variable-picker";
import { FieldLabel } from "@/components/workflow/field-label";
import type { TemplateSegment } from "@/components/workflow/variable-picker";
import type { OutputSchemaProperty } from "@/lib/workflow/types";
import {
	listFormsAction,
	getFormAction,
} from "@/lib/workflow-api/forms-actions";
import type { Form as WorkflowForm } from "@/lib/workflow-api/forms";
import { buildOutputSchemaFromFields } from "@/lib/workflow/form-schema-utils";
import { useLanguage } from "@/components/LanguageProvider";

// ── Helpers ────────────────────────────────────────────────────────────────

function generateSchemaId() {
	return `prop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function jsonValueToSchemaProperty(
	key: string,
	value: unknown,
): OutputSchemaProperty {
	const base = { id: generateSchemaId(), name: key };
	if (value === null) return { ...base, type: "string" };
	if (Array.isArray(value)) {
		const firstItem = value[0];
		if (typeof firstItem === "object" && firstItem !== null) {
			return {
				...base,
				type: "array",
				items: {
					id: generateSchemaId(),
					name: "item",
					type: "object",
					properties: Object.entries(firstItem as Record<string, unknown>).map(
						([k, v]) => jsonValueToSchemaProperty(k, v),
					),
				},
			};
		}
		return {
			...base,
			type: "array",
			items: { id: generateSchemaId(), name: "item", type: "string" },
		};
	}
	if (typeof value === "object") {
		return {
			...base,
			type: "object",
			properties: Object.entries(value as Record<string, unknown>).map(
				([k, v]) => jsonValueToSchemaProperty(k, v),
			),
		};
	}
	if (typeof value === "boolean") return { ...base, type: "boolean" };
	if (typeof value === "number") return { ...base, type: "number" };
	return { ...base, type: "string" };
}

function inferSchemaFromJson(
	json: string,
	schemaName: string,
): OutputSchema | null {
	try {
		const parsed = JSON.parse(json) as Record<string, unknown>;
		if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null)
			return null;
		return {
			name: schemaName,
			properties: Object.entries(parsed).map(([k, v]) =>
				jsonValueToSchemaProperty(k, v),
			),
		};
	} catch {
		return null;
	}
}

interface PropertiesPanelProps {
	selectedNodes: WorkflowNode[];
	selectedEdges: WorkflowEdge[];
	workflowMetadata: WorkflowMetadata;
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	flags: Flag[];
	onUpdateNode: (
		nodeId: string,
		updates: Partial<WorkflowNode>,
		options?: { recordHistory?: boolean },
	) => void;
	onUpdateEdge: (edgeId: string, updates: Partial<WorkflowEdge>) => void;
	onUpdateMetadata: (updates: Partial<WorkflowMetadata>) => void;
	onAddEdge: (edge: WorkflowEdge) => void;
	onDeleteEdge: (edgeId: string) => void;
	showWorkflowProperties: boolean;
	onCloseWorkflowProperties: () => void;
	position?: "left" | "right";
	width?: number;
	onWidthChange?: (width: number) => void;
	onManageVariables?: () => void;
}

const NODES_WITH_ROLES = ["Form", "Challenge", "Message"];
const PANEL_MIN_WIDTH = 280;
const PANEL_MAX_WIDTH = 560;

const DEFAULT_STALE_TIMEOUT: StaleTimeoutConfig = {
	value: 24,
	unit: "hours",
};

const STALE_TIMEOUT_UNITS: Array<{
	label: string;
	value: StaleTimeoutConfig["unit"];
}> = [
	{ label: "hours", value: "hours" },
	{ label: "days", value: "days" },
];

const CHALLENGE_TYPE_OPTIONS: Array<{
	label: string;
	value: ChallengeType;
	descriptionKey: string;
}> = [
	{
		label: "acceptance",
		value: "acceptance",
		descriptionKey: "challengeAcceptanceDesc",
	},
	{
		label: "signature",
		value: "signature",
		descriptionKey: "challengeSignatureDesc",
	},
];

const CHALLENGE_DELIVERY_METHODS = [
	{ labelKey: "challengeDeliveryNone", value: "none" },
	{ labelKey: "challengeDeliverySms", value: "sms" },
	{ labelKey: "challengeDeliveryEmail", value: "email" },
	{ labelKey: "challengeDeliveryBoth", value: "both" },
] as const;

const CHALLENGE_TIMEOUT_UNITS = [
	{ labelKey: "challengeTimeoutSeconds", value: "seconds" },
	{ labelKey: "challengeTimeoutMinutes", value: "minutes" },
	{ labelKey: "challengeTimeoutHours", value: "hours" },
	{ labelKey: "challengeTimeoutDays", value: "days" },
] as const;

export function PropertiesPanel({
	selectedNodes,
	selectedEdges,
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
	position = "right",
	width,
	onWidthChange,
	onManageVariables,
}: PropertiesPanelProps) {
	const { t, getFieldLabel } = useLanguage();
	// For backward compatibility and single selection UI, use first selected item
	const selectedNode =
		selectedNodes.length === 1 ? selectedNodes[0] : undefined;
	const selectedEdge =
		selectedEdges.length === 1 ? selectedEdges[0] : undefined;
	const hasMultipleNodes = selectedNodes.length > 1;
	const hasMultipleEdges = selectedEdges.length > 1;
	// Check if there are multiple items selected (nodes + edges combined)
	const hasMultipleItems =
		selectedNodes.length + selectedEdges.length > 1 ||
		(selectedNodes.length > 0 && selectedEdges.length > 0);
	// Upstream variable source nodes for the variable picker
	const upstreamVariableNodes = useMemo(() => {
		if (!selectedNode) return [];
		const upstream = findUpstreamNodes(selectedNode.id, nodes, edges);
		return buildVariableSourceNodes(upstream);
	}, [selectedNode, nodes, edges]);

	// Ref to track textarea cursor for variable insertion (Decision/Transform)
	const conditionTextareaRef = useRef<HTMLTextAreaElement>(null);
	const transformTextareaRef = useRef<HTMLTextAreaElement>(null);
	const [showDecisionVarPicker, setShowDecisionVarPicker] = useState(false);
	const [showTransformVarPicker, setShowTransformVarPicker] = useState(false);

	// Estado local para el input de maxRetries del nodo API
	const [apiMaxRetriesInput, setApiMaxRetriesInput] = useState<string>("");

	// Estado para validacion de codigo Transform
	const [transformValidating, setTransformValidating] =
		useState<boolean>(false);
	const [transformValidationResult, setTransformValidationResult] = useState<{
		valid: boolean;
		error?: string;
	} | null>(null);

	// Estado para formularios disponibles (nodo Form)
	const [availableForms, setAvailableForms] = useState<WorkflowForm[]>([]);
	const [formsLoading, setFormsLoading] = useState(false);
	const [selectedFormFull, setSelectedFormFull] = useState<WorkflowForm | null>(
		null,
	);
	const [formVersionsLoading, setFormVersionsLoading] = useState(false);

	// Cargar forms publicados cuando hay un nodo Form seleccionado
	useEffect(() => {
		if (selectedNode?.type !== "Form") return;
		setFormsLoading(true);
		listFormsAction({ status: "published" })
			.then((forms) => setAvailableForms(forms))
			.catch(() => setAvailableForms([]))
			.finally(() => setFormsLoading(false));
	}, [selectedNode?.type]);

	// Cargar el formulario completo (con versiones) cuando ya hay un formId en el config
	useEffect(() => {
		if (selectedNode?.type !== "Form") {
			setSelectedFormFull(null);
			return;
		}
		const formId = selectedNode.config.formId as string | undefined;
		if (!formId) {
			setSelectedFormFull(null);
			return;
		}
		setFormVersionsLoading(true);
		getFormAction(formId)
			.then((form) => setSelectedFormFull(form))
			.catch(() => setSelectedFormFull(null))
			.finally(() => setFormVersionsLoading(false));
	}, [selectedNode?.type, selectedNode?.id, selectedNode?.config?.formId]);

	// Limpiar resultado de validacion cuando cambia el nodo seleccionado o su codigo
	useEffect(() => {
		setTransformValidationResult(null);
	}, [selectedNode?.id, selectedNode?.config?.code]);

	const handleValidateTransformCode = useCallback(async () => {
		const code = (selectedNode?.config?.code as string) || "";
		setTransformValidating(true);
		setTransformValidationResult(null);
		const result = await validateTransformCode(code);
		setTransformValidating(false);
		setTransformValidationResult(result);
	}, [selectedNode?.config?.code]);

	// Estado para modal de mock del nodo API
	const [showApiMock, setShowApiMock] = useState<boolean>(false);
	const [apiMockResponse, setApiMockResponse] = useState<string>("");
	const [apiMockSimulated, setApiMockSimulated] = useState<boolean>(false);
	const [apiMockError, setApiMockError] = useState<string | null>(null);

	// Limpiar estado mock cuando cambia el nodo seleccionado
	useEffect(() => {
		setShowApiMock(false);
		setApiMockSimulated(false);
		setApiMockError(null);
		setShowDecisionVarPicker(false);
		setShowTransformVarPicker(false);
	}, [selectedNode?.id]);

	const handleOpenApiMock = useCallback(() => {
		const savedMock = (selectedNode?.config?.mockResponse as string) || "";
		setApiMockResponse(
			savedMock ||
				JSON.stringify(
					{ success: true, data: { example: "response" } },
					null,
					2,
				),
		);
		setApiMockSimulated(false);
		setApiMockError(null);
		setShowApiMock(true);
	}, [selectedNode?.config?.mockResponse]);

	const handleSimulateMock = useCallback(() => {
		try {
			JSON.parse(apiMockResponse);
			setApiMockError(null);
			setApiMockSimulated(true);
			if (selectedNode) {
				onUpdateNode(selectedNode.id, {
					config: {
						...selectedNode.config,
						mockResponse: apiMockResponse,
					},
				});
			}
		} catch {
			setApiMockError(t("propertiesPanel.apiInvalidMockJson"));
			setApiMockSimulated(false);
		}
	}, [apiMockResponse, selectedNode, onUpdateNode]);

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

	// ── Output schema helpers ─────────────────────────────────────────────
	const handleUpdateOutputSchema = useCallback(
		(schema: OutputSchema) => {
			if (!selectedNode) return;
			onUpdateNode(selectedNode.id, {
				config: { ...selectedNode.config, outputSchema: schema },
			});
		},
		[selectedNode, onUpdateNode],
	);

	const handleInferSchemaFromMock = useCallback(() => {
		if (!selectedNode) return;
		const mockJson = (selectedNode.config.mockResponse as string) || "";
		const schemaName = `${selectedNode.title || "API"}Output`;
		const inferred = inferSchemaFromJson(mockJson, schemaName);
		if (inferred) handleUpdateOutputSchema(inferred);
	}, [selectedNode, handleUpdateOutputSchema]);

	// ── Variable template segment helpers ────────────────────────────────
	const handleUrlSegmentsChange = useCallback(
		(segments: TemplateSegment[]) => {
			if (!selectedNode) return;
			const rendered = segments
				.map((s) => (s.type === "variable" ? `\${${s.variablePath}}` : s.value))
				.join("");
			onUpdateNode(selectedNode.id, {
				config: {
					...selectedNode.config,
					url: rendered,
					urlSegments: segments,
				},
			});
		},
		[selectedNode, onUpdateNode],
	);

	const handleMessageTemplateSegmentsChange = useCallback(
		(segments: TemplateSegment[]) => {
			if (!selectedNode) return;
			const rendered = segments
				.map((s) => (s.type === "variable" ? `\${${s.variablePath}}` : s.value))
				.join("");
			onUpdateNode(selectedNode.id, {
				config: {
					...selectedNode.config,
					template: rendered,
					templateSegments: segments,
				},
			});
		},
		[selectedNode, onUpdateNode],
	);

	// ── Variable insertion at cursor (Decision / Transform) ───────────────
	const insertVariableAtCursor = useCallback(
		(
			ref: React.RefObject<HTMLTextAreaElement | null>,
			path: string,
			configKey: string,
		) => {
			if (!selectedNode || !ref.current) return;
			const el = ref.current;
			const start = el.selectionStart ?? 0;
			const end = el.selectionEnd ?? 0;
			const current = (selectedNode.config[configKey] as string) || "";
			const token = `\${${path}}`;
			const next = current.slice(0, start) + token + current.slice(end);
			onUpdateNode(selectedNode.id, {
				config: { ...selectedNode.config, [configKey]: next },
			});
			// Restore focus and cursor after the inserted token
			requestAnimationFrame(() => {
				el.focus();
				const pos = start + token.length;
				el.setSelectionRange(pos, pos);
			});
		},
		[selectedNode, onUpdateNode],
	);

	const panelSideClass = position === "left" ? "border-r" : "border-l";
	const panelWidth = width ?? 320;
	const panelContainerClass = cn(
		"border-border bg-card overflow-hidden flex flex-col relative",
		panelSideClass,
	);
	const panelContainerStyle = {
		width: panelWidth,
		minWidth: PANEL_MIN_WIDTH,
		maxWidth: PANEL_MAX_WIDTH,
	} as const;
	const panelContainerProps = {
		className: panelContainerClass,
		style: panelContainerStyle,
		"data-workflow-panel": "properties",
	} as const;

	const handleResizePointerDown = useCallback(
		(e: React.PointerEvent) => {
			if (!onWidthChange) return;
			e.preventDefault();
			const startX = e.clientX;
			const startWidth = panelWidth;

			const onPointerMove = (moveEvent: PointerEvent) => {
				const delta =
					position === "left"
						? moveEvent.clientX - startX
						: startX - moveEvent.clientX;
				const next = Math.max(
					PANEL_MIN_WIDTH,
					Math.min(PANEL_MAX_WIDTH, startWidth + delta),
				);
				onWidthChange(next);
			};

			const onPointerUp = () => {
				document.removeEventListener("pointermove", onPointerMove);
				document.removeEventListener("pointerup", onPointerUp);
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
			};

			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";
			document.addEventListener("pointermove", onPointerMove);
			document.addEventListener("pointerup", onPointerUp);
		},
		[onWidthChange, panelWidth, position],
	);

	const resizeHandle = onWidthChange ? (
		<div
			onPointerDown={handleResizePointerDown}
			className={cn(
				"absolute inset-y-0 w-1.5 z-10 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors",
				position === "left" ? "right-0" : "left-0",
			)}
		/>
	) : null;

	// Prioridad: Si showWorkflowProperties está activo, mostrar propiedades del flujo
	// (incluso si hay un nodo o edge seleccionado)
	if (
		showWorkflowProperties &&
		selectedNodes.length === 0 &&
		selectedEdges.length === 0
	) {
		const edgeColors = [
			{ name: t("propertiesPanel.edgeColorDefault"), value: "default" },
			{ name: t("propertiesPanel.edgeColorBlue"), value: "rgb(59, 130, 246)" },
			{ name: t("propertiesPanel.edgeColorGreen"), value: "rgb(34, 197, 94)" },
			{ name: t("propertiesPanel.edgeColorRed"), value: "rgb(239, 68, 68)" },
			{ name: t("propertiesPanel.edgeColorYellow"), value: "rgb(234, 179, 8)" },
			{
				name: t("propertiesPanel.edgeColorPurple"),
				value: "rgb(168, 85, 247)",
			},
			{ name: t("propertiesPanel.edgeColorPink"), value: "rgb(236, 72, 153)" },
			{
				name: t("propertiesPanel.edgeColorOrange"),
				value: "rgb(249, 115, 22)",
			},
		];
		void edgeColors;
		return (
			<div {...panelContainerProps}>
				{resizeHandle}
				<div className="border-b border-border p-4 flex items-center justify-between flex-shrink-0">
					<h2 className="font-semibold">
						{t("propertiesPanel.flowPropsTitle")}
					</h2>
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6"
						onClick={onCloseWorkflowProperties}
						title={t("propertiesPanel.closeTitle")}
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

				<ScrollArea className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
					<div className="space-y-4 p-4">
						{/* Workflow Name (Bilingual) */}
						<div className="space-y-2">
							<Label>{t("propertiesPanel.workflowNameLabel")}</Label>
							<div className="grid grid-cols-2 gap-2">
								<Input
									id="workflow-name"
									value={workflowMetadata.name}
									onChange={(e) => onUpdateMetadata({ name: e.target.value })}
									placeholder={t("propertiesPanel.workflowNamePlaceholder")}
								/>
								<Input
									id="workflow-name-es"
									value={workflowMetadata.nameEs || ""}
									onChange={(e) =>
										onUpdateMetadata({
											nameEs: e.target.value.trim() || undefined,
										})
									}
									placeholder={t("propertiesPanel.workflowNameEsPlaceholder")}
								/>
							</div>
							<div className="grid grid-cols-2 gap-2">
								<span className="text-[10px] text-muted-foreground">
									{t("common.english")}
								</span>
								<span className="text-[10px] text-muted-foreground">
									{t("common.spanish")}
								</span>
							</div>
						</div>

						{/* Workflow Description (Bilingual) */}
						<div className="space-y-2">
							<Label>{t("propertiesPanel.workflowDescLabel")}</Label>
							<div className="grid grid-cols-2 gap-2">
								<Textarea
									id="workflow-description"
									value={workflowMetadata.description}
									onChange={(e) =>
										onUpdateMetadata({ description: e.target.value })
									}
									placeholder={t("propertiesPanel.workflowDescPlaceholder")}
									rows={3}
								/>
								<Textarea
									id="workflow-description-es"
									value={workflowMetadata.descriptionEs || ""}
									onChange={(e) =>
										onUpdateMetadata({
											descriptionEs: e.target.value.trim() || undefined,
										})
									}
									placeholder={t("propertiesPanel.workflowDescEsPlaceholder")}
									rows={3}
								/>
							</div>
							<div className="grid grid-cols-2 gap-2">
								<span className="text-[10px] text-muted-foreground">
									{t("common.english")}
								</span>
								<span className="text-[10px] text-muted-foreground">
									{t("common.spanish")}
								</span>
							</div>
						</div>

						{/* Version — read-only, managed automatically by the publish system */}
						<div className="space-y-2">
							<Label
								htmlFor="workflow-version"
								className="text-muted-foreground"
							>
								{t("propertiesPanel.workflowVersionLabel")}{" "}
								<span className="text-xs font-normal">
									{t("propertiesPanel.workflowVersionAuto")}
								</span>
							</Label>
							<Input
								id="workflow-version"
								value={
									workflowMetadata.version ||
									t("propertiesPanel.workflowVersionUnpublished")
								}
								readOnly
								disabled
								className="cursor-default opacity-60"
							/>
						</div>

						{/* Author */}
						<div className="space-y-2">
							<Label htmlFor="workflow-author">
								{t("propertiesPanel.workflowAuthorLabel")}
							</Label>
							<Input
								id="workflow-author"
								value={workflowMetadata.author}
								onChange={(e) => onUpdateMetadata({ author: e.target.value })}
								placeholder={t("propertiesPanel.workflowAuthorPlaceholder")}
							/>
						</div>

						{/* Tags */}
						<div className="space-y-2">
							<Label htmlFor="workflow-tags">
								{t("propertiesPanel.workflowTagsLabel")}
							</Label>
							<Input
								id="workflow-tags"
								value={workflowMetadata.tags.join(", ")}
								onChange={(e) =>
									onUpdateMetadata({
										tags: e.target.value
											.split(",")
											.map((tag) => tag.trim())
											.filter(Boolean),
									})
								}
								placeholder={t("propertiesPanel.workflowTagsPlaceholder")}
							/>
						</div>

						{/* Timestamps */}
						<div className="space-y-2">
							<Label>{t("propertiesPanel.workflowDatesLabel")}</Label>
							<div className="rounded-md bg-muted p-3 text-xs">
								<div className="space-y-1">
									<div>
										<span className="font-medium">
											{t("propertiesPanel.workflowCreated")}:
										</span>{" "}
										{new Date(workflowMetadata.createdAt).toLocaleString(
											"es-MX",
										)}
									</div>
									<div>
										<span className="font-medium">
											{t("propertiesPanel.workflowUpdated")}:
										</span>{" "}
										{new Date(workflowMetadata.updatedAt).toLocaleString(
											"es-MX",
										)}
									</div>
								</div>
							</div>
						</div>

						{/* Help Text */}
						<div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
							<p className="font-medium">
								{t("propertiesPanel.workflowInfoTitle")}:
							</p>
							<p className="mt-1">{t("propertiesPanel.workflowInfoBody")}</p>
						</div>
					</div>
				</ScrollArea>
			</div>
		);
	}

	// Don't show panel when multiple items are selected (including mixed selection)
	if (hasMultipleItems) {
		return null;
	}

	if (selectedEdge) {
		const edgeColors = [
			{ name: t("propertiesPanel.edgeColorDefault"), value: "default" },
			{ name: t("propertiesPanel.edgeColorBlue"), value: "rgb(59, 130, 246)" },
			{ name: t("propertiesPanel.edgeColorGreen"), value: "rgb(34, 197, 94)" },
			{ name: t("propertiesPanel.edgeColorRed"), value: "rgb(239, 68, 68)" },
			{ name: t("propertiesPanel.edgeColorYellow"), value: "rgb(234, 179, 8)" },
			{
				name: t("propertiesPanel.edgeColorPurple"),
				value: "rgb(168, 85, 247)",
			},
			{ name: t("propertiesPanel.edgeColorPink"), value: "rgb(236, 72, 153)" },
			{
				name: t("propertiesPanel.edgeColorOrange"),
				value: "rgb(249, 115, 22)",
			},
		];
		return (
			<div {...panelContainerProps}>
				{resizeHandle}
				<div className="border-b border-border p-4 flex-shrink-0">
					<h2 className="font-semibold">
						{t("propertiesPanel.edgePropsTitle")}
					</h2>
				</div>

				<ScrollArea className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
					<div className="space-y-4 p-4">
						{/* Edge Label (Bilingual) */}
						<div className="space-y-2">
							<Label>{t("propertiesPanel.edgeLabelLabel")}</Label>
							<div className="grid grid-cols-2 gap-2">
								<Input
									id="edge-label"
									value={selectedEdge.label || ""}
									onChange={(e) =>
										onUpdateEdge(selectedEdge.id, {
											label: e.target.value || null,
										})
									}
									placeholder={t("propertiesPanel.edgeLabelPlaceholder")}
								/>
								<Input
									id="edge-label-es"
									value={selectedEdge.labelEs || ""}
									onChange={(e) =>
										onUpdateEdge(selectedEdge.id, {
											labelEs: e.target.value || null,
										})
									}
									placeholder={t("propertiesPanel.edgeLabelEsPlaceholder")}
								/>
							</div>
							<div className="grid grid-cols-2 gap-2">
								<span className="text-[10px] text-muted-foreground">
									{t("common.english")}
								</span>
								<span className="text-[10px] text-muted-foreground">
									{t("common.spanish")}
								</span>
							</div>
						</div>

						{/* Edge Color */}
						<div className="space-y-2">
							<Label htmlFor="edge-color">
								{t("propertiesPanel.edgeColorLabel")}
							</Label>
							<Select
								value={selectedEdge.color || "default"}
								onValueChange={(value) =>
									onUpdateEdge(selectedEdge.id, {
										color: value === "default" ? undefined : value,
									})
								}
							>
								<SelectTrigger id="edge-color">
									<SelectValue
										placeholder={t("propertiesPanel.edgeColorPlaceholder")}
									/>
								</SelectTrigger>
								<SelectContent>
									{edgeColors.map((color) => (
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
								{t("propertiesPanel.edgeThicknessLabel").replace(
									"{n}",
									String(selectedEdge.thickness || 2),
								)}
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
							<Label>{t("propertiesPanel.edgePreviewLabel")}</Label>
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
											{getFieldLabel(
												selectedEdge.label,
												selectedEdge.labelEs ?? undefined,
											)}
										</text>
									)}
								</svg>
							</div>
						</div>

						{/* Help Text */}
						<div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
							<p className="font-medium">
								{t("propertiesPanel.edgeShortcutsTitle")}
							</p>
							<ul className="mt-1 space-y-1">
								<li>{t("propertiesPanel.edgeShortcutClick")}</li>
								<li>{t("propertiesPanel.edgeShortcutShiftClick")}</li>
								<li>{t("propertiesPanel.edgeShortcutDelete")}</li>
							</ul>
						</div>
					</div>
				</ScrollArea>
			</div>
		);
	}

	// Si no hay nodo ni edge seleccionado, solo mostrar si showWorkflowProperties está activo
	if (selectedNodes.length === 0 && selectedEdges.length === 0) {
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

	// Message node helpers
	const messageConfig =
		selectedNode.type === "Message"
			? ((selectedNode.config as MessageNodeConfig | undefined) ?? {
					channel: "email" as MessageChannel,
					mergeVars: [],
				})
			: null;

	const setMessageConfig = (nextConfig: MessageNodeConfig) => {
		onUpdateNode(selectedNode.id, { config: nextConfig });
	};

	const handleMessageMergeVarAdd = () => {
		if (!messageConfig) return;
		setMessageConfig({
			...messageConfig,
			mergeVars: [...(messageConfig.mergeVars ?? []), { key: "", value: "" }],
		});
	};

	const handleMessageMergeVarUpdate = (
		index: number,
		field: keyof MessageMergeVar,
		value: string,
	) => {
		if (!messageConfig) return;
		const updated = (messageConfig.mergeVars ?? []).map((v, i) =>
			i === index ? { ...v, [field]: value } : v,
		);
		setMessageConfig({ ...messageConfig, mergeVars: updated });
	};

	const handleMessageMergeVarRemove = (index: number) => {
		if (!messageConfig) return;
		setMessageConfig({
			...messageConfig,
			mergeVars: (messageConfig.mergeVars ?? []).filter((_, i) => i !== index),
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
		<div {...panelContainerProps}>
			{resizeHandle}
			<div className="border-b border-border p-4 flex-shrink-0">
				<h2 className="font-semibold">{t("propertiesPanel.nodePropsTitle")}</h2>
			</div>

			<ScrollArea className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
				<div className="space-y-4 p-4 min-w-0 max-w-full overflow-hidden">
					{/* Title (Bilingual) */}
					<div className="space-y-2 w-full">
						<Label>{t("propertiesPanel.nodeTitleLabel")}</Label>
						<div className="grid grid-cols-2 gap-2">
							<Input
								id="title"
								value={selectedNode.title}
								onChange={(e) =>
									onUpdateNode(selectedNode.id, { title: e.target.value })
								}
								placeholder={t("propertiesPanel.nodeTitlePlaceholder")}
								className="w-full"
							/>
							<Input
								id="title-es"
								value={selectedNode.titleEs || ""}
								onChange={(e) =>
									onUpdateNode(selectedNode.id, {
										titleEs: e.target.value.trim() || undefined,
									})
								}
								placeholder={t("propertiesPanel.nodeTitleEsPlaceholder")}
								className="w-full"
							/>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<span className="text-[10px] text-muted-foreground">
								{t("common.english")}
							</span>
							<span className="text-[10px] text-muted-foreground">
								{t("common.spanish")}
							</span>
						</div>
					</div>

					{/* Description (Bilingual) */}
					<div className="space-y-2 w-full">
						<Label>{t("propertiesPanel.nodeDescLabel")}</Label>
						<div className="grid grid-cols-2 gap-2">
							<Textarea
								id="description"
								value={selectedNode.description}
								onChange={(e) =>
									onUpdateNode(selectedNode.id, {
										description: e.target.value,
									})
								}
								placeholder={t("propertiesPanel.nodeDescPlaceholder")}
								rows={3}
								className="w-full"
							/>
							<Textarea
								id="description-es"
								value={selectedNode.descriptionEs || ""}
								onChange={(e) =>
									onUpdateNode(selectedNode.id, {
										descriptionEs: e.target.value.trim() || undefined,
									})
								}
								placeholder={t("propertiesPanel.nodeDescEsPlaceholder")}
								rows={3}
								className="w-full"
							/>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<span className="text-[10px] text-muted-foreground">
								{t("common.english")}
							</span>
							<span className="text-[10px] text-muted-foreground">
								{t("common.spanish")}
							</span>
						</div>
					</div>

					{supportsStaleTimeout && (
						<div className="space-y-3 rounded-md border border-border/60 p-3">
							<div className="flex items-center justify-between gap-4">
								<div>
									<FieldLabel
										htmlFor="stale-toggle"
										description={t("propertiesPanel.staleTimeoutDesc")}
									>
										{t("propertiesPanel.staleTimeoutLabel")}
									</FieldLabel>
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
										<Label htmlFor="stale-duration">
											{t("propertiesPanel.staleDurationLabel")}
										</Label>
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
										<Label htmlFor="stale-unit">
											{t("propertiesPanel.staleUnitLabel")}
										</Label>
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
												<SelectValue
													placeholder={t(
														"propertiesPanel.staleUnitPlaceholder",
													)}
												/>
											</SelectTrigger>
											<SelectContent>
												{STALE_TIMEOUT_UNITS.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.value === "hours"
															? t("propertiesPanel.staleUnitHours")
															: t("propertiesPanel.staleUnitDays")}
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
							<Label>{t("propertiesPanel.rolesLabel")}</Label>
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
											{t(`propertiesPanel.roleNames.${role}`)}
										</label>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Start node: input schema */}
					{selectedNode.type === "Start" && (
						<OutputSchemaEditor
							value={
								selectedNode.config.outputSchema as OutputSchema | undefined
							}
							onChange={handleUpdateOutputSchema}
							label={t("propertiesPanel.startSchemaLabel")}
						/>
					)}

					{/* Type-specific configuration */}
					{selectedNode.type === "Form" && (
						<div className="space-y-3">
							<div className="space-y-2">
								<Label htmlFor="form-select">
									{t("propertiesPanel.formSelectLabel")}
								</Label>
								<Select
									value={(selectedNode.config.formId as string) || ""}
									onValueChange={async (value) => {
										const updates: Partial<WorkflowNode> = {
											config: {
												...selectedNode.config,
												formId: value,
												formVersion: undefined,
											},
										};
										try {
											setFormVersionsLoading(true);
											const fullForm = await getFormAction(value);
											setSelectedFormFull(fullForm);
											const latestVersion =
												fullForm.versions.length > 0
													? fullForm.versions.reduce((a, b) =>
															a.version > b.version ? a : b,
														)
													: null;
											if (latestVersion?.fields) {
												updates.config = {
													...updates.config,
													formVersion: latestVersion.version,
													outputSchema: buildOutputSchemaFromFields(
														latestVersion.fields,
														fullForm.name,
													),
												};
											}
										} catch {
											setSelectedFormFull(null);
										} finally {
											setFormVersionsLoading(false);
										}
										onUpdateNode(selectedNode.id, updates);
									}}
									disabled={formsLoading}
								>
									<SelectTrigger id="form-select">
										<SelectValue
											placeholder={
												formsLoading
													? t("propertiesPanel.formSelectLoadingPlaceholder")
													: t("propertiesPanel.formSelectPlaceholder")
											}
										/>
									</SelectTrigger>
									<SelectContent>
										{availableForms.length === 0 && !formsLoading ? (
											<SelectItem value="__empty__" disabled>
												{t("propertiesPanel.formNoForms")}
											</SelectItem>
										) : (
											availableForms.map((form) => (
												<SelectItem key={form.id} value={form.id}>
													{form.name}
												</SelectItem>
											))
										)}
									</SelectContent>
								</Select>
								{availableForms.length === 0 && !formsLoading && (
									<p className="text-xs text-muted-foreground">
										{t("propertiesPanel.formNoFormsNote")}
									</p>
								)}
							</div>
							{/* Version selector */}
							{!!(selectedNode.config.formId as string | undefined) &&
								(selectedFormFull?.versions?.length ?? 0) > 0 && (
									<div className="space-y-2">
										<Label htmlFor="form-version-select">
											{t("propertiesPanel.formVersionLabel")}
										</Label>
										<Select
											value={
												(
													selectedNode.config.formVersion as number | undefined
												)?.toString() ?? ""
											}
											onValueChange={(val) => {
												const versionNumber = Number(val);
												const version = selectedFormFull?.versions.find(
													(v) => v.version === versionNumber,
												);
												const updates: Partial<WorkflowNode> = {
													config: {
														...selectedNode.config,
														formVersion: versionNumber,
													},
												};
												if (version?.fields) {
													updates.config = {
														...updates.config,
														outputSchema: buildOutputSchemaFromFields(
															version.fields,
															selectedFormFull?.name ?? "Form",
														),
													};
												}
												onUpdateNode(selectedNode.id, updates);
											}}
											disabled={formVersionsLoading}
										>
											<SelectTrigger id="form-version-select">
												<SelectValue
													placeholder={
														formVersionsLoading
															? t(
																	"propertiesPanel.formVersionLoadingPlaceholder",
																)
															: t("propertiesPanel.formVersionPlaceholder")
													}
												/>
											</SelectTrigger>
											<SelectContent>
												{selectedFormFull?.versions
													.slice()
													.sort((a, b) => b.version - a.version)
													.map((v) => (
														<SelectItem key={v.id} value={v.version.toString()}>
															v{v.version}
															{v.version ===
																selectedFormFull.currentVersion && (
																<span className="ml-2 text-xs text-muted-foreground">
																	{t("propertiesPanel.formVersionLatest")}
																</span>
															)}
														</SelectItem>
													))}
											</SelectContent>
										</Select>
									</div>
								)}
							<OutputSchemaEditor
								value={
									selectedNode.config.outputSchema as OutputSchema | undefined
								}
								onChange={handleUpdateOutputSchema}
								label={t("propertiesPanel.outputSchemaLabel")}
							/>
						</div>
					)}

					{selectedNode.type === "Decision" && (
						<div className="space-y-2">
							<Label htmlFor="condition">
								{t("propertiesPanel.conditionLabel")}
							</Label>
							<Textarea
								id="condition"
								ref={conditionTextareaRef}
								value={(selectedNode.config.condition as string) || ""}
								onChange={(e) =>
									onUpdateNode(selectedNode.id, {
										config: {
											...selectedNode.config,
											condition: e.target.value,
										},
									})
								}
								placeholder={t("propertiesPanel.conditionPlaceholder")}
								rows={3}
							/>
							<div className="rounded-md border border-border/60 overflow-hidden">
								<button
									type="button"
									onClick={() =>
										setShowDecisionVarPicker(!showDecisionVarPicker)
									}
									className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors text-xs text-muted-foreground"
								>
									<span className="font-medium">
										{t("propertiesPanel.availableVarsLabel")}
									</span>
									<span>{showDecisionVarPicker ? "▲" : "▼"}</span>
								</button>
								{showDecisionVarPicker &&
									(upstreamVariableNodes.length > 0 ? (
										<VariablePicker
											nodes={upstreamVariableNodes}
											onSelect={(variable) =>
												insertVariableAtCursor(
													conditionTextareaRef,
													variable.path,
													"condition",
												)
											}
											className="rounded-none border-0 shadow-none"
										/>
									) : (
										<div className="px-3 py-2 text-xs text-muted-foreground">
											{t("propertiesPanel.noVarsAvailable")}
										</div>
									))}
							</div>
						</div>
					)}

					{selectedNode.type === "Transform" && (
						<div className="space-y-2">
							<Label htmlFor="transform-code">
								{t("propertiesPanel.transformCodeLabel")}
							</Label>
							<Textarea
								id="transform-code"
								ref={transformTextareaRef}
								value={(selectedNode.config.code as string) || ""}
								onChange={(e) => {
									onUpdateNode(selectedNode.id, {
										config: { ...selectedNode.config, code: e.target.value },
									});
								}}
								placeholder={t("propertiesPanel.transformCodePlaceholder")}
								rows={6}
								className="font-mono text-xs"
							/>
							<div className="rounded-md border border-border/60 overflow-hidden">
								<button
									type="button"
									onClick={() =>
										setShowTransformVarPicker(!showTransformVarPicker)
									}
									className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors text-xs text-muted-foreground"
								>
									<span className="font-medium">
										{t("propertiesPanel.availableVarsLabel")}
									</span>
									<span>{showTransformVarPicker ? "▲" : "▼"}</span>
								</button>
								{showTransformVarPicker &&
									(upstreamVariableNodes.length > 0 ? (
										<VariablePicker
											nodes={upstreamVariableNodes}
											onSelect={(variable) =>
												insertVariableAtCursor(
													transformTextareaRef,
													variable.path,
													"code",
												)
											}
											className="rounded-none border-0 shadow-none"
										/>
									) : (
										<div className="px-3 py-2 text-xs text-muted-foreground">
											{t("propertiesPanel.noVarsAvailable")}
										</div>
									))}
							</div>
							<Button
								size="sm"
								variant="secondary"
								className="w-full"
								onClick={handleValidateTransformCode}
								disabled={
									transformValidating ||
									!(selectedNode.config.code as string)?.trim()
								}
							>
								{transformValidating ? (
									<span className="flex items-center gap-2">
										<svg
											className="h-3 w-3 animate-spin"
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
										>
											<circle
												className="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												strokeWidth="4"
											/>
											<path
												className="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
											/>
										</svg>
										{t("propertiesPanel.validatingCode")}
									</span>
								) : (
									t("propertiesPanel.validateCodeBtn")
								)}
							</Button>
							{transformValidationResult !== null && (
								<div
									className={cn(
										"rounded-md p-3 text-xs",
										transformValidationResult.valid
											? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
											: "bg-destructive/10 text-destructive",
									)}
								>
									{transformValidationResult.valid ? (
										<span className="font-medium">
											{t("propertiesPanel.codeValid")}
										</span>
									) : (
										<>
											<p className="font-medium">
												{t("propertiesPanel.codeSyntaxError")}
											</p>
											<p className="mt-1">{transformValidationResult.error}</p>
										</>
									)}
								</div>
							)}
							<OutputSchemaEditor
								value={
									selectedNode.config.outputSchema as OutputSchema | undefined
								}
								onChange={handleUpdateOutputSchema}
								label={t("propertiesPanel.outputSchemaLabel")}
							/>
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
							const selectedCheckpointId =
								(failureHandling.checkpointId as string) ||
								allCheckpoints[0] ||
								null;

							return (
								<div className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="api-method">
											{t("propertiesPanel.apiMethodLabel")}
										</Label>
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
												<SelectItem value="PATCH">PATCH</SelectItem>
												<SelectItem value="DELETE">DELETE</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label htmlFor="api-url">
											{t("propertiesPanel.apiUrlLabel")}
										</Label>
										<VariableTemplateInput
											nodes={upstreamVariableNodes}
											value={
												(selectedNode.config.urlSegments as
													| TemplateSegment[]
													| undefined) ?? undefined
											}
											onChange={handleUrlSegmentsChange}
											placeholder="https://api.example.com/endpoint"
										/>
									</div>

									{/* ── Authentication ───────────────────────── */}
									<div className="border-t border-border pt-4 space-y-3">
										<h3 className="font-semibold text-sm">
											{t("propertiesPanel.apiAuthTitle")}
										</h3>
										<div className="space-y-2">
											<Label>{t("propertiesPanel.apiAuthTypeLabel")}</Label>
											<Select
												value={
													(
														selectedNode.config.authConfig as
															| APIAuthConfig
															| undefined
													)?.type ?? "none"
												}
												onValueChange={(value) =>
													onUpdateNode(selectedNode.id, {
														config: {
															...selectedNode.config,
															authConfig: {
																...((selectedNode.config.authConfig as
																	| APIAuthConfig
																	| undefined) ?? {}),
																type: value as APIAuthType,
															},
														},
													})
												}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="none">
														{t("propertiesPanel.apiAuthNone")}
													</SelectItem>
													<SelectItem value="bearer">
														{t("propertiesPanel.apiAuthBearer")}
													</SelectItem>
													<SelectItem value="api-key">
														{t("propertiesPanel.apiAuthApiKey")}
													</SelectItem>
													<SelectItem value="oauth2-client-credentials">
														{t("propertiesPanel.apiAuthOauth2")}
													</SelectItem>
												</SelectContent>
											</Select>
										</div>

										{(() => {
											const auth = (selectedNode.config.authConfig as
												| APIAuthConfig
												| undefined) ?? { type: "none" };
											const updateAuth = (patch: Partial<APIAuthConfig>) =>
												onUpdateNode(selectedNode.id, {
													config: {
														...selectedNode.config,
														authConfig: { ...auth, ...patch },
													},
												});

											if (auth.type === "bearer") {
												return (
													<div className="space-y-2">
														<Label>
															{t("propertiesPanel.apiAuthBearerTokenLabel")}
														</Label>
														<Input
															value={auth.bearerToken ?? ""}
															onChange={(e) =>
																updateAuth({ bearerToken: e.target.value })
															}
															placeholder={t(
																"propertiesPanel.apiAuthBearerTokenPlaceholder",
															)}
															className="font-mono text-sm"
														/>
														<p className="text-xs text-muted-foreground">
															{t("propertiesPanel.apiAuthBearerTokenDesc")}
														</p>
													</div>
												);
											}
											if (auth.type === "api-key") {
												return (
													<div className="space-y-2">
														<div className="space-y-1">
															<Label>
																{t("propertiesPanel.apiAuthApiKeyHeaderLabel")}
															</Label>
															<Input
																value={auth.apiKeyHeader ?? ""}
																onChange={(e) =>
																	updateAuth({ apiKeyHeader: e.target.value })
																}
																placeholder={t(
																	"propertiesPanel.apiAuthApiKeyHeaderPlaceholder",
																)}
																className="font-mono text-sm"
															/>
														</div>
														<div className="space-y-1">
															<Label>
																{t("propertiesPanel.apiAuthApiKeyValueLabel")}
															</Label>
															<Input
																value={auth.apiKeyValue ?? ""}
																onChange={(e) =>
																	updateAuth({ apiKeyValue: e.target.value })
																}
																placeholder={t(
																	"propertiesPanel.apiAuthApiKeyValuePlaceholder",
																)}
																className="font-mono text-sm"
															/>
															<p className="text-xs text-muted-foreground">
																{t("propertiesPanel.apiAuthApiKeyValueDesc")}
															</p>
														</div>
													</div>
												);
											}
											if (auth.type === "oauth2-client-credentials") {
												return (
													<div className="space-y-2">
														{(
															[
																[
																	"oauth2TokenUrl",
																	"apiAuthOauth2TokenUrlLabel",
																	"apiAuthOauth2TokenUrlPlaceholder",
																],
																[
																	"oauth2ClientId",
																	"apiAuthOauth2ClientIdLabel",
																	"apiAuthOauth2ClientIdPlaceholder",
																],
																[
																	"oauth2ClientSecret",
																	"apiAuthOauth2ClientSecretLabel",
																	"apiAuthOauth2ClientSecretPlaceholder",
																],
																[
																	"oauth2Scope",
																	"apiAuthOauth2ScopeLabel",
																	"apiAuthOauth2ScopePlaceholder",
																],
																[
																	"oauth2Username",
																	"apiAuthOauth2UsernameLabel",
																	"apiAuthOauth2UsernamePlaceholder",
																],
																[
																	"oauth2Password",
																	"apiAuthOauth2PasswordLabel",
																	"apiAuthOauth2PasswordPlaceholder",
																],
															] as const
														).map(([field, labelKey, phKey]) => (
															<div key={field} className="space-y-1">
																<Label>
																	{t(`propertiesPanel.${labelKey}`)}
																</Label>
																<Input
																	value={
																		(auth[field] as string | undefined) ?? ""
																	}
																	onChange={(e) =>
																		updateAuth({ [field]: e.target.value })
																	}
																	placeholder={t(`propertiesPanel.${phKey}`)}
																	className="font-mono text-sm"
																/>
															</div>
														))}
														<p className="text-xs text-muted-foreground">
															{t("propertiesPanel.apiAuthOauth2Note")}
														</p>
													</div>
												);
											}
											return null;
										})()}

										{onManageVariables && (
											<button
												type="button"
												onClick={onManageVariables}
												className="text-xs text-primary hover:underline"
											>
												{t("propertiesPanel.apiAuthManageVarsLink")}
											</button>
										)}
									</div>

									{/* ── Custom Headers ───────────────────────── */}
									<div className="border-t border-border pt-4 space-y-3">
										<div className="flex items-center justify-between">
											<h3 className="font-semibold text-sm">
												{t("propertiesPanel.apiHeadersTitle")}
											</h3>
											<Button
												size="sm"
												variant="outline"
												className="h-7 text-xs"
												disabled={
													(
														(selectedNode.config.customHeaders as
															| APIHeaderEntry[]
															| undefined) ?? []
													).length >= 10
												}
												onClick={() => {
													const headers: APIHeaderEntry[] = [
														...((selectedNode.config.customHeaders as
															| APIHeaderEntry[]
															| undefined) ?? []),
														{ key: "", value: "" },
													];
													onUpdateNode(selectedNode.id, {
														config: {
															...selectedNode.config,
															customHeaders: headers,
														},
													});
												}}
											>
												{t("propertiesPanel.apiHeadersAddBtn")}
											</Button>
										</div>
										{(
											(selectedNode.config.customHeaders as
												| APIHeaderEntry[]
												| undefined) ?? []
										).length >= 10 && (
											<p className="text-xs text-destructive">
												{t("propertiesPanel.apiHeadersMaxWarning")}
											</p>
										)}
										{(
											(selectedNode.config.customHeaders as
												| APIHeaderEntry[]
												| undefined) ?? []
										).map((header, idx) => (
											<div key={idx} className="flex gap-1 items-start">
												<Input
													value={header.key}
													onChange={(e) => {
														const headers = [
															...((selectedNode.config
																.customHeaders as APIHeaderEntry[]) ?? []),
														];
														headers[idx] = {
															...headers[idx],
															key: e.target.value,
														};
														onUpdateNode(selectedNode.id, {
															config: {
																...selectedNode.config,
																customHeaders: headers,
															},
														});
													}}
													placeholder={t(
														"propertiesPanel.apiHeadersKeyPlaceholder",
													)}
													className="font-mono text-xs h-8"
												/>
												<Input
													value={header.value}
													onChange={(e) => {
														const headers = [
															...((selectedNode.config
																.customHeaders as APIHeaderEntry[]) ?? []),
														];
														headers[idx] = {
															...headers[idx],
															value: e.target.value,
														};
														onUpdateNode(selectedNode.id, {
															config: {
																...selectedNode.config,
																customHeaders: headers,
															},
														});
													}}
													placeholder={t(
														"propertiesPanel.apiHeadersValuePlaceholder",
													)}
													className="font-mono text-xs h-8"
												/>
												<Button
													size="sm"
													variant="ghost"
													className="h-8 w-8 shrink-0 px-0"
													onClick={() => {
														const headers = (
															(selectedNode.config
																.customHeaders as APIHeaderEntry[]) ?? []
														).filter((_, i) => i !== idx);
														onUpdateNode(selectedNode.id, {
															config: {
																...selectedNode.config,
																customHeaders: headers,
															},
														});
													}}
												>
													×
												</Button>
											</div>
										))}
										{(
											(selectedNode.config.customHeaders as
												| APIHeaderEntry[]
												| undefined) ?? []
										).length > 0 && (
											<p className="text-xs text-muted-foreground">
												{t("propertiesPanel.apiHeadersValueDesc")}
											</p>
										)}
									</div>

									{/* ── Body (POST/PUT/PATCH only) ───────────── */}
									{["POST", "PUT", "PATCH"].includes(
										(selectedNode.config.method as string) || "GET",
									) && (
										<div className="border-t border-border pt-4 space-y-3">
											<h3 className="font-semibold text-sm">
												{t("propertiesPanel.apiBodyTitle")}
											</h3>
											<div className="flex gap-1">
												{(
													[
														["none", "apiBodyModeNone"],
														["field-mapping", "apiBodyModeFieldMapping"],
														["raw-json", "apiBodyModeRawJson"],
													] as const
												).map(([mode, labelKey]) => (
													<Button
														key={mode}
														size="sm"
														variant={
															((
																selectedNode.config.bodyConfig as
																	| APIBodyConfig
																	| undefined
															)?.mode ?? "none") === mode
																? "default"
																: "outline"
														}
														className="flex-1 text-xs h-7"
														onClick={() =>
															onUpdateNode(selectedNode.id, {
																config: {
																	...selectedNode.config,
																	bodyConfig: {
																		...((selectedNode.config.bodyConfig as
																			| APIBodyConfig
																			| undefined) ?? {}),
																		mode: mode as APIBodyMode,
																	},
																},
															})
														}
													>
														{t(`propertiesPanel.${labelKey}`)}
													</Button>
												))}
											</div>

											{(() => {
												const bc = (selectedNode.config.bodyConfig as
													| APIBodyConfig
													| undefined) ?? { mode: "none" };
												const updateBody = (patch: Partial<APIBodyConfig>) =>
													onUpdateNode(selectedNode.id, {
														config: {
															...selectedNode.config,
															bodyConfig: { ...bc, ...patch },
														},
													});

												if (bc.mode === "raw-json") {
													return (
														<div className="space-y-1">
															<Label>
																{t("propertiesPanel.apiBodyRawJsonLabel")}
															</Label>
															<Textarea
																value={bc.rawJson ?? ""}
																onChange={(e) =>
																	updateBody({ rawJson: e.target.value })
																}
																placeholder={t(
																	"propertiesPanel.apiBodyRawJsonPlaceholder",
																)}
																rows={4}
																className="font-mono text-xs resize-none"
															/>
															<p className="text-xs text-muted-foreground">
																{t("propertiesPanel.apiBodyRawJsonDesc")}
															</p>
														</div>
													);
												}
												if (bc.mode === "field-mapping") {
													return (
														<div className="space-y-2">
															<div className="flex items-center justify-between">
																<Label>
																	{t(
																		"propertiesPanel.apiBodyFieldMappingLabel",
																	)}
																</Label>
																<Button
																	size="sm"
																	variant="outline"
																	className="h-7 text-xs"
																	onClick={() =>
																		updateBody({
																			fieldMappings: [
																				...(bc.fieldMappings ?? []),
																				{ sourceExpression: "", targetKey: "" },
																			],
																		})
																	}
																>
																	{t("propertiesPanel.apiBodyAddMappingBtn")}
																</Button>
															</div>
															{(bc.fieldMappings ?? []).map((mapping, idx) => (
																<div
																	key={idx}
																	className="flex gap-1 items-start"
																>
																	<Input
																		value={mapping.sourceExpression}
																		onChange={(e) => {
																			const mappings = [
																				...(bc.fieldMappings ?? []),
																			];
																			mappings[idx] = {
																				...mappings[idx],
																				sourceExpression: e.target.value,
																			};
																			updateBody({ fieldMappings: mappings });
																		}}
																		placeholder={t(
																			"propertiesPanel.apiBodySourceLabel",
																		)}
																		className="font-mono text-xs h-8 flex-1"
																	/>
																	<Input
																		value={mapping.targetKey}
																		onChange={(e) => {
																			const mappings = [
																				...(bc.fieldMappings ?? []),
																			];
																			mappings[idx] = {
																				...mappings[idx],
																				targetKey: e.target.value,
																			};
																			updateBody({ fieldMappings: mappings });
																		}}
																		placeholder={t(
																			"propertiesPanel.apiBodyTargetPlaceholder",
																		)}
																		className="font-mono text-xs h-8 flex-1"
																	/>
																	<Button
																		size="sm"
																		variant="ghost"
																		className="h-8 w-8 shrink-0 px-0"
																		onClick={() =>
																			updateBody({
																				fieldMappings: (
																					bc.fieldMappings ?? []
																				).filter((_, i) => i !== idx),
																			})
																		}
																	>
																		×
																	</Button>
																</div>
															))}
														</div>
													);
												}
												return null;
											})()}
										</div>
									)}

									{/* ── Response Path ────────────────────────── */}
									<div className="border-t border-border pt-4 space-y-2">
										<h3 className="font-semibold text-sm">
											{t("propertiesPanel.apiResponseTitle")}
										</h3>
										<Label>{t("propertiesPanel.apiResponsePathLabel")}</Label>
										<Input
											value={
												(
													selectedNode.config.responseConfig as
														| APIResponseConfig
														| undefined
												)?.extractPath ?? ""
											}
											onChange={(e) =>
												onUpdateNode(selectedNode.id, {
													config: {
														...selectedNode.config,
														responseConfig: { extractPath: e.target.value },
													},
												})
											}
											placeholder={t(
												"propertiesPanel.apiResponsePathPlaceholder",
											)}
											className="font-mono text-sm"
										/>
										<p className="text-xs text-muted-foreground">
											{t("propertiesPanel.apiResponsePathDesc")}
										</p>
									</div>

									<Button
										size="sm"
										variant="secondary"
										className="w-full"
										onClick={handleOpenApiMock}
									>
										{t("propertiesPanel.apiTestMockBtn")}
									</Button>

									{showApiMock && (
										<div className="rounded-md border border-border bg-muted/40 p-3 space-y-3">
											<div className="space-y-1">
												<p className="text-xs font-medium">
													{t("propertiesPanel.apiRequestPreview")}
												</p>
												<div className="rounded-md bg-muted px-3 py-2 font-mono text-xs">
													<span className="text-blue-400">
														{(selectedNode.config.method as string) || "GET"}
													</span>{" "}
													<span className="text-muted-foreground break-all">
														{(selectedNode.config.url as string) ||
															"/api/endpoint"}
													</span>
												</div>
											</div>

											<div className="space-y-1">
												<label className="text-xs font-medium">
													{t("propertiesPanel.apiMockResponseLabel")}
												</label>
												<Textarea
													value={apiMockResponse}
													onChange={(e) => {
														setApiMockResponse(e.target.value);
														setApiMockSimulated(false);
														setApiMockError(null);
													}}
													rows={4}
													className="font-mono text-xs resize-none"
													placeholder={t(
														"propertiesPanel.apiMockResponsePlaceholder",
													)}
												/>
											</div>

											{apiMockError && (
												<p className="text-xs text-destructive">
													{apiMockError}
												</p>
											)}

											{apiMockSimulated && !apiMockError && (
												<div className="rounded-md bg-emerald-500/15 p-2">
													<p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
														{t("propertiesPanel.apiSimSuccessTitle")}
													</p>
													<p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
														{t("propertiesPanel.apiSimSuccessDesc")}
													</p>
												</div>
											)}

											<div className="flex gap-2">
												<Button
													size="sm"
													variant="outline"
													className="flex-1"
													onClick={() => {
														setShowApiMock(false);
														setApiMockSimulated(false);
													}}
												>
													{t("propertiesPanel.apiMockClose")}
												</Button>
												<Button
													size="sm"
													className="flex-1"
													onClick={handleSimulateMock}
												>
													{t("propertiesPanel.apiMockSimulate")}
												</Button>
											</div>
										</div>
									)}

									<div className="border-t border-border pt-4">
										<h3 className="mb-3 font-semibold">
											{t("propertiesPanel.apiFailureTitle")}
										</h3>

										<div className="space-y-2">
											<Label htmlFor="api-on-failure">
												{t("propertiesPanel.apiOnFailureLabel")}
											</Label>
											<Select
												value={failureHandling.onFailure}
												onValueChange={(value) => {
													const outgoingEdges = edges.filter(
														(e) => e.from === selectedNode.id,
													);

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
																	checkpointId: undefined,
																},
															},
														});
														return;
													}

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
																		selectedCheckpointId || allCheckpoints[0],
																},
															},
														});
														return;
													}

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
														{t("propertiesPanel.apiOnFailureStop")}
													</SelectItem>
													<SelectItem value="continue">
														{t("propertiesPanel.apiOnFailureContinue")}
													</SelectItem>
													<SelectItem value="retry">
														{t("propertiesPanel.apiOnFailureRetry")}
													</SelectItem>
													<SelectItem
														value="return-to-checkpoint"
														disabled={!hasCheckpoint}
													>
														{t("propertiesPanel.apiOnFailureCheckpoint")}
													</SelectItem>
												</SelectContent>
											</Select>
											<p className="text-xs text-muted-foreground">
												{failureHandling.onFailure === "stop" &&
													t("propertiesPanel.apiOnFailureDescStop")}
												{failureHandling.onFailure === "continue" &&
													t("propertiesPanel.apiOnFailureDescContinue")}
												{failureHandling.onFailure === "retry" &&
													t("propertiesPanel.apiOnFailureDescRetry")}
												{failureHandling.onFailure === "return-to-checkpoint" &&
													t("propertiesPanel.apiOnFailureDescCheckpoint")}
											</p>
										</div>

										{failureHandling.onFailure === "retry" && (
											<div className="mt-3 space-y-2">
												<FieldLabel
													htmlFor="api-max-retries"
													description={t("propertiesPanel.apiRetriesDesc")}
												>
													{t("propertiesPanel.apiRetriesLabel")}
												</FieldLabel>
												<Input
													id="api-max-retries"
													type="number"
													min={1}
													max={2}
													value={apiMaxRetriesInput}
													onChange={(e) => {
														const inputValue = e.target.value;
														setApiMaxRetriesInput(inputValue);

														if (inputValue === "") {
															return;
														}

														const parsedValue = Number.parseInt(inputValue, 10);
														if (!Number.isNaN(parsedValue)) {
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
														const inputValue = e.target.value;
														if (inputValue === "") {
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
															setApiMaxRetriesInput(String(parsedValue));
														}
													}}
												/>
											</div>
										)}

										<div className="mt-3 space-y-2">
											<FieldLabel
												htmlFor="api-cache-strategy"
												description={t("propertiesPanel.apiCacheStrategyDesc")}
											>
												{t("propertiesPanel.apiCacheStrategyLabel")}
											</FieldLabel>
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
														{t("propertiesPanel.apiCacheAlwaysExecute")}
													</SelectItem>
													<SelectItem value="cache-until-checkpoint-reset">
														{t("propertiesPanel.apiCacheUntilCheckpoint")}
													</SelectItem>
													<SelectItem value="cache-until-workflow-end">
														{t("propertiesPanel.apiCacheUntilWorkflowEnd")}
													</SelectItem>
												</SelectContent>
											</Select>
										</div>

										<div className="mt-3 space-y-2">
											<FieldLabel
												htmlFor="api-timeout"
												description={t("propertiesPanel.apiTimeoutDesc")}
											>
												{t("propertiesPanel.apiTimeoutLabel")}
											</FieldLabel>
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
										</div>

										{failureHandling.onFailure === "return-to-checkpoint" &&
											hasCheckpoint && (
												<div className="mt-3 space-y-2">
													<Label htmlFor="api-checkpoint-select">
														{hasMultipleCheckpoints
															? t("propertiesPanel.apiCheckpointSelectLabel")
															: t("propertiesPanel.apiCheckpointLabel")}
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
															{t("propertiesPanel.apiMultipleCheckpointsNote")}
														</p>
													)}
												</div>
											)}

										{failureHandling.onFailure === "return-to-checkpoint" &&
											!hasCheckpoint && (
												<div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
													<p className="font-medium">
														{t("propertiesPanel.apiNoCheckpointTitle")}
													</p>
													<p className="mt-1 text-xs">
														{t("propertiesPanel.apiNoCheckpointDesc")}
													</p>
												</div>
											)}

										{failureHandling.onFailure === "stop" && (
											<div className="mt-3 rounded-md bg-muted p-3 text-sm text-muted-foreground">
												<p className="font-medium">
													{t("propertiesPanel.apiTerminalTitle")}
												</p>
												<p className="mt-1 text-xs">
													{t("propertiesPanel.apiTerminalDesc")}
												</p>
											</div>
										)}
									</div>

									<OutputSchemaEditor
										value={
											selectedNode.config.outputSchema as
												| OutputSchema
												| undefined
										}
										onChange={handleUpdateOutputSchema}
										label={t("propertiesPanel.outputSchemaLabelResponse")}
										onInferFromJson={
											(selectedNode.config.mockResponse as string)
												? handleInferSchemaFromMock
												: undefined
										}
									/>
								</div>
							);
						})()}

					{selectedNode.type === "Message" && messageConfig && (
						<div className="space-y-4">
							{/* Canal */}
							<div className="space-y-2">
								<Label htmlFor="message-channel">
									{t("propertiesPanel.messageChannelLabel")}
								</Label>
								<Select
									value={messageConfig.channel ?? "email"}
									onValueChange={(value) =>
										setMessageConfig({
											...messageConfig,
											channel: value as MessageChannel,
										})
									}
								>
									<SelectTrigger id="message-channel">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="email">
											{t("propertiesPanel.messageChannelEmail")}
										</SelectItem>
										<SelectItem value="sms">
											{t("propertiesPanel.messageChannelSms")}
										</SelectItem>
									</SelectContent>
								</Select>
							</div>

							{/* Email config */}
							{messageConfig.channel === "email" && (
								<>
									<div className="space-y-2">
										<FieldLabel
											htmlFor="message-template-name"
											description={t("propertiesPanel.messageTemplateNameDesc")}
										>
											{t("propertiesPanel.messageTemplateNameLabel")}
										</FieldLabel>
										<Input
											id="message-template-name"
											value={messageConfig.templateName ?? ""}
											onChange={(e) =>
												setMessageConfig({
													...messageConfig,
													templateName: e.target.value,
												})
											}
											placeholder={t(
												"propertiesPanel.messageTemplateNamePlaceholder",
											)}
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="message-subject">
											{t("propertiesPanel.messageSubjectLabel")}
										</Label>
										<Input
											id="message-subject"
											value={messageConfig.subject ?? ""}
											onChange={(e) =>
												setMessageConfig({
													...messageConfig,
													subject: e.target.value,
												})
											}
											placeholder={t(
												"propertiesPanel.messageSubjectPlaceholder",
											)}
										/>
									</div>

									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<FieldLabel
												description={t("propertiesPanel.messageMergeVarsDesc")}
											>
												{t("propertiesPanel.messageMergeVarsLabel")}
											</FieldLabel>
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="h-7 px-2 text-xs"
												onClick={handleMessageMergeVarAdd}
											>
												{t("propertiesPanel.messageMergeVarsAddBtn")}
											</Button>
										</div>
										{(messageConfig.mergeVars ?? []).length === 0 && (
											<p className="text-xs text-muted-foreground italic">
												{t("propertiesPanel.messageMergeVarsEmpty")}
											</p>
										)}
										<div className="space-y-2">
											{(messageConfig.mergeVars ?? []).map((mv, index) => (
												<div key={index} className="flex items-center gap-1.5">
													<Input
														value={mv.key}
														onChange={(e) =>
															handleMessageMergeVarUpdate(
																index,
																"key",
																e.target.value,
															)
														}
														placeholder="CLAVE"
														className="h-7 flex-1 font-mono text-xs uppercase"
													/>
													<span className="text-muted-foreground text-xs">
														=
													</span>
													<Input
														value={mv.value}
														onChange={(e) =>
															handleMessageMergeVarUpdate(
																index,
																"value",
																e.target.value,
															)
														}
														placeholder="event.payload.campo"
														className="h-7 flex-1 font-mono text-xs"
													/>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
														onClick={() => handleMessageMergeVarRemove(index)}
														aria-label={t(
															"propertiesPanel.messageMergeVarRemoveAriaLabel",
														)}
													>
														<svg
															xmlns="http://www.w3.org/2000/svg"
															className="h-3.5 w-3.5"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															strokeWidth="2"
															strokeLinecap="round"
															strokeLinejoin="round"
														>
															<path d="M18 6 6 18" />
															<path d="m6 6 12 12" />
														</svg>
													</Button>
												</div>
											))}
										</div>
									</div>
								</>
							)}

							{/* SMS config */}
							{messageConfig.channel === "sms" && (
								<div className="space-y-2">
									<Label htmlFor="message-sms-body">
										{t("propertiesPanel.messageSmsBodyLabel")}
									</Label>
									<Textarea
										id="message-sms-body"
										value={messageConfig.body ?? ""}
										onChange={(e) =>
											setMessageConfig({
												...messageConfig,
												body: e.target.value,
											})
										}
										placeholder={t("propertiesPanel.messageSmsBodyPlaceholder")}
										rows={4}
									/>
									<p className="text-xs text-muted-foreground">
										{t("propertiesPanel.messageSmsBodyNote")}
									</p>
								</div>
							)}
						</div>
					)}

					{selectedNode.type === "Challenge" && challengeConfig && (
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="challenge-type">
									{t("propertiesPanel.challengeTypeLabel")}
								</Label>
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
												{option.value === "acceptance"
													? t("propertiesPanel.challengeAcceptanceLabel")
													: t("propertiesPanel.challengeSignatureLabel")}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{selectedChallengeType && (
									<p className="text-xs text-muted-foreground">
										{selectedChallengeType.value === "acceptance"
											? t("propertiesPanel.challengeAcceptanceDesc")
											: t("propertiesPanel.challengeSignatureDesc")}
									</p>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="challenge-delivery">
									{t("propertiesPanel.challengeDeliveryLabel")}
								</Label>
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
												{t(`propertiesPanel.${option.labelKey}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<p className="text-xs text-muted-foreground">
									{t("propertiesPanel.challengeDeliveryDesc")}
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="challenge-timeout-value">
									{t("propertiesPanel.challengeTimeoutLabel")}
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
												<SelectValue
													placeholder={t(
														"propertiesPanel.staleUnitPlaceholder",
													)}
												/>
											</SelectTrigger>
											<SelectContent>
												{CHALLENGE_TIMEOUT_UNITS.map((unit) => (
													<SelectItem key={unit.value} value={unit.value}>
														{t(`propertiesPanel.${unit.labelKey}`)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>
								<p className="text-xs text-muted-foreground">
									{t("propertiesPanel.challengeTimeoutDesc")}
								</p>
							</div>

							<div className="space-y-3 rounded-md border border-border/60 p-3">
								<div className="flex items-center justify-between gap-4">
									<div>
										<Label htmlFor="challenge-retry-toggle">
											{t("propertiesPanel.challengeRetriesLabel")}
										</Label>
										<p className="text-xs text-muted-foreground">
											{t("propertiesPanel.challengeRetriesDesc")}
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
												{t("propertiesPanel.challengeRetryCountLabel")}
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
												{t("propertiesPanel.challengeRetryCountNote").replace(
													"{n}",
													String(MAX_CHALLENGE_RETRIES),
												)}
											</p>
										</div>

										<div className="space-y-2">
											<Label>
												{t("propertiesPanel.challengeRetryRolesLabel")}
											</Label>
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
															{t(`propertiesPanel.roleNames.${role}`)}
														</label>
													</div>
												))}
											</div>
											{challengeRetryRoles.length === 0 && (
												<p className="text-xs text-muted-foreground">
													{t("propertiesPanel.challengeRetryRolesNote")}
												</p>
											)}
										</div>
									</div>
								)}
							</div>

							<div className="rounded-md bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
								<p className="font-medium">
									{t("propertiesPanel.challengeNotesTitle")}
								</p>
								<p className="mt-1">
									{t("propertiesPanel.challengeNotesBody")}
								</p>
								<p className="mt-2">
									<span className="font-semibold">
										{t("propertiesPanel.challengeFailureTitle")}
									</span>{" "}
									{t("propertiesPanel.challengeFailureDesc")}
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
											{t("propertiesPanel.checkpointSafeLabel")}
										</Label>
										<p className="text-xs text-muted-foreground">
											{t("propertiesPanel.checkpointSafeDesc")}
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
											? t("propertiesPanel.checkpointSafeActive")
											: t("propertiesPanel.checkpointNormal")}
									</p>
									<p className="mt-1">
										{isSafeCheckpoint
											? t("propertiesPanel.checkpointSafeActiveDesc")
											: t("propertiesPanel.checkpointNormalDesc")}
									</p>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="checkpoint-name">
									{t("propertiesPanel.checkpointNameLabel")}
								</Label>
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
									placeholder={t("propertiesPanel.checkpointNamePlaceholder")}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="checkpoint-notes">
									{t("propertiesPanel.checkpointNotesLabel")}
								</Label>
								<Textarea
									id="checkpoint-notes"
									value={(selectedNode.config.notes as string) || ""}
									onChange={(e) =>
										onUpdateNode(selectedNode.id, {
											config: { ...selectedNode.config, notes: e.target.value },
										})
									}
									placeholder={t("propertiesPanel.checkpointNotesPlaceholder")}
									rows={3}
								/>
							</div>
						</div>
					)}

					{selectedNode.type === "FlagChange" && (
						<div className="space-y-4">
							<div className="space-y-1">
								<Label>{t("propertiesPanel.flagChangesLabel")}</Label>
								<p className="text-xs text-muted-foreground">
									{t("propertiesPanel.flagChangesDesc")}
								</p>
							</div>

							{flags.length === 0 ? (
								<div className="rounded-md bg-muted p-3 text-center text-sm text-muted-foreground">
									<p>{t("propertiesPanel.flagChangesNoFlags")}</p>
									<p className="text-xs mt-1">
										{t("propertiesPanel.flagChangesNoFlagsNote")}
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
										<p className="text-xs font-medium mb-2">
											{t("propertiesPanel.flagChangesPreview")}
										</p>
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
								<p className="font-medium mb-1">
									{t("propertiesPanel.flagChangesInfoTitle")}
								</p>
								<p>{t("propertiesPanel.flagChangesInfoBody")}</p>
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
									if (checkpointId && !existingEdge) {
										const newEdge: WorkflowEdge = {
											id: `edge-${Date.now()}`,
											from: selectedNode.id,
											to: checkpointId,
											label: "Reintento",
											color: "rgb(234, 179, 8)",
											thickness: 3,
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
												{t("propertiesPanel.rejectNoCheckpoint")}
											</p>
											<p className="mt-1 text-xs">
												{t("propertiesPanel.rejectNoCheckpointDesc")}
											</p>
										</div>
									) : (
										<>
											<div className="space-y-2">
												<div className="flex items-center justify-between">
													<Label htmlFor="allow-retry">
														{t("propertiesPanel.rejectAllowRetryLabel")}
													</Label>
													<Switch
														id="allow-retry"
														checked={allowRetry}
														onCheckedChange={handleAllowRetryChange}
													/>
												</div>
												<p className="text-xs text-muted-foreground">
													{t("propertiesPanel.rejectAllowRetryDesc")}
												</p>
											</div>

											{allowRetry && (
												<>
													<div className="space-y-2">
														<Label htmlFor="max-retries">
															{t("propertiesPanel.rejectMaxRetriesLabel")}
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
																if (e.target.value === "") {
																	onUpdateNode(selectedNode.id, {
																		config: {
																			...selectedNode.config,
																			maxRetries: 0,
																		},
																	});
																}
															}}
															placeholder={t(
																"propertiesPanel.rejectMaxRetriesPlaceholder",
															)}
														/>
														<p className="text-xs text-muted-foreground">
															{(selectedNode.config.maxRetries as number) ===
																0 ||
															selectedNode.config.maxRetries === undefined ||
															selectedNode.config.maxRetries === null
																? t("propertiesPanel.rejectMaxRetriesUnlimited")
																: t("propertiesPanel.rejectMaxRetriesLimited")}
														</p>
													</div>

													{checkpoint && (
														<div className="rounded-md bg-muted p-3 text-sm">
															<p className="font-medium">
																{t("propertiesPanel.rejectCheckpointLabel")}
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
