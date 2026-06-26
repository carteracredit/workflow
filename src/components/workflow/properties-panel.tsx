"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
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
	SignatureChallengeConfig,
	SignatureSignerConfig,
	SignatureCustomFieldConfig,
	SignatureFlow,
	PromotionNodeConfig,
	MessageNodeConfig,
	MessageMergeVar,
	MessageChannel,
	OutputSchema,
	ExternalLinkNodeConfig,
	ExternalLinkMode,
	ExternalLinkChannel,
} from "@/lib/workflow/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
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
	type VariableSourceNode,
} from "@/lib/workflow/graph-utils";
import { getColorValue } from "@/lib/flag-manager";
import { cn } from "@/lib/utils";
import {
	STALE_SUPPORTED_NODE_TYPES,
	createDefaultChallengeConfig,
	createDefaultPromotionConfig,
	DEFAULT_CHALLENGE_TIMEOUT,
	DEFAULT_PROMOTION_COMMISSION,
	ROLE_OPTIONS,
	MAX_CHALLENGE_RETRIES,
	DEFAULT_CHALLENGE_RETRY_CONFIG,
} from "@/lib/workflow/types";
import {
	validateTransformCode,
	validateConditionExpression,
} from "@/lib/workflow/validate-code";
import { OutputSchemaEditor } from "@/components/workflow/output-schema-editor";
import { CaseVariablesDisplay } from "@/components/workflow/case-variables-display";
import {
	VariableTemplateInput,
	VariablePicker,
	parseTemplateStringToSegments,
	segmentsToTemplateString,
} from "@/components/workflow/variable-picker";
import { FieldLabel } from "@/components/workflow/field-label";
import type { TemplateSegment } from "@/components/workflow/variable-picker";
import type { OutputSchemaProperty } from "@/lib/workflow/types";
import {
	listFormsAction,
	getFormAction,
} from "@/lib/workflow-api/forms-actions";
import type { Form as WorkflowForm } from "@/lib/workflow-api/forms";
import {
	listSignatureTemplatesAction,
	getSignatureTemplateAction,
} from "@/lib/workflow-api/signatures-actions";
import type { SignatureTemplateSummary } from "@/lib/workflow-api/signatures-actions";
import {
	listNlsFunctionsAction,
	getNlsFunctionAction,
} from "@/lib/workflow-api/nls-actions";
import type {
	NlsFunctionSummary,
	NlsFunctionDetail,
} from "@/lib/workflow-api/nls-actions";
import type { NLSNodeConfig, NLSFunctionId } from "@/lib/workflow/types";
import { buildOutputSchemaFromFields } from "@/lib/workflow/form-schema-utils";
import { nlsOutputFieldsToSchema } from "@/lib/workflow/nls-output-mapper";
import {
	getNlsOutputFieldsFromCache,
	useNlsFunctionsCache,
} from "@/lib/workflow/nls-functions-cache";
import {
	getNlsSectionLabel,
	getNlsFieldLabel,
	getNlsOptionLabel,
	getNlsFunctionDescription,
} from "@/lib/workflow/nls-labels";
import { useLanguage } from "@/components/LanguageProvider";
import { buildAliasMap, titleToCamelCase } from "@/lib/workflow/node-alias";
import {
	findTokenOccurrences,
	type TokenOccurrence,
} from "@/lib/workflow/migrate-tokens";
import { isValidJson, isWellFormedXml } from "@/lib/workflow/xml-validation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CollapsibleSection } from "@/components/workflow/collapsible-section";

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
	/**
	 * Called when a node's title is changed AND its alias collides with existing
	 * token references. Receives the old alias, new title, and whether to
	 * rewrite all token references (`renameAll`).
	 */
	onRenameNodeAlias?: (
		nodeId: string,
		oldAlias: string,
		newTitle: string,
		renameAll: boolean,
	) => void;
	showWorkflowProperties: boolean;
	onCloseWorkflowProperties: () => void;
	position?: "left" | "right";
	width?: number;
	onWidthChange?: (width: number) => void;
	onManageVariables?: () => void;
	/**
	 * Extra variable sources (e.g. workflow-level secrets/variables) that are
	 * not produced by graph traversal but should still appear in the picker
	 * for every node. Rendered after upstream node sources.
	 */
	extraVariableSources?: VariableSourceNode[];
}

const NODES_WITH_ROLES = [
	"Form",
	"Challenge",
	"Message",
	"Promotion",
	"AddCard",
];
const NODES_WITH_VISIBILITY_ROLES = [
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
];
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
	onRenameNodeAlias,
	showWorkflowProperties,
	onCloseWorkflowProperties,
	position = "right",
	width,
	onWidthChange,
	onManageVariables,
	extraVariableSources,
}: PropertiesPanelProps) {
	const { t, getFieldLabel, language } = useLanguage();
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

	// ── Rename alias modal state ───────────────────────────────────────────
	const [renameModalState, setRenameModalState] = useState<{
		open: boolean;
		nodeId: string;
		oldAlias: string;
		newTitle: string;
		occurrences: TokenOccurrence[];
	} | null>(null);
	// Alias the node had when the title input received focus — used by onBlur
	// to detect whether the alias actually changed across the full edit session.
	const titleFocusAliasRef = useRef<string | null>(null);
	// Upstream variable source nodes for the variable picker
	const upstreamVariableNodes = useMemo(() => {
		if (!selectedNode) return [];
		const upstream = findUpstreamNodes(selectedNode.id, nodes, edges);
		// Pass `allNodes` so the Start source (case-level data) is always
		// listed, even when the selected node is not yet connected to Start.
		const graphSources = buildVariableSourceNodes(upstream, {
			allNodes: nodes,
		});
		// Append workflow-level sources (e.g. Secrets) after the graph-derived
		// ones so node outputs show first and the global catalog comes last.
		return extraVariableSources && extraVariableSources.length > 0
			? [...graphSources, ...extraVariableSources]
			: graphSources;
	}, [selectedNode, nodes, edges, extraVariableSources]);

	// Ref to track textarea cursor for variable insertion (Decision/Transform)
	const conditionTextareaRef = useRef<HTMLTextAreaElement>(null);
	const transformTextareaRef = useRef<HTMLTextAreaElement>(null);
	const descriptionRef = useRef<HTMLTextAreaElement>(null);
	const descriptionEsRef = useRef<HTMLTextAreaElement>(null);
	const [showDecisionVarPicker, setShowDecisionVarPicker] = useState(false);
	const [showTransformVarPicker, setShowTransformVarPicker] = useState(false);
	const [showDescVarPicker, setShowDescVarPicker] = useState(false);
	const [showDescEsVarPicker, setShowDescEsVarPicker] = useState(false);

	// Refs and state for variable insertion in API body templates
	const rawJsonTextareaRef = useRef<HTMLTextAreaElement>(null);
	const rawXmlTextareaRef = useRef<HTMLTextAreaElement>(null);
	const [showRawJsonVarPicker, setShowRawJsonVarPicker] = useState(false);
	const [showRawXmlVarPicker, setShowRawXmlVarPicker] = useState(false);

	// Estado local para el input de maxRetries del nodo API
	const [apiMaxRetriesInput, setApiMaxRetriesInput] = useState<string>("");

	// Estado para validacion de codigo Transform
	const [transformValidating, setTransformValidating] =
		useState<boolean>(false);
	const [transformValidationResult, setTransformValidationResult] = useState<{
		valid: boolean;
		error?: string;
	} | null>(null);

	// Estado para validacion de condicion del nodo Decision
	const [conditionValidating, setConditionValidating] =
		useState<boolean>(false);
	const [conditionValidationResult, setConditionValidationResult] = useState<{
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

	// Estado para formularios disponibles (nodo ExternalLink)
	const [elAvailableForms, setElAvailableForms] = useState<WorkflowForm[]>([]);
	const [elFormsLoading, setElFormsLoading] = useState(false);
	const [elSelectedFormFull, setElSelectedFormFull] =
		useState<WorkflowForm | null>(null);
	const [elFormVersionsLoading, setElFormVersionsLoading] = useState(false);

	// Cargar forms publicados cuando hay un nodo Form seleccionado
	useEffect(() => {
		if (selectedNode?.type !== "Form") return;
		setFormsLoading(true);
		listFormsAction({ status: "published" })
			.then((forms) => setAvailableForms(forms))
			.catch(() => setAvailableForms([]))
			.finally(() => setFormsLoading(false));
	}, [selectedNode?.type]);

	// Cargar forms publicados cuando hay un nodo ExternalLink en modo form seleccionado
	useEffect(() => {
		if (
			selectedNode?.type !== "ExternalLink" ||
			(selectedNode?.config as { mode?: string } | undefined)?.mode !== "form"
		) {
			setElAvailableForms([]);
			setElSelectedFormFull(null);
			return;
		}
		setElFormsLoading(true);
		listFormsAction({ status: "published" })
			.then((forms) => setElAvailableForms(forms))
			.catch(() => setElAvailableForms([]))
			.finally(() => setElFormsLoading(false));
	}, [
		selectedNode?.type,
		(selectedNode?.config as { mode?: string } | undefined)?.mode,
	]);

	// Cargar el formulario completo para ExternalLink cuando ya hay un formId en el config
	useEffect(() => {
		if (
			selectedNode?.type !== "ExternalLink" ||
			(selectedNode?.config as { mode?: string } | undefined)?.mode !== "form"
		) {
			setElSelectedFormFull(null);
			return;
		}
		const formId = (selectedNode.config as { formConfig?: { formId?: string } })
			?.formConfig?.formId;
		if (!formId) {
			setElSelectedFormFull(null);
			return;
		}
		setElFormVersionsLoading(true);
		getFormAction(formId)
			.then((form) => setElSelectedFormFull(form))
			.catch(() => setElSelectedFormFull(null))
			.finally(() => setElFormVersionsLoading(false));
	}, [
		selectedNode?.type,
		selectedNode?.id,
		(selectedNode?.config as { formConfig?: { formId?: string } } | undefined)
			?.formConfig?.formId,
	]);

	// Cargar templates de Dropbox Sign cuando hay un nodo Challenge con tipo signature seleccionado
	useEffect(() => {
		const isChallengeSignature =
			selectedNode?.type === "Challenge" &&
			(selectedNode?.config as { challengeType?: string } | undefined)
				?.challengeType === "signature";
		if (!isChallengeSignature) return;
		setSignatureTemplatesLoading(true);
		listSignatureTemplatesAction()
			.then((templates) => setAvailableSignatureTemplates(templates))
			.catch(() => setAvailableSignatureTemplates([]))
			.finally(() => setSignatureTemplatesLoading(false));
	}, [
		selectedNode?.type,
		(selectedNode?.config as { challengeType?: string } | undefined)
			?.challengeType,
	]);

	// Cargar funciones NLS cuando hay un nodo NLS seleccionado
	useEffect(() => {
		if (selectedNode?.type !== "NLS") return;
		setNlsFunctionsLoading(true);
		listNlsFunctionsAction()
			.then((fns) => setNlsFunctions(fns))
			.catch(() => setNlsFunctions([]))
			.finally(() => setNlsFunctionsLoading(false));
	}, [selectedNode?.type]);

	// Cargar detalle de función NLS cuando cambia la función seleccionada
	useEffect(() => {
		if (selectedNode?.type !== "NLS") return;
		const functionId = (selectedNode.config as NLSNodeConfig | undefined)
			?.functionId;
		if (!functionId) {
			setNlsFunctionDetail(null);
			return;
		}
		setNlsDetailLoading(true);
		getNlsFunctionAction(functionId)
			.then((detail) => {
				setNlsFunctionDetail(detail);
				setNlsExpandedSections(new Set(detail.sections.map((s) => s.id)));
			})
			.catch(() => setNlsFunctionDetail(null))
			.finally(() => setNlsDetailLoading(false));
	}, [
		selectedNode?.type,
		(selectedNode?.config as NLSNodeConfig | undefined)?.functionId,
	]);

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

	// Limpiar resultado de validacion de condicion cuando cambia el nodo o la condicion
	useEffect(() => {
		setConditionValidationResult(null);
	}, [selectedNode?.id, selectedNode?.config?.condition]);

	const handleValidateTransformCode = useCallback(async () => {
		const code = (selectedNode?.config?.code as string) || "";
		setTransformValidating(true);
		setTransformValidationResult(null);
		const result = await validateTransformCode(code);
		setTransformValidating(false);
		setTransformValidationResult(result);
	}, [selectedNode?.config?.code]);

	const handleValidateCondition = useCallback(async () => {
		const condition = (selectedNode?.config?.condition as string) || "";
		setConditionValidating(true);
		setConditionValidationResult(null);
		const result = await validateConditionExpression(condition);
		setConditionValidating(false);
		setConditionValidationResult(result);
	}, [selectedNode?.config?.condition]);

	// Estado para modal de mock del nodo API
	const [showApiMock, setShowApiMock] = useState<boolean>(false);
	const [apiMockResponse, setApiMockResponse] = useState<string>("");
	const [apiMockSimulated, setApiMockSimulated] = useState<boolean>(false);
	const [apiMockError, setApiMockError] = useState<string | null>(null);
	const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
	const [availableSignatureTemplates, setAvailableSignatureTemplates] =
		useState<SignatureTemplateSummary[]>([]);
	const [signatureTemplatesLoading, setSignatureTemplatesLoading] =
		useState(false);
	const [customFieldsSearch, setCustomFieldsSearch] = useState("");
	const [isRefreshingTemplates, setIsRefreshingTemplates] = useState(false);
	const [expandedCustomFieldIndices, setExpandedCustomFieldIndices] = useState<
		Set<number>
	>(new Set());

	// ── NLS state ────────────────────────────────────────────────────
	const [nlsFunctions, setNlsFunctions] = useState<NlsFunctionSummary[]>([]);
	const [nlsFunctionsLoading, setNlsFunctionsLoading] = useState(false);
	const [nlsFunctionDetail, setNlsFunctionDetail] =
		useState<NlsFunctionDetail | null>(null);
	const [nlsDetailLoading, setNlsDetailLoading] = useState(false);
	const [nlsExpandedSections, setNlsExpandedSections] = useState<Set<string>>(
		new Set(),
	);

	// Populate the module-level NLS output fields cache whenever the list changes.
	// graph-utils reads from this cache synchronously to build variable pickers.
	useNlsFunctionsCache(nlsFunctions);

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

	// ── Variable insertion for top-level node fields (description / descriptionEs) ──
	const insertVariableIntoNodeField = useCallback(
		(
			ref: React.RefObject<HTMLTextAreaElement | null>,
			path: string,
			field: "description" | "descriptionEs",
		) => {
			if (!selectedNode || !ref.current) return;
			const el = ref.current;
			const start = el.selectionStart ?? 0;
			const end = el.selectionEnd ?? 0;
			const current = (selectedNode[field] as string | undefined | null) ?? "";
			const token = `\${${path}}`;
			const next = current.slice(0, start) + token + current.slice(end);
			onUpdateNode(selectedNode.id, { [field]: next || undefined });
			requestAnimationFrame(() => {
				el.focus();
				const pos = start + token.length;
				el.setSelectionRange(pos, pos);
			});
		},
		[selectedNode, onUpdateNode],
	);

	// ── Variable insertion for API body fields (rawJson / rawXml) ──────────
	const insertVariableIntoBodyConfig = useCallback(
		(
			ref: React.RefObject<HTMLTextAreaElement | null>,
			path: string,
			field: "rawJson" | "rawXml",
		) => {
			if (!selectedNode || !ref.current) return;
			const el = ref.current;
			const start = el.selectionStart ?? 0;
			const end = el.selectionEnd ?? 0;
			const bc = (selectedNode.config.bodyConfig as
				| APIBodyConfig
				| undefined) ?? { mode: "none" };
			const current = (bc[field] as string | undefined) ?? "";
			const token = `\${${path}}`;
			const next = current.slice(0, start) + token + current.slice(end);
			onUpdateNode(selectedNode.id, {
				config: {
					...selectedNode.config,
					bodyConfig: { ...bc, [field]: next },
				},
			});
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
		"border-border bg-card overflow-x-hidden flex flex-col relative rounded-2xl shadow-xl",
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

				<ScrollArea className="max-h-[calc(100svh-8rem)] overflow-x-hidden">
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
											nameEs: e.target.value || undefined,
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
											descriptionEs: e.target.value || undefined,
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

				<ScrollArea className="max-h-[calc(100svh-8rem)] overflow-x-hidden">
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

		const updates: Partial<WorkflowNode> = { roles: newRoles };

		if (
			!selectedNode.roles.includes(role) &&
			selectedNode.visibilityRoles !== undefined
		) {
			const visRoles = selectedNode.visibilityRoles;
			if (!visRoles.includes(role)) {
				updates.visibilityRoles = [...visRoles, role];
			}
		}

		onUpdateNode(selectedNode.id, updates);
	};

	const handleVisibilityRoleToggle = (role: Role) => {
		if (selectedNode.roles.includes(role)) return;

		const current: Role[] = selectedNode.visibilityRoles ?? [...ROLE_OPTIONS];
		const newRoles = current.includes(role)
			? current.filter((r) => r !== role)
			: [...current, role];
		onUpdateNode(selectedNode.id, { visibilityRoles: newRoles });
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
	const isPromotionNode = selectedNode.type === "Promotion";
	const promotionConfig = isPromotionNode
		? ((selectedNode.config as PromotionNodeConfig | undefined) ??
			createDefaultPromotionConfig())
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

	// ── Signature challenge helpers ───────────────────────────────────────────
	const signatureConfig =
		challengeConfig?.challengeType === "signature"
			? (challengeConfig as SignatureChallengeConfig)
			: null;

	const setSignatureConfig = (nextSig: Partial<SignatureChallengeConfig>) => {
		if (!signatureConfig) return;
		setChallengeConfig({
			...signatureConfig,
			...nextSig,
		} as ChallengeNodeConfig);
	};

	const handleRefreshTemplateFields = async () => {
		if (!signatureConfig?.templateId) return;
		setIsLoadingTemplate(true);
		try {
			const tpl = await getSignatureTemplateAction(signatureConfig.templateId, {
				bypassCache: true,
			});

			// Merge: keep existing values, add any new roles/fields from template
			const existingSigners = signatureConfig.signers ?? [];
			const mergedSigners: SignatureSignerConfig[] = tpl.signerRoles.map(
				(sr) => {
					const existing = existingSigners.find((s) => s.role === sr.name);
					return (
						existing ?? {
							role: sr.name,
							source: "variable" as const,
							email: "",
							name: "",
						}
					);
				},
			);

			const existingFields = signatureConfig.customFields ?? [];
			const mergedFields: SignatureCustomFieldConfig[] = tpl.customFields.map(
				(cf) => {
					const existing = existingFields.find((f) => f.apiId === cf.apiId);
					return (
						existing ?? {
							apiId: cf.apiId,
							name: cf.name,
							type: cf.type,
							value: "",
							required: cf.required,
							source: "discovered" as const,
						}
					);
				},
			);

			setSignatureConfig({
				signers: mergedSigners,
				customFields: mergedFields,
			});
			setCustomFieldsSearch("");
			setExpandedCustomFieldIndices(new Set());
		} catch {
			// silent fail — user can retry
		} finally {
			setIsLoadingTemplate(false);
		}
	};

	/**
	 * Recarga la lista de templates desde Dropbox Sign.
	 * Si hay un template seleccionado, también recarga sus firmantes y custom fields,
	 * mergeando con los valores existentes (no borra lo configurado).
	 */
	const handleRefreshAll = async () => {
		setIsRefreshingTemplates(true);
		try {
			const templates = await listSignatureTemplatesAction({
				bypassCache: true,
			});
			setAvailableSignatureTemplates(templates);
			// Si hay template seleccionado, recargar sus campos también
			if (signatureConfig?.templateId) {
				setIsLoadingTemplate(true);
				try {
					const tpl = await getSignatureTemplateAction(
						signatureConfig.templateId,
						{ bypassCache: true },
					);

					// Merge signers: keep existing values, add any new roles from template
					const existingSigners = signatureConfig.signers ?? [];
					const mergedSigners: SignatureSignerConfig[] = tpl.signerRoles.map(
						(sr) => {
							const existing = existingSigners.find((s) => s.role === sr.name);
							return (
								existing ?? {
									role: sr.name,
									source: "variable" as const,
									email: "",
									name: "",
								}
							);
						},
					);

					// Merge custom fields: keep existing values, add any new fields
					const existingFields = signatureConfig.customFields ?? [];
					const mergedFields: SignatureCustomFieldConfig[] =
						tpl.customFields.map((cf) => {
							const existing = existingFields.find((f) => f.apiId === cf.apiId);
							return (
								existing ?? {
									apiId: cf.apiId,
									name: cf.name,
									type: cf.type,
									value: "",
									required: cf.required,
									source: "discovered" as const,
								}
							);
						});

					setSignatureConfig({
						signers: mergedSigners,
						customFields: mergedFields,
					});
					setCustomFieldsSearch("");
					setExpandedCustomFieldIndices(new Set());
				} catch {
					// silent fail
				} finally {
					setIsLoadingTemplate(false);
				}
			}
		} catch {
			// silent fail
		} finally {
			setIsRefreshingTemplates(false);
		}
	};

	const CASE_ROLE_OPTIONS: Array<{
		value: SignatureSignerConfig["caseRole"];
		label: string;
	}> = [
		{ value: "client", label: "Cliente" },
		{ value: "seller", label: "Vendedor" },
		{ value: "credit_agent", label: "Agente de crédito" },
		{ value: "org_manager", label: "Gerente de organización" },
	];

	const SIGNATURE_FLOW_OPTIONS: Array<{
		value: SignatureFlow;
		label: string;
		desc: string;
	}> = [
		{
			value: "embedded",
			label: "Embebida",
			desc: "El firmante firma directamente en la aplicación (requiere plan Standard+)",
		},
		{
			value: "email_only",
			label: "Solo correo",
			desc: "Dropbox Sign envía el link de firma por correo",
		},
		{
			value: "email_and_sms",
			label: "Correo + SMS",
			desc: "El link se envía por correo y también por SMS (add-on, solo fuera de test_mode)",
		},
	];

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

	// ── Tab visibility ────────────────────────────────────────────────────────
	const hasConfig = !["End", "Join"].includes(selectedNode.type);
	const hasRoles =
		NODES_WITH_ROLES.includes(selectedNode.type) ||
		NODES_WITH_VISIBILITY_ROLES.includes(selectedNode.type);
	const defaultTab = hasConfig ? "config" : "general";

	return (
		<div {...panelContainerProps}>
			{/* Rename alias confirmation modal */}
			{renameModalState && (
				<Dialog
					open={renameModalState.open}
					onOpenChange={(open) => {
						if (!open) {
							// Cancelled: don't change anything
							setRenameModalState(null);
						}
					}}
				>
					<DialogContent className="max-w-lg">
						<DialogHeader>
							<DialogTitle>Cambiar nombre del nodo</DialogTitle>
						</DialogHeader>
						<div className="space-y-3 text-sm">
							<p>
								El alias del nodo cambiará de{" "}
								<code className="bg-muted px-1 rounded font-mono text-xs">
									{renameModalState.oldAlias}
								</code>{" "}
								a{" "}
								<code className="bg-muted px-1 rounded font-mono text-xs">
									{buildAliasMap(
										nodes.map((n) =>
											n.id === renameModalState.nodeId
												? { ...n, title: renameModalState.newTitle }
												: n,
										),
									).get(renameModalState.nodeId) ??
										titleToCamelCase(renameModalState.newTitle)}
								</code>
								.
							</p>
							<p className="text-muted-foreground">
								Los siguientes campos referencian este nodo (
								{renameModalState.occurrences.length} ocurrencia
								{renameModalState.occurrences.length !== 1 ? "s" : ""}):
							</p>
							<ul className="space-y-1 max-h-40 overflow-y-auto">
								{renameModalState.occurrences.map((occ, i) => (
									<li key={i} className="rounded bg-muted/40 px-2 py-1 text-xs">
										<span className="font-medium">{occ.nodeTitle}</span>
										<span className="text-muted-foreground ml-1 font-mono">
											{occ.context}
										</span>
									</li>
								))}
							</ul>
							<p className="text-muted-foreground text-xs">
								Si no actualizas las referencias, quedarán como variables
								huérfanas y la validación del workflow reportará errores.
							</p>
						</div>
						<DialogFooter className="flex gap-2 flex-col sm:flex-row">
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									// Just rename the node, leave tokens as-is (orphaned)
									onRenameNodeAlias!(
										renameModalState.nodeId,
										renameModalState.oldAlias,
										renameModalState.newTitle,
										false,
									);
									setRenameModalState(null);
								}}
							>
								Solo renombrar el nodo
							</Button>
							<Button
								size="sm"
								onClick={() => {
									// Rename node and rewrite all references
									onRenameNodeAlias!(
										renameModalState.nodeId,
										renameModalState.oldAlias,
										renameModalState.newTitle,
										true,
									);
									setRenameModalState(null);
								}}
							>
								Actualizar todas las referencias
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}
			{resizeHandle}
			<div className="border-b border-border p-4 flex-shrink-0">
				<h2 className="font-semibold">{t("propertiesPanel.nodePropsTitle")}</h2>
			</div>

			<Tabs defaultValue={defaultTab} className="flex flex-col">
				<TabsList className="mx-3 mt-2 mb-0 shrink-0">
					<TabsTrigger value="general">
						{t("propertiesPanel.tabs.general")}
					</TabsTrigger>
					{hasConfig && (
						<TabsTrigger value="config">
							{t("propertiesPanel.tabs.config")}
						</TabsTrigger>
					)}
					{hasRoles && (
						<TabsTrigger value="roles">
							{t("propertiesPanel.tabs.roles")}
						</TabsTrigger>
					)}
				</TabsList>

				<ScrollArea className="max-h-[calc(100svh-8rem)] overflow-x-hidden">
					{/* ── General ─────────────────────────────────────────────────────── */}
					<TabsContent value="general" className="mt-0">
						<div className="space-y-4 p-4 min-w-0 max-w-full overflow-hidden">
							{/* Title (Bilingual) */}
							<div className="space-y-2 w-full">
								<Label>{t("propertiesPanel.nodeTitleLabel")}</Label>
								<div className="grid grid-cols-2 gap-2">
									<div className="space-y-1">
										<Input
											id="title"
											value={selectedNode.title}
											onChange={(e) => {
												// Update title freely on every keystroke — no modal here.
												onUpdateNode(selectedNode.id, {
													title: e.target.value,
												});
											}}
											onFocus={() => {
												// Snapshot the alias at focus time so onBlur can detect net change.
												const aliasMap = buildAliasMap(nodes);
												titleFocusAliasRef.current =
													aliasMap.get(selectedNode.id) ??
													titleToCamelCase(
														selectedNode.title || selectedNode.type,
													);
											}}
											onBlur={(e) => {
												// Only after the user leaves the field do we check whether the
												// alias changed AND there are references that need updating.
												if (
													!onRenameNodeAlias ||
													selectedNode.type === "Start" ||
													titleFocusAliasRef.current === null
												) {
													titleFocusAliasRef.current = null;
													return;
												}
												// Use e.target.value (current DOM value) to avoid stale
												// React state when onChange and onBlur fire in the same batch.
												const currentTitle = e.target.value;
												const currentAlias = titleToCamelCase(
													currentTitle || selectedNode.type,
												);
												const oldAlias = titleFocusAliasRef.current;
												titleFocusAliasRef.current = null;
												if (oldAlias === currentAlias) return;
												const occurrences = findTokenOccurrences(
													nodes,
													oldAlias,
												);
												if (occurrences.length > 0) {
													setRenameModalState({
														open: true,
														nodeId: selectedNode.id,
														oldAlias,
														newTitle: currentTitle,
														occurrences,
													});
												}
											}}
											placeholder={t("propertiesPanel.nodeTitlePlaceholder")}
											className="w-full"
											readOnly={selectedNode.type === "Start"}
											disabled={selectedNode.type === "Start"}
										/>
										{selectedNode.type !== "Start" && (
											<p className="text-[10px] text-muted-foreground font-mono">
												alias:{" "}
												<span className="text-foreground">
													{buildAliasMap(nodes).get(selectedNode.id) ??
														titleToCamelCase(
															selectedNode.title || selectedNode.type,
														)}
												</span>
											</p>
										)}
									</div>
									<Input
										id="title-es"
										value={selectedNode.titleEs || ""}
										onChange={(e) =>
											onUpdateNode(selectedNode.id, {
												titleEs: e.target.value || undefined,
											})
										}
										placeholder={t("propertiesPanel.nodeTitleEsPlaceholder")}
										className="w-full"
										readOnly={selectedNode.type === "Start"}
										disabled={selectedNode.type === "Start"}
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
									<div className="space-y-1">
										<Textarea
											id="description"
											ref={descriptionRef}
											value={selectedNode.description}
											onChange={(e) =>
												onUpdateNode(selectedNode.id, {
													description: e.target.value,
												})
											}
											placeholder={t("propertiesPanel.nodeDescPlaceholder")}
											rows={3}
											className="w-full"
											readOnly={selectedNode.type === "Start"}
											disabled={selectedNode.type === "Start"}
										/>
										{selectedNode.type !== "Start" && (
											<div className="rounded-md border border-border/60 overflow-hidden">
												<button
													type="button"
													onClick={() =>
														setShowDescVarPicker(!showDescVarPicker)
													}
													className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors text-xs text-muted-foreground"
												>
													<span className="font-medium">
														{t("propertiesPanel.availableVarsLabel")}
													</span>
													<span>{showDescVarPicker ? "▲" : "▼"}</span>
												</button>
												{showDescVarPicker &&
													(upstreamVariableNodes.length > 0 ? (
														<VariablePicker
															nodes={upstreamVariableNodes}
															onSelect={(variable) =>
																insertVariableIntoNodeField(
																	descriptionRef,
																	variable.path,
																	"description",
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
										)}
									</div>
									<div className="space-y-1">
										<Textarea
											id="description-es"
											ref={descriptionEsRef}
											value={selectedNode.descriptionEs || ""}
											onChange={(e) =>
												onUpdateNode(selectedNode.id, {
													descriptionEs: e.target.value || undefined,
												})
											}
											placeholder={t("propertiesPanel.nodeDescEsPlaceholder")}
											rows={3}
											className="w-full"
											readOnly={selectedNode.type === "Start"}
											disabled={selectedNode.type === "Start"}
										/>
										{selectedNode.type !== "Start" && (
											<div className="rounded-md border border-border/60 overflow-hidden">
												<button
													type="button"
													onClick={() =>
														setShowDescEsVarPicker(!showDescEsVarPicker)
													}
													className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors text-xs text-muted-foreground"
												>
													<span className="font-medium">
														{t("propertiesPanel.availableVarsLabel")}
													</span>
													<span>{showDescEsVarPicker ? "▲" : "▼"}</span>
												</button>
												{showDescEsVarPicker &&
													(upstreamVariableNodes.length > 0 ? (
														<VariablePicker
															nodes={upstreamVariableNodes}
															onSelect={(variable) =>
																insertVariableIntoNodeField(
																	descriptionEsRef,
																	variable.path,
																	"descriptionEs",
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
										)}
									</div>
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
						</div>
					</TabsContent>

					{/* ── Config ──────────────────────────────────────────────────────── */}
					{hasConfig && (
						<TabsContent value="config" className="mt-0">
							<div className="space-y-4 p-4 min-w-0 max-w-full overflow-hidden">
								{/* Start node: case-level fixed inputs + user-defined custom fields */}
								{selectedNode.type === "Start" && (
									<div className="space-y-3">
										<CaseVariablesDisplay
											label={t("propertiesPanel.caseVariablesLabel")}
										/>
										<OutputSchemaEditor
											value={
												selectedNode.config.outputSchema as
													| OutputSchema
													| undefined
											}
											onChange={handleUpdateOutputSchema}
											label={t("propertiesPanel.customFieldsLabel")}
										/>
									</div>
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
																? t(
																		"propertiesPanel.formSelectLoadingPlaceholder",
																	)
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
																selectedNode.config.formVersion as
																	| number
																	| undefined
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
																		: t(
																				"propertiesPanel.formVersionPlaceholder",
																			)
																}
															/>
														</SelectTrigger>
														<SelectContent>
															{selectedFormFull?.versions
																.slice()
																.sort((a, b) => b.version - a.version)
																.map((v) => (
																	<SelectItem
																		key={v.id}
																		value={v.version.toString()}
																	>
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
												selectedNode.config.outputSchema as
													| OutputSchema
													| undefined
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
										<Button
											size="sm"
											variant="secondary"
											className="w-full"
											onClick={handleValidateCondition}
											disabled={
												conditionValidating ||
												!(selectedNode.config.condition as string)?.trim()
											}
										>
											{conditionValidating ? (
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
													{t("propertiesPanel.validatingCondition")}
												</span>
											) : (
												t("propertiesPanel.validateConditionBtn")
											)}
										</Button>
										{conditionValidationResult !== null && (
											<div
												className={cn(
													"rounded-md p-3 text-xs",
													conditionValidationResult.valid
														? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
														: "bg-destructive/10 text-destructive",
												)}
											>
												{conditionValidationResult.valid ? (
													<span className="font-medium">
														{t("propertiesPanel.conditionValid")}
													</span>
												) : (
													<>
														<p className="font-medium">
															{t("propertiesPanel.conditionSyntaxError")}
														</p>
														<p className="mt-1">
															{conditionValidationResult.error}
														</p>
													</>
												)}
											</div>
										)}
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
													config: {
														...selectedNode.config,
														code: e.target.value,
													},
												});
											}}
											placeholder={t(
												"propertiesPanel.transformCodePlaceholder",
											)}
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
														<p className="mt-1">
															{transformValidationResult.error}
														</p>
													</>
												)}
											</div>
										)}
										<OutputSchemaEditor
											value={
												selectedNode.config.outputSchema as
													| OutputSchema
													| undefined
											}
											onChange={handleUpdateOutputSchema}
											label={t("propertiesPanel.outputSchemaLabel")}
										/>
									</div>
								)}

								{selectedNode.type === "API" &&
									(() => {
										const failureHandling = (selectedNode.config
											.failureHandling as
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
														value={
															(selectedNode.config.method as string) || "GET"
														}
														onValueChange={(value) =>
															onUpdateNode(selectedNode.id, {
																config: {
																	...selectedNode.config,
																	method: value,
																},
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
												<CollapsibleSection
													title={t("propertiesPanel.sectionAuth")}
													defaultOpen={false}
												>
													<div className="space-y-2">
														<Label>
															{t("propertiesPanel.apiAuthTypeLabel")}
														</Label>
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
														const updateAuth = (
															patch: Partial<APIAuthConfig>,
														) =>
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
																		{t(
																			"propertiesPanel.apiAuthBearerTokenLabel",
																		)}
																	</Label>
																	<Input
																		value={auth.bearerToken ?? ""}
																		onChange={(e) =>
																			updateAuth({
																				bearerToken: e.target.value,
																			})
																		}
																		placeholder={t(
																			"propertiesPanel.apiAuthBearerTokenPlaceholder",
																		)}
																		className="font-mono text-sm"
																	/>
																	<p className="text-xs text-muted-foreground">
																		{t(
																			"propertiesPanel.apiAuthBearerTokenDesc",
																		)}
																	</p>
																</div>
															);
														}
														if (auth.type === "api-key") {
															return (
																<div className="space-y-2">
																	<div className="space-y-1">
																		<Label>
																			{t(
																				"propertiesPanel.apiAuthApiKeyHeaderLabel",
																			)}
																		</Label>
																		<Input
																			value={auth.apiKeyHeader ?? ""}
																			onChange={(e) =>
																				updateAuth({
																					apiKeyHeader: e.target.value,
																				})
																			}
																			placeholder={t(
																				"propertiesPanel.apiAuthApiKeyHeaderPlaceholder",
																			)}
																			className="font-mono text-sm"
																		/>
																	</div>
																	<div className="space-y-1">
																		<Label>
																			{t(
																				"propertiesPanel.apiAuthApiKeyValueLabel",
																			)}
																		</Label>
																		<Input
																			value={auth.apiKeyValue ?? ""}
																			onChange={(e) =>
																				updateAuth({
																					apiKeyValue: e.target.value,
																				})
																			}
																			placeholder={t(
																				"propertiesPanel.apiAuthApiKeyValuePlaceholder",
																			)}
																			className="font-mono text-sm"
																		/>
																		<p className="text-xs text-muted-foreground">
																			{t(
																				"propertiesPanel.apiAuthApiKeyValueDesc",
																			)}
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
																					(auth[field] as string | undefined) ??
																					""
																				}
																				onChange={(e) =>
																					updateAuth({
																						[field]: e.target.value,
																					})
																				}
																				placeholder={t(
																					`propertiesPanel.${phKey}`,
																				)}
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
												</CollapsibleSection>

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
																			.customHeaders as APIHeaderEntry[]) ??
																			[]),
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
																			.customHeaders as APIHeaderEntry[]) ??
																			[]),
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
																	["raw-xml", "apiBodyModeRawXml"],
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
																					...((selectedNode.config
																						.bodyConfig as
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
															const updateBody = (
																patch: Partial<APIBodyConfig>,
															) =>
																onUpdateNode(selectedNode.id, {
																	config: {
																		...selectedNode.config,
																		bodyConfig: { ...bc, ...patch },
																	},
																});

															if (bc.mode === "raw-json") {
																const jsonValue = bc.rawJson ?? "";
																const jsonInvalid =
																	jsonValue.trim() !== "" &&
																	!isValidJson(jsonValue);
																return (
																	<div className="space-y-1">
																		<Label>
																			{t("propertiesPanel.apiBodyRawJsonLabel")}
																		</Label>
																		<Textarea
																			ref={rawJsonTextareaRef}
																			value={jsonValue}
																			onChange={(e) =>
																				updateBody({ rawJson: e.target.value })
																			}
																			placeholder={t(
																				"propertiesPanel.apiBodyRawJsonPlaceholder",
																			)}
																			rows={4}
																			aria-invalid={jsonInvalid}
																			className={cn(
																				"font-mono text-xs resize-none",
																				jsonInvalid &&
																					"border-destructive focus-visible:ring-destructive",
																			)}
																		/>
																		{jsonInvalid ? (
																			<p className="text-xs text-destructive">
																				{t(
																					"propertiesPanel.apiBodyRawJsonError",
																				)}
																			</p>
																		) : (
																			<p className="text-xs text-muted-foreground">
																				{t(
																					"propertiesPanel.apiBodyRawJsonDesc",
																				)}
																			</p>
																		)}
																		<div className="rounded-md border border-border/60 overflow-hidden">
																			<button
																				type="button"
																				onClick={() =>
																					setShowRawJsonVarPicker(
																						!showRawJsonVarPicker,
																					)
																				}
																				className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors text-xs text-muted-foreground"
																			>
																				<span className="font-medium">
																					{t(
																						"propertiesPanel.availableVarsLabel",
																					)}
																				</span>
																				<span>
																					{showRawJsonVarPicker ? "▲" : "▼"}
																				</span>
																			</button>
																			{showRawJsonVarPicker &&
																				(upstreamVariableNodes.length > 0 ? (
																					<VariablePicker
																						nodes={upstreamVariableNodes}
																						onSelect={(variable) =>
																							insertVariableIntoBodyConfig(
																								rawJsonTextareaRef,
																								variable.path,
																								"rawJson",
																							)
																						}
																						className="rounded-none border-0 shadow-none"
																					/>
																				) : (
																					<div className="px-3 py-2 text-xs text-muted-foreground">
																						{t(
																							"propertiesPanel.noVarsAvailable",
																						)}
																					</div>
																				))}
																		</div>
																	</div>
																);
															}
															if (bc.mode === "raw-xml") {
																const xmlValue = bc.rawXml ?? "";
																const xmlInvalid =
																	xmlValue.trim() !== "" &&
																	!isWellFormedXml(xmlValue);
																return (
																	<div className="space-y-1">
																		<Label>
																			{t("propertiesPanel.apiBodyRawXmlLabel")}
																		</Label>
																		<Textarea
																			ref={rawXmlTextareaRef}
																			value={xmlValue}
																			onChange={(e) =>
																				updateBody({ rawXml: e.target.value })
																			}
																			placeholder={t(
																				"propertiesPanel.apiBodyRawXmlPlaceholder",
																			)}
																			rows={4}
																			aria-invalid={xmlInvalid}
																			className={cn(
																				"font-mono text-xs resize-none",
																				xmlInvalid &&
																					"border-destructive focus-visible:ring-destructive",
																			)}
																		/>
																		{xmlInvalid ? (
																			<p className="text-xs text-destructive">
																				{t(
																					"propertiesPanel.apiBodyRawXmlError",
																				)}
																			</p>
																		) : (
																			<p className="text-xs text-muted-foreground">
																				{t("propertiesPanel.apiBodyRawXmlDesc")}
																			</p>
																		)}
																		<div className="rounded-md border border-border/60 overflow-hidden">
																			<button
																				type="button"
																				onClick={() =>
																					setShowRawXmlVarPicker(
																						!showRawXmlVarPicker,
																					)
																				}
																				className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors text-xs text-muted-foreground"
																			>
																				<span className="font-medium">
																					{t(
																						"propertiesPanel.availableVarsLabel",
																					)}
																				</span>
																				<span>
																					{showRawXmlVarPicker ? "▲" : "▼"}
																				</span>
																			</button>
																			{showRawXmlVarPicker &&
																				(upstreamVariableNodes.length > 0 ? (
																					<VariablePicker
																						nodes={upstreamVariableNodes}
																						onSelect={(variable) =>
																							insertVariableIntoBodyConfig(
																								rawXmlTextareaRef,
																								variable.path,
																								"rawXml",
																							)
																						}
																						className="rounded-none border-0 shadow-none"
																					/>
																				) : (
																					<div className="px-3 py-2 text-xs text-muted-foreground">
																						{t(
																							"propertiesPanel.noVarsAvailable",
																						)}
																					</div>
																				))}
																		</div>
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
																							{
																								sourceExpression: "",
																								targetKey: "",
																							},
																						],
																					})
																				}
																			>
																				{t(
																					"propertiesPanel.apiBodyAddMappingBtn",
																				)}
																			</Button>
																		</div>
																		{(bc.fieldMappings ?? []).map(
																			(mapping, idx) => (
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
																								sourceExpression:
																									e.target.value,
																							};
																							updateBody({
																								fieldMappings: mappings,
																							});
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
																							updateBody({
																								fieldMappings: mappings,
																							});
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
																			),
																		)}
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
													<Label>
														{t("propertiesPanel.apiResponsePathLabel")}
													</Label>
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
																	responseConfig: {
																		extractPath: e.target.value,
																	},
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
																	{(selectedNode.config.method as string) ||
																		"GET"}
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

												<CollapsibleSection
													title={t("propertiesPanel.apiFailureTitle")}
													defaultOpen={false}
												>
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
																					selectedCheckpointId ||
																					allCheckpoints[0],
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
															{failureHandling.onFailure ===
																"return-to-checkpoint" &&
																t("propertiesPanel.apiOnFailureDescCheckpoint")}
														</p>
													</div>

													{failureHandling.onFailure === "retry" && (
														<div className="mt-3 space-y-2">
															<FieldLabel
																htmlFor="api-max-retries"
																description={t(
																	"propertiesPanel.apiRetriesDesc",
																)}
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

																	const parsedValue = Number.parseInt(
																		inputValue,
																		10,
																	);
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
																	const parsedValue = Number.parseInt(
																		inputValue,
																		10,
																	);
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
															description={t(
																"propertiesPanel.apiCacheStrategyDesc",
															)}
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
																	{t(
																		"propertiesPanel.apiCacheUntilWorkflowEnd",
																	)}
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
																	Math.max(
																		5,
																		Number.parseInt(e.target.value) || 30,
																	),
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

													{failureHandling.onFailure ===
														"return-to-checkpoint" &&
														hasCheckpoint && (
															<div className="mt-3 space-y-2">
																<Label htmlFor="api-checkpoint-select">
																	{hasMultipleCheckpoints
																		? t(
																				"propertiesPanel.apiCheckpointSelectLabel",
																			)
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
																		{t(
																			"propertiesPanel.apiMultipleCheckpointsNote",
																		)}
																	</p>
																)}
															</div>
														)}

													{failureHandling.onFailure ===
														"return-to-checkpoint" &&
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
												</CollapsibleSection>

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
														description={t(
															"propertiesPanel.messageTemplateNameDesc",
														)}
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
													<VariableTemplateInput
														nodes={upstreamVariableNodes}
														value={parseTemplateStringToSegments(
															messageConfig.subject,
														)}
														onChange={(segs) =>
															setMessageConfig({
																...messageConfig,
																subject: segmentsToTemplateString(segs),
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
															description={t(
																"propertiesPanel.messageMergeVarsDesc",
															)}
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
														{(messageConfig.mergeVars ?? []).map(
															(mv, index) => (
																<div
																	key={index}
																	className="rounded-md border border-border/60 p-2 space-y-1.5 bg-muted/20"
																>
																	<div className="flex items-center gap-1.5">
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
																		<Button
																			type="button"
																			variant="ghost"
																			size="icon"
																			className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
																			onClick={() =>
																				handleMessageMergeVarRemove(index)
																			}
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
																	<div className="flex items-start gap-1.5">
																		<span className="text-muted-foreground text-xs pt-2 shrink-0">
																			=
																		</span>
																		<div className="flex-1 min-w-0">
																			<VariableTemplateInput
																				nodes={upstreamVariableNodes}
																				value={parseTemplateStringToSegments(
																					mv.value,
																				)}
																				onChange={(segs) =>
																					handleMessageMergeVarUpdate(
																						index,
																						"value",
																						segmentsToTemplateString(segs),
																					)
																				}
																				placeholder="valor o variable..."
																				className="text-xs"
																			/>
																		</div>
																	</div>
																</div>
															),
														)}
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
													placeholder={t(
														"propertiesPanel.messageSmsBodyPlaceholder",
													)}
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

										{/* ── Signature Config ─────────────────────────────── */}
										{signatureConfig && (
											<div className="space-y-4 rounded-md border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-800 dark:bg-amber-950/20">
												<div className="flex items-center justify-between">
													<p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
														{t("propertiesPanel.dropboxSignConfigTitle")}
													</p>
													<button
														type="button"
														onClick={handleRefreshAll}
														disabled={
															isRefreshingTemplates || isLoadingTemplate
														}
														title={t(
															"propertiesPanel.dropboxSignRefreshTooltip",
														)}
														className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-amber-600 hover:bg-amber-100 disabled:opacity-50 dark:text-amber-400 dark:hover:bg-amber-900/40"
													>
														<RefreshCw
															className={`h-3 w-3 ${isRefreshingTemplates ? "animate-spin" : ""}`}
														/>
														Actualizar
													</button>
												</div>

												{/* Template */}
												<div className="space-y-1">
													<Label htmlFor="sig-template-id" className="text-xs">
														Template
													</Label>
													{availableSignatureTemplates.length > 0 ? (
														<Select
															value={signatureConfig.templateId ?? ""}
															onValueChange={(v) => {
																setSignatureConfig({ templateId: v });
																// Auto-cargar campos del template seleccionado
																setIsLoadingTemplate(true);
																getSignatureTemplateAction(v)
																	.then((tpl) => {
																		setSignatureConfig({
																			templateId: v,
																			signers: tpl.signerRoles.map((sr) => ({
																				role: sr.name,
																				source: "variable" as const,
																				email: "",
																				name: "",
																			})),
																			customFields: tpl.customFields.map(
																				(cf) => ({
																					apiId: cf.apiId,
																					name: cf.name,
																					type: cf.type,
																					value: "",
																					required: cf.required,
																					source: "discovered" as const,
																				}),
																			),
																		});
																		setCustomFieldsSearch("");
																		setExpandedCustomFieldIndices(new Set());
																	})
																	.catch(() => {
																		/* silent fail */
																	})
																	.finally(() => setIsLoadingTemplate(false));
															}}
														>
															<SelectTrigger
																id="sig-template-id"
																className="text-xs"
															>
																<SelectValue
																	placeholder={
																		signatureTemplatesLoading
																			? "Cargando templates…"
																			: "Selecciona un template"
																	}
																/>
															</SelectTrigger>
															<SelectContent>
																{availableSignatureTemplates.map((tpl) => (
																	<SelectItem
																		key={tpl.templateId}
																		value={tpl.templateId}
																		className="text-xs"
																	>
																		{tpl.title}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													) : (
														<div className="space-y-1">
															<div className="flex gap-1">
																<Input
																	id="sig-template-id"
																	className="text-xs font-mono flex-1"
																	placeholder="e.g. abc123"
																	value={signatureConfig.templateId ?? ""}
																	onChange={(e) =>
																		setSignatureConfig({
																			templateId: e.target.value,
																		})
																	}
																/>
																<Button
																	type="button"
																	variant="outline"
																	size="sm"
																	disabled={
																		isLoadingTemplate ||
																		!signatureConfig.templateId
																	}
																	onClick={handleRefreshTemplateFields}
																	className="text-xs"
																>
																	{isLoadingTemplate ? "Cargando…" : "Cargar"}
																</Button>
															</div>
															<p className="text-[10px] text-muted-foreground">
																{signatureTemplatesLoading
																	? "Cargando templates disponibles…"
																	: "No se pudieron cargar los templates. Ingresa el ID manualmente."}
															</p>
														</div>
													)}
													{availableSignatureTemplates.length > 0 &&
														signatureConfig.templateId && (
															<p className="text-[10px] text-muted-foreground">
																También puedes usar expresiones:{" "}
																<code>{"{${case.templateId}}"}</code>
															</p>
														)}
													{isLoadingTemplate && (
														<p className="text-[10px] text-muted-foreground">
															Cargando campos del template…
														</p>
													)}
												</div>

												{/* Flow */}
												<div className="space-y-1">
													<Label htmlFor="sig-flow" className="text-xs">
														Flujo de firma
													</Label>
													<Select
														value={signatureConfig.flow ?? "email_only"}
														onValueChange={(v) =>
															setSignatureConfig({ flow: v as SignatureFlow })
														}
													>
														<SelectTrigger id="sig-flow">
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															{SIGNATURE_FLOW_OPTIONS.map((opt) => (
																<SelectItem key={opt.value} value={opt.value}>
																	{opt.label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
													{(() => {
														const desc = SIGNATURE_FLOW_OPTIONS.find(
															(o) => o.value === signatureConfig.flow,
														)?.desc;
														return desc ? (
															<p className="text-[10px] text-muted-foreground">
																{desc}
															</p>
														) : null;
													})()}
												</div>

												{/* Title / Document name */}
												<div className="space-y-1">
													<Label className="text-xs">
														Nombre del documento (opcional)
													</Label>
													<VariableTemplateInput
														nodes={upstreamVariableNodes}
														value={parseTemplateStringToSegments(
															signatureConfig.title ?? "",
														)}
														onChange={(segs) =>
															setSignatureConfig({
																title:
																	segmentsToTemplateString(segs) || undefined,
															})
														}
														placeholder={`Case \${caseId}`}
													/>
													<p className="text-[10px] text-muted-foreground">
														Título que verán los firmantes en Dropbox Sign.
													</p>
												</div>

												{/* Subject / Message */}
												<div className="grid grid-cols-2 gap-2">
													<div className="space-y-1">
														<Label className="text-xs">Asunto (opcional)</Label>
														<VariableTemplateInput
															nodes={upstreamVariableNodes}
															value={parseTemplateStringToSegments(
																signatureConfig.subject ?? "",
															)}
															onChange={(segs) =>
																setSignatureConfig({
																	subject:
																		segmentsToTemplateString(segs) || undefined,
																})
															}
															placeholder="Asunto del correo"
														/>
													</div>
													<div className="space-y-1">
														<Label className="text-xs">
															Mensaje (opcional)
														</Label>
														<VariableTemplateInput
															nodes={upstreamVariableNodes}
															value={parseTemplateStringToSegments(
																signatureConfig.message ?? "",
															)}
															onChange={(segs) =>
																setSignatureConfig({
																	message:
																		segmentsToTemplateString(segs) || undefined,
																})
															}
															placeholder="Mensaje del correo"
														/>
													</div>
												</div>

												{/* Signers */}
												<div className="space-y-2">
													<div className="flex items-center justify-between">
														<Label className="text-xs font-semibold">
															Firmantes
														</Label>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															className="h-6 text-xs"
															onClick={() =>
																setSignatureConfig({
																	signers: [
																		...(signatureConfig.signers ?? []),
																		{
																			role: "",
																			source: "variable",
																			email: "",
																			name: "",
																		},
																	],
																})
															}
														>
															+ Agregar
														</Button>
													</div>
													{(signatureConfig.signers ?? []).map(
														(signer, idx) => (
															<div
																key={idx}
																className="space-y-1 rounded border border-border/40 p-2"
															>
																<div className="flex items-center gap-1">
																	<Input
																		className="text-xs flex-1"
																		placeholder="Rol (ej. Client)"
																		value={signer.role}
																		onChange={(e) => {
																			const next = [
																				...(signatureConfig.signers ?? []),
																			];
																			next[idx] = {
																				...next[idx],
																				role: e.target.value,
																			};
																			setSignatureConfig({ signers: next });
																		}}
																	/>
																	<Select
																		value={signer.source}
																		onValueChange={(v) => {
																			const next = [
																				...(signatureConfig.signers ?? []),
																			];
																			next[idx] = {
																				...next[idx],
																				source: v as "case_role" | "variable",
																			};
																			setSignatureConfig({ signers: next });
																		}}
																	>
																		<SelectTrigger className="h-8 text-xs w-32">
																			<SelectValue />
																		</SelectTrigger>
																		<SelectContent>
																			<SelectItem value="case_role">
																				Rol del case
																			</SelectItem>
																			<SelectItem value="variable">
																				Variable
																			</SelectItem>
																		</SelectContent>
																	</Select>
																	<Button
																		type="button"
																		variant="ghost"
																		size="sm"
																		className="h-6 text-xs text-destructive"
																		onClick={() => {
																			const next = (
																				signatureConfig.signers ?? []
																			).filter((_, i) => i !== idx);
																			setSignatureConfig({ signers: next });
																		}}
																	>
																		×
																	</Button>
																</div>
																{signer.source === "case_role" ? (
																	<Select
																		value={signer.caseRole ?? ""}
																		onValueChange={(v) => {
																			const next = [
																				...(signatureConfig.signers ?? []),
																			];
																			next[idx] = {
																				...next[idx],
																				caseRole:
																					v as SignatureSignerConfig["caseRole"],
																			};
																			setSignatureConfig({ signers: next });
																		}}
																	>
																		<SelectTrigger className="h-8 text-xs">
																			<SelectValue placeholder="Selecciona rol" />
																		</SelectTrigger>
																		<SelectContent>
																			{CASE_ROLE_OPTIONS.map((opt) => (
																				<SelectItem
																					key={opt.value}
																					value={opt.value ?? ""}
																				>
																					{opt.label}
																				</SelectItem>
																			))}
																		</SelectContent>
																	</Select>
																) : (
																	<>
																		<VariableTemplateInput
																			nodes={upstreamVariableNodes}
																			value={parseTemplateStringToSegments(
																				signer.email ?? "",
																			)}
																			placeholder="email@ejemplo.com o expresión"
																			onChange={(segs) => {
																				const next = [
																					...(signatureConfig.signers ?? []),
																				];
																				next[idx] = {
																					...next[idx],
																					email: segmentsToTemplateString(segs),
																				};
																				setSignatureConfig({ signers: next });
																			}}
																		/>
																		<VariableTemplateInput
																			nodes={upstreamVariableNodes}
																			value={parseTemplateStringToSegments(
																				signer.name ?? "",
																			)}
																			placeholder="Nombre completo o expresión"
																			onChange={(segs) => {
																				const next = [
																					...(signatureConfig.signers ?? []),
																				];
																				next[idx] = {
																					...next[idx],
																					name: segmentsToTemplateString(segs),
																				};
																				setSignatureConfig({ signers: next });
																			}}
																		/>
																	</>
																)}
																{signatureConfig.flow === "email_and_sms" && (
																	<Input
																		className="text-xs font-mono"
																		placeholder="Teléfono E.164 (ej. +15551234567)"
																		value={signer.smsPhoneNumber ?? ""}
																		onChange={(e) => {
																			const next = [
																				...(signatureConfig.signers ?? []),
																			];
																			next[idx] = {
																				...next[idx],
																				smsPhoneNumber:
																					e.target.value || undefined,
																			};
																			setSignatureConfig({ signers: next });
																		}}
																	/>
																)}
															</div>
														),
													)}
												</div>

												{/* Custom fields */}
												<div className="space-y-2">
													{/* Header */}
													<div className="flex items-center gap-1">
														<Label className="text-xs font-semibold shrink-0">
															Custom fields
														</Label>
														{(signatureConfig.customFields ?? []).length >
															0 && (
															<span className="text-[10px] text-muted-foreground">
																({(signatureConfig.customFields ?? []).length})
															</span>
														)}
														<div className="flex-1" />
														<Button
															type="button"
															variant="ghost"
															size="sm"
															className="h-6 text-xs"
															onClick={() => {
																const newIdx = (
																	signatureConfig.customFields ?? []
																).length;
																setSignatureConfig({
																	customFields: [
																		...(signatureConfig.customFields ?? []),
																		{
																			apiId: "",
																			name: "",
																			value: "",
																			source: "manual",
																		},
																	],
																});
																setExpandedCustomFieldIndices(
																	(prev) => new Set([...prev, newIdx]),
																);
															}}
														>
															+ Manual
														</Button>
													</div>

													{/* Buscador — visible cuando hay más de 3 campos */}
													{(signatureConfig.customFields ?? []).length > 3 && (
														<div className="relative">
															<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
															<Input
																className="text-xs pl-6 h-7"
																placeholder="Buscar campo…"
																value={customFieldsSearch}
																onChange={(e) =>
																	setCustomFieldsSearch(e.target.value)
																}
															/>
														</div>
													)}

													{/* Lista de campos — cada uno individualmente colapsable */}
													{(signatureConfig.customFields ?? [])
														.map((cf, realIdx) => ({ cf, realIdx }))
														.filter(({ cf }) => {
															if (!customFieldsSearch) return true;
															const q = customFieldsSearch.toLowerCase();
															return (
																cf.apiId.toLowerCase().includes(q) ||
																cf.name.toLowerCase().includes(q)
															);
														})
														.map(({ cf, realIdx }) => {
															const isExpanded =
																expandedCustomFieldIndices.has(realIdx);
															const toggleExpanded = () =>
																setExpandedCustomFieldIndices((prev) => {
																	const next = new Set(prev);
																	if (next.has(realIdx)) next.delete(realIdx);
																	else next.add(realIdx);
																	return next;
																});

															return (
																<div
																	key={realIdx}
																	className={cn(
																		"rounded border",
																		cf.source === "discovered"
																			? "border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/20"
																			: "border-border/40",
																	)}
																>
																	{/* Cabecera siempre visible */}
																	<div className="flex items-center gap-1 px-2 py-1.5">
																		<span
																			className={cn(
																				"flex-1 truncate font-mono font-medium",
																				isExpanded ? "text-xs" : "text-sm",
																			)}
																		>
																			{cf.apiId ||
																				cf.name ||
																				"campo sin nombre"}
																		</span>
																		{cf.source === "discovered" && (
																			<span className="text-[10px] text-blue-500 shrink-0">
																				auto
																			</span>
																		)}
																		{cf.value && !isExpanded && (
																			<span className="text-[10px] text-muted-foreground shrink-0 max-w-[80px] truncate">
																				= {cf.value}
																			</span>
																		)}
																		<Button
																			type="button"
																			variant="ghost"
																			size="sm"
																			className="h-5 w-5 p-0 shrink-0"
																			title={
																				isExpanded ? "Colapsar" : "Expandir"
																			}
																			onClick={toggleExpanded}
																		>
																			{isExpanded ? (
																				<ChevronUp className="h-3 w-3" />
																			) : (
																				<ChevronDown className="h-3 w-3" />
																			)}
																		</Button>
																		<Button
																			type="button"
																			variant="ghost"
																			size="sm"
																			className="h-5 w-5 p-0 text-destructive shrink-0"
																			onClick={() => {
																				const next = (
																					signatureConfig.customFields ?? []
																				).filter((_, i) => i !== realIdx);
																				setSignatureConfig({
																					customFields: next,
																				});
																				setExpandedCustomFieldIndices(
																					(prev) => {
																						const next2 = new Set<number>();
																						prev.forEach((i) => {
																							if (i < realIdx) next2.add(i);
																							else if (i > realIdx)
																								next2.add(i - 1);
																						});
																						return next2;
																					},
																				);
																			}}
																		>
																			×
																		</Button>
																	</div>

																	{/* Contenido expandido */}
																	{isExpanded && (
																		<div className="border-t border-border/30 px-2 pb-2 pt-1.5 space-y-1">
																			{cf.source === "manual" && (
																				<div className="grid grid-cols-2 gap-1">
																					<Input
																						className="text-xs font-mono"
																						placeholder="api_id"
																						value={cf.apiId}
																						onChange={(e) => {
																							const next = [
																								...(signatureConfig.customFields ??
																									[]),
																							];
																							next[realIdx] = {
																								...next[realIdx],
																								apiId: e.target.value,
																							};
																							setSignatureConfig({
																								customFields: next,
																							});
																						}}
																					/>
																					<Input
																						className="text-xs"
																						placeholder="nombre"
																						value={cf.name}
																						onChange={(e) => {
																							const next = [
																								...(signatureConfig.customFields ??
																									[]),
																							];
																							next[realIdx] = {
																								...next[realIdx],
																								name: e.target.value,
																							};
																							setSignatureConfig({
																								customFields: next,
																							});
																						}}
																					/>
																				</div>
																			)}
																			<VariableTemplateInput
																				nodes={upstreamVariableNodes}
																				value={parseTemplateStringToSegments(
																					cf.value,
																				)}
																				placeholder="valor o expresión"
																				onChange={(segs) => {
																					const next = [
																						...(signatureConfig.customFields ??
																							[]),
																					];
																					next[realIdx] = {
																						...next[realIdx],
																						value:
																							segmentsToTemplateString(segs),
																					};
																					setSignatureConfig({
																						customFields: next,
																					});
																				}}
																			/>
																		</div>
																	)}
																</div>
															);
														})}

													{/* Sin resultados de búsqueda */}
													{customFieldsSearch &&
														(signatureConfig.customFields ?? []).filter(
															(cf) => {
																const q = customFieldsSearch.toLowerCase();
																return (
																	cf.apiId.toLowerCase().includes(q) ||
																	cf.name.toLowerCase().includes(q)
																);
															},
														).length === 0 && (
															<p className="text-[10px] text-muted-foreground text-center py-1">
																No hay campos que coincidan con "
																{customFieldsSearch}"
															</p>
														)}
												</div>

												<p className="text-[10px] text-muted-foreground">
													SMS solo funciona fuera de test_mode. El delivery
													method del nodo (arriba) es solo para notificar al
													actor; la entrega de la liga de firma la controla el
													"Flujo de firma".
												</p>
											</div>
										)}

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
												<SelectTrigger
													id="challenge-delivery"
													className="w-full"
												>
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
																handleChallengeRetryCountChange(
																	event.target.value,
																)
															}
														/>
														<p className="text-xs text-muted-foreground">
															{t(
																"propertiesPanel.challengeRetryCountNote",
															).replace("{n}", String(MAX_CHALLENGE_RETRIES))}
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

										{/* Challenge UI labels: prompt text and button labels */}
										<CollapsibleSection
											title={t("propertiesPanel.sectionLabels")}
											defaultOpen={false}
										>
											{/* Prompt text */}
											<div className="space-y-1">
												<Label htmlFor="challenge-prompt" className="text-xs">
													{t("propertiesPanel.challengePromptLabel")}
												</Label>
												<div className="grid grid-cols-2 gap-2">
													<Textarea
														id="challenge-prompt"
														rows={2}
														value={challengeConfig.labels?.prompt ?? ""}
														onChange={(e) =>
															setChallengeConfig({
																...challengeConfig,
																labels: {
																	...challengeConfig.labels,
																	prompt: e.target.value || undefined,
																},
															})
														}
														placeholder={
															challengeConfig.challengeType === "signature"
																? "Se requiere tu firma para continuar con el proceso."
																: "Se requiere tu aprobación para continuar con el proceso."
														}
														className="text-xs"
													/>
													<Textarea
														id="challenge-prompt-es"
														rows={2}
														value={challengeConfig.labels?.promptEs ?? ""}
														onChange={(e) =>
															setChallengeConfig({
																...challengeConfig,
																labels: {
																	...challengeConfig.labels,
																	promptEs: e.target.value || undefined,
																},
															})
														}
														placeholder={
															challengeConfig.challengeType === "signature"
																? "Se requiere tu firma para continuar con el proceso."
																: "Se requiere tu aprobación para continuar con el proceso."
														}
														className="text-xs"
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

											{/* Approve button label */}
											<div className="space-y-1">
												<Label
													htmlFor="challenge-approve-label"
													className="text-xs"
												>
													{t("propertiesPanel.challengeApproveLabelField")}
												</Label>
												<div className="grid grid-cols-2 gap-2">
													<Input
														id="challenge-approve-label"
														value={challengeConfig.labels?.approveLabel ?? ""}
														onChange={(e) =>
															setChallengeConfig({
																...challengeConfig,
																labels: {
																	...challengeConfig.labels,
																	approveLabel: e.target.value || undefined,
																},
															})
														}
														placeholder={
															challengeConfig.challengeType === "signature"
																? "Firmar"
																: "Aprobar"
														}
														className="text-xs"
													/>
													<Input
														id="challenge-approve-label-es"
														value={challengeConfig.labels?.approveLabelEs ?? ""}
														onChange={(e) =>
															setChallengeConfig({
																...challengeConfig,
																labels: {
																	...challengeConfig.labels,
																	approveLabelEs: e.target.value || undefined,
																},
															})
														}
														placeholder={
															challengeConfig.challengeType === "signature"
																? "Firmar"
																: "Aprobar"
														}
														className="text-xs"
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

											{/* Reject button label */}
											<div className="space-y-1">
												<Label
													htmlFor="challenge-reject-label"
													className="text-xs"
												>
													{t("propertiesPanel.challengeRejectLabelField")}
												</Label>
												<div className="grid grid-cols-2 gap-2">
													<Input
														id="challenge-reject-label"
														value={challengeConfig.labels?.rejectLabel ?? ""}
														onChange={(e) =>
															setChallengeConfig({
																...challengeConfig,
																labels: {
																	...challengeConfig.labels,
																	rejectLabel: e.target.value || undefined,
																},
															})
														}
														placeholder="Rechazar"
														className="text-xs"
													/>
													<Input
														id="challenge-reject-label-es"
														value={challengeConfig.labels?.rejectLabelEs ?? ""}
														onChange={(e) =>
															setChallengeConfig({
																...challengeConfig,
																labels: {
																	...challengeConfig.labels,
																	rejectLabelEs: e.target.value || undefined,
																},
															})
														}
														placeholder="Rechazar"
														className="text-xs"
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
										</CollapsibleSection>

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

								{selectedNode.type === "Promotion" && promotionConfig && (
									<div className="space-y-4">
										<div className="space-y-2">
											<Label htmlFor="promotion-commission">
												{t("propertiesPanel.promotionCommissionLabel")}
											</Label>
											<Input
												id="promotion-commission"
												type="number"
												min={0}
												step={1}
												value={promotionConfig.commission}
												onChange={(e) => {
													const raw = e.target.value;
													const parsed = raw === "" ? 0 : Number(raw);
													const next: PromotionNodeConfig = {
														...promotionConfig,
														commission:
															Number.isFinite(parsed) && parsed >= 0
																? parsed
																: 0,
													};
													onUpdateNode(selectedNode.id, { config: next });
												}}
												placeholder={String(DEFAULT_PROMOTION_COMMISSION)}
											/>
											<p className="text-xs text-muted-foreground">
												{t("propertiesPanel.promotionCommissionDesc")}
											</p>
										</div>

										<div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
											<p className="font-medium text-foreground">
												{t("propertiesPanel.promotionOutputsTitle")}
											</p>
											<p className="mt-1">
												{t("propertiesPanel.promotionOutputsDesc")}
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
												value={
													(selectedNode.config.checkpointName as string) || ""
												}
												onChange={(e) =>
													onUpdateNode(selectedNode.id, {
														config: {
															...selectedNode.config,
															checkpointName: e.target.value,
														},
													})
												}
												placeholder={t(
													"propertiesPanel.checkpointNamePlaceholder",
												)}
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
														config: {
															...selectedNode.config,
															notes: e.target.value,
														},
													})
												}
												placeholder={t(
													"propertiesPanel.checkpointNotesPlaceholder",
												)}
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
											<ScrollArea
												className={flags.length > 5 ? "h-64" : "max-h-64"}
											>
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
																						flagChanges:
																							currentFlagChanges.filter(
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
																									? {
																											flagId: flag.id,
																											optionId,
																										}
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
																									backgroundColor:
																										getColorValue(
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
																									backgroundColor:
																										getColorValue(option.color),
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
																		backgroundColor: getColorValue(
																			option.color,
																		),
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

								{/* ── NLS Node ──────────────────────────────────────────── */}
								{selectedNode.type === "NLS" && (
									<div className="space-y-4">
										{/* Function selector */}
										<div className="space-y-2">
											<Label htmlFor="nls-function">NLS Function</Label>
											<Select
												value={
													(selectedNode.config as NLSNodeConfig).functionId ??
													""
												}
												onValueChange={(v) => {
													const functionId = v as NLSFunctionId;
													// Optimistic schema from cache (may be empty if cache not ready)
													const cachedFields =
														getNlsOutputFieldsFromCache(functionId) ?? [];
													const outputSchema = {
														name: `${functionId}Output`,
														properties: nlsOutputFieldsToSchema(
															cachedFields,
															functionId,
														),
													};
													getNlsFunctionAction(functionId)
														.then((detail) => {
															const discoveredFields = detail.sections.flatMap(
																(s) =>
																	s.fields.map((f) => ({
																		fieldId: f.id,
																		value: "",
																		source: "discovered" as const,
																	})),
															);
															// Use the actual schema from the detail response
															const actualOutputSchema = {
																name: `${functionId}Output`,
																properties: nlsOutputFieldsToSchema(
																	detail.outputFields,
																	functionId,
																),
															};
															onUpdateNode(selectedNode.id, {
																config: {
																	...selectedNode.config,
																	functionId,
																	fields: discoveredFields,
																	outputSchema: actualOutputSchema,
																},
															});
															setNlsFunctionDetail(detail);
															setNlsExpandedSections(
																new Set(detail.sections.map((s) => s.id)),
															);
														})
														.catch(() => {
															onUpdateNode(selectedNode.id, {
																config: {
																	...selectedNode.config,
																	functionId,
																	fields: [],
																	outputSchema,
																},
															});
														});
												}}
											>
												<SelectTrigger id="nls-function">
													<SelectValue
														placeholder={
															nlsFunctionsLoading
																? "Loading functions…"
																: "Select a function"
														}
													/>
												</SelectTrigger>
												<SelectContent>
													{nlsFunctions.map((fn) => (
														<SelectItem key={fn.id} value={fn.id}>
															{fn.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											{(() => {
												const fnId = (selectedNode.config as NLSNodeConfig)
													.functionId;
												if (!fnId) return null;
												const fnDef = nlsFunctions.find((f) => f.id === fnId);
												return (
													<p className="text-xs text-muted-foreground">
														{getNlsFunctionDescription(
															language,
															fnId,
															fnDef?.description ?? "",
														)}
													</p>
												);
											})()}
										</div>

										{/* Fields by section */}
										{nlsDetailLoading && (
											<p className="text-xs text-muted-foreground">
												{t("propertiesPanel.nlsFieldsLoading")}
											</p>
										)}
										{nlsFunctionDetail &&
											!nlsDetailLoading &&
											(() => {
												const nlsConfig = selectedNode.config as NLSNodeConfig;
												const fieldMap: Record<string, string> = {};
												for (const f of nlsConfig.fields ?? []) {
													fieldMap[f.fieldId] = f.value;
												}
												for (const sec of nlsFunctionDetail.sections) {
													for (const fld of sec.fields) {
														if (!(fld.id in fieldMap) && fld.defaultValue) {
															fieldMap[fld.id] = fld.defaultValue;
														}
													}
												}

												return nlsFunctionDetail.sections
													.map((section) => {
														const visibleFields = section.fields.filter(
															(field) => {
																if (field.hidden) return false;
																if (field.dependsOn) {
																	const depValue =
																		fieldMap[field.dependsOn.fieldId] ?? "";
																	if (depValue !== field.dependsOn.equals)
																		return false;
																}
																return true;
															},
														);
														if (visibleFields.length === 0) return null;

														const isExpanded = nlsExpandedSections.has(
															section.id,
														);
														return (
															<div
																key={section.id}
																className="rounded border border-border/40"
															>
																<button
																	type="button"
																	className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-accent/50"
																	onClick={() =>
																		setNlsExpandedSections((prev) => {
																			const next = new Set(prev);
																			if (next.has(section.id))
																				next.delete(section.id);
																			else next.add(section.id);
																			return next;
																		})
																	}
																>
																	{isExpanded ? (
																		<ChevronUp className="h-3 w-3" />
																	) : (
																		<ChevronDown className="h-3 w-3" />
																	)}
																	{getNlsSectionLabel(
																		language,
																		section.id,
																		section.label,
																	)}
																	<span className="text-[10px] text-muted-foreground font-normal">
																		({visibleFields.length})
																	</span>
																</button>
																{isExpanded && (
																	<div className="space-y-2 px-3 pb-3">
																		{visibleFields.map((field) => {
																			const fieldConfig = nlsConfig.fields.find(
																				(f) => f.fieldId === field.id,
																			);
																			const currentValue =
																				fieldConfig?.value ??
																				field.defaultValue ??
																				"";

																			if (
																				field.id === "userId" &&
																				fieldMap["actorType"] === "applicant"
																			) {
																				return (
																					<div
																						key={field.id}
																						className="space-y-1"
																					>
																						<Label className="text-xs">
																							{getNlsFieldLabel(
																								language,
																								field.id,
																								field.label,
																							)}
																						</Label>
																						<p className="text-xs text-muted-foreground bg-muted/50 px-2 py-1.5 rounded border border-border/40">
																							{t(
																								"propertiesPanel.nlsUserIdAutoInfo",
																							)}
																						</p>
																					</div>
																				);
																			}

																			if (
																				field.type === "select" &&
																				field.options
																			) {
																				return (
																					<div
																						key={field.id}
																						className="space-y-1"
																					>
																						<Label className="text-xs">
																							{getNlsFieldLabel(
																								language,
																								field.id,
																								field.label,
																							)}
																							{field.required && (
																								<span className="text-destructive ml-0.5">
																									*
																								</span>
																							)}
																						</Label>
																						<Select
																							value={currentValue}
																							onValueChange={(val) => {
																								const fields = [
																									...(nlsConfig.fields ?? []),
																								];
																								const idx = fields.findIndex(
																									(f) => f.fieldId === field.id,
																								);
																								if (idx >= 0) {
																									fields[idx] = {
																										...fields[idx],
																										value: val,
																									};
																								} else {
																									fields.push({
																										fieldId: field.id,
																										value: val,
																										source: "discovered",
																									});
																								}
																								onUpdateNode(selectedNode.id, {
																									config: {
																										...selectedNode.config,
																										fields,
																									},
																								});
																							}}
																						>
																							<SelectTrigger className="h-8 text-xs">
																								<SelectValue
																									placeholder={t(
																										"propertiesPanel.nlsSelectPlaceholder",
																									)}
																								/>
																							</SelectTrigger>
																							<SelectContent>
																								{field.options.map((opt) => (
																									<SelectItem
																										key={opt.value}
																										value={opt.value}
																									>
																										{getNlsOptionLabel(
																											language,
																											opt.value,
																											opt.label,
																										)}
																									</SelectItem>
																								))}
																							</SelectContent>
																						</Select>
																					</div>
																				);
																			}

																			return (
																				<div
																					key={field.id}
																					className="space-y-1"
																				>
																					<Label className="text-xs">
																						{getNlsFieldLabel(
																							language,
																							field.id,
																							field.label,
																						)}
																						{field.required && (
																							<span className="text-destructive ml-0.5">
																								*
																							</span>
																						)}
																					</Label>
																					<VariableTemplateInput
																						nodes={upstreamVariableNodes}
																						value={parseTemplateStringToSegments(
																							currentValue,
																						)}
																						placeholder={
																							field.defaultValue ||
																							`${field.type}${field.required ? ` (${t("propertiesPanel.nlsFieldRequired")})` : ""}`
																						}
																						onChange={(segs) => {
																							const val =
																								segmentsToTemplateString(segs);
																							const fields = [
																								...(nlsConfig.fields ?? []),
																							];
																							const idx = fields.findIndex(
																								(f) => f.fieldId === field.id,
																							);
																							if (idx >= 0) {
																								fields[idx] = {
																									...fields[idx],
																									value: val,
																								};
																							} else {
																								fields.push({
																									fieldId: field.id,
																									value: val,
																									source: "discovered",
																								});
																							}
																							onUpdateNode(selectedNode.id, {
																								config: {
																									...selectedNode.config,
																									fields,
																								},
																							});
																						}}
																					/>
																				</div>
																			);
																		})}
																	</div>
																)}
															</div>
														);
													})
													.filter(Boolean);
											})()}

										{/* Output fields — read-only display when function is selected */}
										{(selectedNode.config as NLSNodeConfig).functionId && (
											<div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
												<p className="font-medium text-foreground">
													{t("propertiesPanel.nlsOutputsTitle")}
												</p>
												<p className="mt-1">
													{t("propertiesPanel.nlsOutputsDesc")}
												</p>
												{(() => {
													const renderOutputProps = (
														props: OutputSchemaProperty[],
														depth: number = 0,
														prefix: string = "",
													): React.ReactNode[] => {
														return props.flatMap((prop) => {
															const fullPath = prefix
																? `${prefix}.${prop.name}`
																: prop.name;
															const indent = depth * 12;
															const nodes: React.ReactNode[] = [
																<li
																	key={prop.id}
																	style={{ paddingLeft: `${indent}px` }}
																>
																	<span className="font-mono text-foreground/80">
																		{prop.name}
																	</span>{" "}
																	<span className="text-muted-foreground">
																		({prop.type})
																	</span>
																</li>,
															];
															if (
																prop.type === "array" &&
																prop.items?.properties
															) {
																nodes.push(
																	...renderOutputProps(
																		prop.items.properties,
																		depth + 1,
																		`${fullPath}[]`,
																	),
																);
															} else if (
																prop.type === "object" &&
																prop.properties
															) {
																nodes.push(
																	...renderOutputProps(
																		prop.properties,
																		depth + 1,
																		fullPath,
																	),
																);
															}
															return nodes;
														});
													};
													const nlsCfgForOutput =
														selectedNode.config as NLSNodeConfig;
													// Prefer the schema stored in the node config (set when
													// the function was selected with the real API response).
													// Fall back to the live cache in case the node was saved
													// before this refactor.
													const storedProps = (
														nlsCfgForOutput.outputSchema as
															| { properties?: OutputSchemaProperty[] }
															| undefined
													)?.properties;
													const displayProps =
														storedProps && storedProps.length > 0
															? storedProps
															: nlsOutputFieldsToSchema(
																	getNlsOutputFieldsFromCache(
																		nlsCfgForOutput.functionId,
																	) ?? [],
																	nlsCfgForOutput.functionId,
																);
													return (
														<ul className="mt-2 space-y-0.5 list-disc list-inside">
															{renderOutputProps(displayProps)}
														</ul>
													);
												})()}
											</div>
										)}

										{/* Failure handling — reuses same pattern as API node */}
										{(() => {
											const nlsCfg = selectedNode.config as NLSNodeConfig;
											const failureHandling: APIFailureHandling =
												nlsCfg.failureHandling ?? {
													onFailure: "stop",
													maxRetries: 0,
													retryCount: 0,
													cacheStrategy: "always-execute",
													timeout: 30000,
												};
											const allCheckpoints = nodes
												.filter((n) => n.type === "Checkpoint")
												.map((n) => n.id);
											const hasCheckpoint = allCheckpoints.length > 0;
											const selectedCheckpointId = (
												failureHandling as APIFailureHandling & {
													checkpointId?: string;
												}
											).checkpointId;

											return (
												<CollapsibleSection
													title={t("propertiesPanel.apiFailureTitle")}
													defaultOpen={false}
												>
													<div className="space-y-2">
														<Label htmlFor="nls-on-failure">
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
																}
																onUpdateNode(selectedNode.id, {
																	config: {
																		...selectedNode.config,
																		failureHandling: {
																			...failureHandling,
																			onFailure: value,
																			...(value !== "return-to-checkpoint"
																				? { checkpointId: undefined }
																				: hasCheckpoint
																					? {
																							checkpointId:
																								selectedCheckpointId ||
																								allCheckpoints[0],
																						}
																					: {}),
																		},
																	},
																});
															}}
														>
															<SelectTrigger id="nls-on-failure">
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
													</div>

													{failureHandling.onFailure === "retry" && (
														<div className="mt-3 space-y-2">
															<Label htmlFor="nls-max-retries">
																{t("propertiesPanel.apiRetriesLabel")}
															</Label>
															<Input
																id="nls-max-retries"
																type="number"
																min={1}
																max={2}
																value={failureHandling.maxRetries || 1}
																onChange={(e) => {
																	const val = Math.min(
																		2,
																		Math.max(
																			1,
																			Number.parseInt(e.target.value) || 1,
																		),
																	);
																	onUpdateNode(selectedNode.id, {
																		config: {
																			...selectedNode.config,
																			failureHandling: {
																				...failureHandling,
																				maxRetries: val,
																			},
																		},
																	});
																}}
															/>
														</div>
													)}

													<div className="mt-3 space-y-2">
														<Label htmlFor="nls-timeout">
															{t("propertiesPanel.apiTimeoutLabel")}
														</Label>
														<Input
															id="nls-timeout"
															type="number"
															min={5}
															max={300}
															value={failureHandling.timeout / 1000}
															onChange={(e) => {
																const seconds = Math.min(
																	300,
																	Math.max(
																		5,
																		Number.parseInt(e.target.value) || 30,
																	),
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
												</CollapsibleSection>
											);
										})()}
									</div>
								)}

								{/* ── ExternalLink Node ─────────────────────────────────── */}
								{selectedNode.type === "ExternalLink" &&
									(() => {
										const elConfig = (selectedNode.config ??
											{}) as ExternalLinkNodeConfig;
										const updateElConfig = (
											patch: Partial<ExternalLinkNodeConfig>,
										) => {
											onUpdateNode(selectedNode.id, {
												config: { ...selectedNode.config, ...patch },
											});
										};
										return (
											<div className="space-y-4">
												{/* Mode selector */}
												<div className="space-y-2">
													<Label>{t("propertiesPanel.elModeLabel")}</Label>
													<Select
														value={elConfig.mode ?? "form"}
														onValueChange={(v) =>
															updateElConfig({ mode: v as ExternalLinkMode })
														}
													>
														<SelectTrigger>
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="form">
																{t("propertiesPanel.elModeForm")}
															</SelectItem>
															<SelectItem value="challenge">
																{t("propertiesPanel.elModeChallenge")}
															</SelectItem>
														</SelectContent>
													</Select>
												</div>

												{/* Form-specific config — shown right after mode */}
												{elConfig.mode === "form" && (
													<div className="space-y-3">
														<div className="space-y-2">
															<Label htmlFor="el-form-select">
																{t("propertiesPanel.elFormSelectLabel")}
															</Label>
															<Select
																value={elConfig.formConfig?.formId ?? ""}
																onValueChange={async (value) => {
																	const updates: Partial<ExternalLinkNodeConfig> =
																		{
																			formConfig: {
																				...elConfig.formConfig,
																				formId: value,
																				formVersion: undefined,
																			},
																		};
																	try {
																		setElFormVersionsLoading(true);
																		const fullForm = await getFormAction(value);
																		setElSelectedFormFull(fullForm);
																		const latestVersion =
																			fullForm.versions.length > 0
																				? fullForm.versions.reduce((a, b) =>
																						a.version > b.version ? a : b,
																					)
																				: null;
																		if (latestVersion) {
																			updates.formConfig = {
																				formId: value,
																				...updates.formConfig,
																				formVersion: latestVersion.version,
																			};
																			if (latestVersion.fields) {
																				(
																					updates as Record<string, unknown>
																				).outputSchema =
																					buildOutputSchemaFromFields(
																						latestVersion.fields,
																						fullForm.name,
																					);
																			}
																		}
																	} catch {
																		setElSelectedFormFull(null);
																	} finally {
																		setElFormVersionsLoading(false);
																	}
																	updateElConfig(updates);
																}}
																disabled={elFormsLoading}
															>
																<SelectTrigger id="el-form-select">
																	<SelectValue
																		placeholder={
																			elFormsLoading
																				? t(
																						"propertiesPanel.elFormSelectLoadingPlaceholder",
																					)
																				: t(
																						"propertiesPanel.elFormSelectPlaceholder",
																					)
																		}
																	/>
																</SelectTrigger>
																<SelectContent>
																	{elAvailableForms.length === 0 &&
																	!elFormsLoading ? (
																		<SelectItem value="__empty__" disabled>
																			{t("propertiesPanel.elFormNoForms")}
																		</SelectItem>
																	) : (
																		elAvailableForms.map((form) => (
																			<SelectItem key={form.id} value={form.id}>
																				{form.name}
																			</SelectItem>
																		))
																	)}
																</SelectContent>
															</Select>
															{elAvailableForms.length === 0 &&
																!elFormsLoading && (
																	<p className="text-xs text-muted-foreground">
																		{t("propertiesPanel.elFormNoFormsNote")}
																	</p>
																)}
														</div>
														{!!elConfig.formConfig?.formId &&
															(elSelectedFormFull?.versions?.length ?? 0) >
																0 && (
																<div className="space-y-2">
																	<Label htmlFor="el-form-version-select">
																		{t("propertiesPanel.elFormVersionLabel")}
																	</Label>
																	<Select
																		value={
																			elConfig.formConfig?.formVersion?.toString() ??
																			""
																		}
																		onValueChange={(val) => {
																			const versionNumber = Number(val);
																			const version =
																				elSelectedFormFull?.versions.find(
																					(v) => v.version === versionNumber,
																				);
																			const patch: Partial<ExternalLinkNodeConfig> =
																				{
																					formConfig: {
																						formId:
																							elConfig.formConfig?.formId ?? "",
																						...elConfig.formConfig,
																						formVersion: versionNumber,
																					},
																				};
																			if (version?.fields) {
																				(
																					patch as Record<string, unknown>
																				).outputSchema =
																					buildOutputSchemaFromFields(
																						version.fields,
																						elSelectedFormFull?.name ?? "Form",
																					);
																			}
																			updateElConfig(patch);
																		}}
																		disabled={elFormVersionsLoading}
																	>
																		<SelectTrigger id="el-form-version-select">
																			<SelectValue
																				placeholder={
																					elFormVersionsLoading
																						? t(
																								"propertiesPanel.elFormVersionLoadingPlaceholder",
																							)
																						: t(
																								"propertiesPanel.elFormVersionPlaceholder",
																							)
																				}
																			/>
																		</SelectTrigger>
																		<SelectContent>
																			{elSelectedFormFull?.versions
																				.slice()
																				.sort((a, b) => b.version - a.version)
																				.map((v) => (
																					<SelectItem
																						key={v.version}
																						value={v.version.toString()}
																					>
																						v{v.version}
																						{v.version ===
																							elSelectedFormFull.currentVersion &&
																							` ${t("propertiesPanel.elFormVersionLatest")}`}
																					</SelectItem>
																				))}
																		</SelectContent>
																	</Select>
																</div>
															)}
													</div>
												)}

												{/* Challenge-specific config — shown right after mode */}
												{elConfig.mode === "challenge" && (
													<div className="space-y-4">
														<div className="space-y-2">
															<Label>
																{t("propertiesPanel.elChallengeTimeoutLabel")}
															</Label>
															<div className="flex items-center gap-2">
																<Input
																	type="number"
																	min={1}
																	className="w-20"
																	value={
																		elConfig.challengeConfig?.timeout?.value ??
																		5
																	}
																	onChange={(e) =>
																		updateElConfig({
																			challengeConfig: {
																				challengeType: "acceptance",
																				...elConfig.challengeConfig,
																				timeout: {
																					value: Number(e.target.value),
																					unit:
																						elConfig.challengeConfig?.timeout
																							?.unit ?? "minutes",
																				},
																			},
																		})
																	}
																/>
																<Select
																	value={
																		elConfig.challengeConfig?.timeout?.unit ??
																		"minutes"
																	}
																	onValueChange={(v) =>
																		updateElConfig({
																			challengeConfig: {
																				challengeType: "acceptance",
																				...elConfig.challengeConfig,
																				timeout: {
																					value:
																						elConfig.challengeConfig?.timeout
																							?.value ?? 5,
																					unit: v as
																						| "seconds"
																						| "minutes"
																						| "hours"
																						| "days",
																				},
																			},
																		})
																	}
																>
																	<SelectTrigger className="w-28">
																		<SelectValue />
																	</SelectTrigger>
																	<SelectContent>
																		<SelectItem value="seconds">
																			{t(
																				"propertiesPanel.elChallengeTimeoutSeconds",
																			)}
																		</SelectItem>
																		<SelectItem value="minutes">
																			{t(
																				"propertiesPanel.elChallengeTimeoutMinutes",
																			)}
																		</SelectItem>
																		<SelectItem value="hours">
																			{t(
																				"propertiesPanel.elChallengeTimeoutHours",
																			)}
																		</SelectItem>
																		<SelectItem value="days">
																			{t(
																				"propertiesPanel.elChallengeTimeoutDays",
																			)}
																		</SelectItem>
																	</SelectContent>
																</Select>
															</div>
														</div>

														<div className="space-y-2">
															<Label>
																{t("propertiesPanel.elChallengePullTypeLabel")}
															</Label>
															<Select
																value={
																	elConfig.challengeConfig?.pullType ?? "soft"
																}
																onValueChange={(v) =>
																	updateElConfig({
																		challengeConfig: {
																			challengeType: "acceptance",
																			...elConfig.challengeConfig,
																			timeout: elConfig.challengeConfig
																				?.timeout ?? {
																				value: 5,
																				unit: "minutes",
																			},
																			pullType: v as "soft" | "hard" | "new",
																		},
																	})
																}
															>
																<SelectTrigger className="w-40">
																	<SelectValue />
																</SelectTrigger>
																<SelectContent>
																	<SelectItem value="soft">
																		{t(
																			"propertiesPanel.elChallengePullTypeSoft",
																		)}
																	</SelectItem>
																	<SelectItem value="hard">
																		{t(
																			"propertiesPanel.elChallengePullTypeHard",
																		)}
																	</SelectItem>
																	<SelectItem value="new">
																		{t(
																			"propertiesPanel.elChallengePullTypeNew",
																		)}
																	</SelectItem>
																</SelectContent>
															</Select>
															<p className="text-xs text-muted-foreground">
																{t("propertiesPanel.elChallengePullTypeDesc")}
															</p>
														</div>
													</div>
												)}

												{/* Channels */}
												<div className="space-y-2">
													<Label>{t("propertiesPanel.elChannelsLabel")}</Label>
													<div className="flex gap-4">
														{(["email", "sms"] as ExternalLinkChannel[]).map(
															(ch) => (
																<label
																	key={ch}
																	className="flex items-center gap-2 text-sm"
																>
																	<Checkbox
																		checked={(elConfig.channels ?? []).includes(
																			ch,
																		)}
																		onCheckedChange={(checked) => {
																			const channels = [
																				...(elConfig.channels ?? []),
																			];
																			if (checked) {
																				if (!channels.includes(ch))
																					channels.push(ch);
																			} else {
																				const idx = channels.indexOf(ch);
																				if (idx >= 0) channels.splice(idx, 1);
																			}
																			updateElConfig({ channels });
																		}}
																	/>
																	{ch.toUpperCase()}
																</label>
															),
														)}
													</div>
												</div>

												{/* Recipient */}
												<div className="space-y-2">
													<Label>{t("propertiesPanel.elRecipientLabel")}</Label>
													{(elConfig.channels ?? []).includes("email") && (
														<div className="space-y-1">
															<Label className="text-xs text-muted-foreground">
																{t("propertiesPanel.elEmailExpressionLabel")}
															</Label>
															<VariableTemplateInput
																nodes={upstreamVariableNodes}
																value={parseTemplateStringToSegments(
																	elConfig.recipient?.emailExpression,
																)}
																onChange={(segs) =>
																	updateElConfig({
																		recipient: {
																			...elConfig.recipient,
																			source: "variable",
																			emailExpression:
																				segmentsToTemplateString(segs),
																		},
																	})
																}
																placeholder={t(
																	"propertiesPanel.elEmailExpressionPlaceholder",
																)}
															/>
														</div>
													)}
													{(elConfig.channels ?? []).includes("sms") && (
														<div className="space-y-1">
															<Label className="text-xs text-muted-foreground">
																{t("propertiesPanel.elPhoneExpressionLabel")}
															</Label>
															<VariableTemplateInput
																nodes={upstreamVariableNodes}
																value={parseTemplateStringToSegments(
																	elConfig.recipient?.phoneExpression,
																)}
																onChange={(segs) =>
																	updateElConfig({
																		recipient: {
																			...elConfig.recipient,
																			source: "variable",
																			phoneExpression:
																				segmentsToTemplateString(segs),
																		},
																	})
																}
																placeholder={t(
																	"propertiesPanel.elPhoneExpressionPlaceholder",
																)}
															/>
														</div>
													)}
													<div className="space-y-1">
														<Label className="text-xs text-muted-foreground">
															{t("propertiesPanel.elNameExpressionLabel")}
														</Label>
														<VariableTemplateInput
															nodes={upstreamVariableNodes}
															value={parseTemplateStringToSegments(
																elConfig.recipient?.nameExpression,
															)}
															onChange={(segs) =>
																updateElConfig({
																	recipient: {
																		...elConfig.recipient,
																		source: "variable",
																		nameExpression:
																			segmentsToTemplateString(segs),
																	},
																})
															}
															placeholder={t(
																"propertiesPanel.elNameExpressionPlaceholder",
															)}
														/>
													</div>
												</div>

												{/* Link TTL */}
												<div className="space-y-2">
													<Label>{t("propertiesPanel.elLinkTtlLabel")}</Label>
													<div className="flex items-center gap-2">
														<Input
															type="number"
															min={1}
															className="w-20"
															value={elConfig.linkTtl?.value ?? 72}
															onChange={(e) =>
																updateElConfig({
																	linkTtl: {
																		...elConfig.linkTtl,
																		value: Number(e.target.value),
																		unit: elConfig.linkTtl?.unit ?? "hours",
																	},
																})
															}
														/>
														<Select
															value={elConfig.linkTtl?.unit ?? "hours"}
															onValueChange={(v) =>
																updateElConfig({
																	linkTtl: {
																		...elConfig.linkTtl,
																		value: elConfig.linkTtl?.value ?? 72,
																		unit: v as "hours" | "days",
																	},
																})
															}
														>
															<SelectTrigger className="w-24">
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="hours">
																	{t("propertiesPanel.elLinkTtlHours")}
																</SelectItem>
																<SelectItem value="days">
																	{t("propertiesPanel.elLinkTtlDays")}
																</SelectItem>
															</SelectContent>
														</Select>
													</div>
												</div>

												{/* Email config */}
												{(elConfig.channels ?? []).includes("email") && (
													<CollapsibleSection
														title={t("propertiesPanel.sectionEmailConfig")}
													>
														<div className="space-y-1">
															<Label className="text-xs text-muted-foreground">
																{t("propertiesPanel.elEmailTemplateNameLabel")}
															</Label>
															<Input
																value={elConfig.emailConfig?.templateName ?? ""}
																onChange={(e) =>
																	updateElConfig({
																		emailConfig: {
																			...elConfig.emailConfig,
																			templateName: e.target.value,
																			subject:
																				elConfig.emailConfig?.subject ?? "",
																			mergeVars:
																				elConfig.emailConfig?.mergeVars ?? [],
																		},
																	})
																}
																placeholder={t(
																	"propertiesPanel.elEmailTemplateNamePlaceholder",
																)}
															/>
														</div>
														<div className="space-y-1">
															<FieldLabel
																description={t(
																	"propertiesPanel.elEmailUrlVarNameDesc",
																)}
															>
																{t("propertiesPanel.elEmailUrlVarNameLabel")}
															</FieldLabel>
															<Input
																value={
																	elConfig.emailConfig?.urlVarName ?? "URL"
																}
																onChange={(e) =>
																	updateElConfig({
																		emailConfig: {
																			...elConfig.emailConfig,
																			templateName:
																				elConfig.emailConfig?.templateName ??
																				"",
																			subject:
																				elConfig.emailConfig?.subject ?? "",
																			mergeVars:
																				elConfig.emailConfig?.mergeVars ?? [],
																			urlVarName: e.target.value,
																		},
																	})
																}
																placeholder={t(
																	"propertiesPanel.elEmailUrlVarNamePlaceholder",
																)}
																className="font-mono uppercase"
															/>
														</div>
														<div className="space-y-1">
															<Label className="text-xs text-muted-foreground">
																{t("propertiesPanel.elEmailSubjectLabel")}
															</Label>
															<VariableTemplateInput
																nodes={upstreamVariableNodes}
																value={parseTemplateStringToSegments(
																	elConfig.emailConfig?.subject,
																)}
																onChange={(segs) =>
																	updateElConfig({
																		emailConfig: {
																			...elConfig.emailConfig,
																			templateName:
																				elConfig.emailConfig?.templateName ??
																				"",
																			subject: segmentsToTemplateString(segs),
																			mergeVars:
																				elConfig.emailConfig?.mergeVars ?? [],
																		},
																	})
																}
																placeholder={t(
																	"propertiesPanel.elEmailSubjectPlaceholder",
																)}
															/>
														</div>
														<div className="space-y-2">
															<div className="flex items-center justify-between">
																<FieldLabel
																	description={t(
																		"propertiesPanel.elEmailMergeVarsDesc",
																	)}
																>
																	{t("propertiesPanel.elEmailMergeVarsLabel")}
																</FieldLabel>
																<Button
																	type="button"
																	variant="outline"
																	size="sm"
																	className="h-7 px-2 text-xs"
																	onClick={() => {
																		const vars = [
																			...(elConfig.emailConfig?.mergeVars ??
																				[]),
																			{ key: "", value: "" },
																		];
																		updateElConfig({
																			emailConfig: {
																				...elConfig.emailConfig,
																				templateName:
																					elConfig.emailConfig?.templateName ??
																					"",
																				subject:
																					elConfig.emailConfig?.subject ?? "",
																				mergeVars: vars,
																			},
																		});
																	}}
																>
																	{t("propertiesPanel.elEmailMergeVarsAddBtn")}
																</Button>
															</div>
															{(elConfig.emailConfig?.mergeVars ?? [])
																.length === 0 && (
																<p className="text-xs text-muted-foreground italic">
																	{t("propertiesPanel.elEmailMergeVarsEmpty")}
																</p>
															)}
															<div className="space-y-2">
																{(elConfig.emailConfig?.mergeVars ?? []).map(
																	(mv, index) => (
																		<div
																			key={index}
																			className="rounded-md border border-border/60 p-2 space-y-1.5 bg-muted/20"
																		>
																			<div className="flex items-center gap-1.5">
																				<Input
																					value={mv.key}
																					onChange={(e) => {
																						const vars = [
																							...(elConfig.emailConfig
																								?.mergeVars ?? []),
																						];
																						vars[index] = {
																							...vars[index],
																							key: e.target.value,
																						};
																						updateElConfig({
																							emailConfig: {
																								...elConfig.emailConfig,
																								templateName:
																									elConfig.emailConfig
																										?.templateName ?? "",
																								subject:
																									elConfig.emailConfig
																										?.subject ?? "",
																								mergeVars: vars,
																							},
																						});
																					}}
																					placeholder={t(
																						"propertiesPanel.elEmailMergeVarKeyPlaceholder",
																					)}
																					className="h-7 flex-1 font-mono text-xs uppercase"
																				/>
																				<Button
																					type="button"
																					variant="ghost"
																					size="icon"
																					className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
																					onClick={() => {
																						const vars = [
																							...(elConfig.emailConfig
																								?.mergeVars ?? []),
																						];
																						vars.splice(index, 1);
																						updateElConfig({
																							emailConfig: {
																								...elConfig.emailConfig,
																								templateName:
																									elConfig.emailConfig
																										?.templateName ?? "",
																								subject:
																									elConfig.emailConfig
																										?.subject ?? "",
																								mergeVars: vars,
																							},
																						});
																					}}
																					aria-label={t(
																						"propertiesPanel.elEmailMergeVarRemoveAriaLabel",
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
																			<div className="flex items-start gap-1.5">
																				<span className="text-muted-foreground text-xs pt-2 shrink-0">
																					=
																				</span>
																				<div className="flex-1 min-w-0">
																					<VariableTemplateInput
																						nodes={upstreamVariableNodes}
																						value={parseTemplateStringToSegments(
																							mv.value,
																						)}
																						onChange={(segs) => {
																							const vars = [
																								...(elConfig.emailConfig
																									?.mergeVars ?? []),
																							];
																							vars[index] = {
																								...vars[index],
																								value:
																									segmentsToTemplateString(
																										segs,
																									),
																							};
																							updateElConfig({
																								emailConfig: {
																									...elConfig.emailConfig,
																									templateName:
																										elConfig.emailConfig
																											?.templateName ?? "",
																									subject:
																										elConfig.emailConfig
																											?.subject ?? "",
																									mergeVars: vars,
																								},
																							});
																						}}
																						placeholder={t(
																							"propertiesPanel.elEmailMergeVarValuePlaceholder",
																						)}
																						className="text-xs"
																					/>
																				</div>
																			</div>
																		</div>
																	),
																)}
															</div>
														</div>
													</CollapsibleSection>
												)}

												{/* SMS config */}
												{(elConfig.channels ?? []).includes("sms") && (
													<CollapsibleSection
														title={t("propertiesPanel.sectionSmsConfig")}
													>
														<div className="space-y-1">
															<Label className="text-xs text-muted-foreground">
																{t("propertiesPanel.elSmsBodyLabel")}
															</Label>
															<VariableTemplateInput
																nodes={upstreamVariableNodes}
																value={parseTemplateStringToSegments(
																	elConfig.smsConfig?.body,
																)}
																onChange={(segs) =>
																	updateElConfig({
																		smsConfig: {
																			body: segmentsToTemplateString(segs),
																		},
																	})
																}
																placeholder={t(
																	"propertiesPanel.elSmsBodyPlaceholder",
																)}
															/>
														</div>
													</CollapsibleSection>
												)}

												{/* Output schema — shown at the bottom when mode is form */}
												{elConfig.mode === "form" && (
													<OutputSchemaEditor
														value={
															selectedNode.config.outputSchema as
																| OutputSchema
																| undefined
														}
														onChange={handleUpdateOutputSchema}
														label={t("propertiesPanel.outputSchemaLabel")}
													/>
												)}
											</div>
										);
									})()}

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
																			selectedNode.config.maxRetries ===
																				undefined ||
																			selectedNode.config.maxRetries === null
																				? ""
																				: (selectedNode.config
																						.maxRetries as number)
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
																			const value = Number.parseInt(
																				inputValue,
																				10,
																			);
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
																		{(selectedNode.config
																			.maxRetries as number) === 0 ||
																		selectedNode.config.maxRetries ===
																			undefined ||
																		selectedNode.config.maxRetries === null
																			? t(
																					"propertiesPanel.rejectMaxRetriesUnlimited",
																				)
																			: t(
																					"propertiesPanel.rejectMaxRetriesLimited",
																				)}
																	</p>
																</div>

																{checkpoint && (
																	<div className="rounded-md bg-muted p-3 text-sm">
																		<p className="font-medium">
																			{t(
																				"propertiesPanel.rejectCheckpointLabel",
																			)}
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

								{/* Stale Timeout — al final de Config para todos los nodos que lo soportan */}
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
																<SelectItem
																	key={option.value}
																	value={option.value}
																>
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
							</div>
						</TabsContent>
					)}

					{/* ── Roles ───────────────────────────────────────────────────────── */}
					{hasRoles && (
						<TabsContent value="roles" className="mt-0">
							<div className="space-y-4 p-4 min-w-0 max-w-full overflow-hidden">
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
								{NODES_WITH_VISIBILITY_ROLES.includes(selectedNode.type) && (
									<div className="space-y-2">
										<Label>{t("propertiesPanel.visibilityRolesLabel")}</Label>
										<div className="space-y-2">
											{ROLE_OPTIONS.map((role) => {
												const effectiveRoles: Role[] =
													selectedNode.visibilityRoles ?? [...ROLE_OPTIONS];
												const isResponsibleRole =
													selectedNode.roles.includes(role);
												return (
													<div
														key={role}
														className="flex items-center space-x-2"
													>
														<Checkbox
															id={`visibility-role-${role}`}
															checked={effectiveRoles.includes(role)}
															disabled={isResponsibleRole}
															onCheckedChange={() =>
																handleVisibilityRoleToggle(role)
															}
														/>
														<label
															htmlFor={`visibility-role-${role}`}
															className={`text-sm leading-none ${isResponsibleRole ? "cursor-not-allowed opacity-70" : "peer-disabled:cursor-not-allowed peer-disabled:opacity-70"}`}
															title={
																isResponsibleRole
																	? t("propertiesPanel.visibilityRolesLocked")
																	: undefined
															}
														>
															{t(`propertiesPanel.roleNames.${role}`)}
															{isResponsibleRole && (
																<span className="ml-1 text-xs text-muted-foreground">
																	🔒
																</span>
															)}
														</label>
													</div>
												);
											})}
										</div>
										<p
											className={`text-xs ${
												(selectedNode.visibilityRoles?.length ??
													ROLE_OPTIONS.length) === 0
													? "text-destructive"
													: "text-muted-foreground"
											}`}
										>
											{t("propertiesPanel.visibilityRolesHelp")}
										</p>
									</div>
								)}
							</div>
						</TabsContent>
					)}
				</ScrollArea>
			</Tabs>
		</div>
	);
}
