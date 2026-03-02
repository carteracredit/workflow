"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { TopBar } from "./workflow/top-bar";
import {
	Canvas,
	DEFAULT_START_NODE_PAN,
	matchToolbarShortcut,
} from "./workflow/canvas";
import { PropertiesPanel } from "./workflow/properties-panel";
import { ValidationTray } from "./workflow/validation-tray";
import { PreviewModal } from "./workflow/preview-modal";
import { JSONModal } from "./workflow/json-modal";
import { CodeModal } from "./workflow/code-modal";
import { FlagManagerModal } from "./workflow/flag-manager-modal";
import { PublishModal } from "./workflow/publish-modal";
import { Toaster, toast } from "sonner";
import type {
	WorkflowNode,
	WorkflowEdge,
	ValidationError,
	WorkflowState,
	WorkflowMetadata,
	Flag,
} from "@/lib/workflow/types";
import { STALE_SUPPORTED_NODE_TYPES } from "@/lib/workflow/types";
import { validateWorkflow } from "@/lib/workflow/validation";
import { EXAMPLE_WORKFLOWS } from "@/lib/example-workflows";
import {
	canRedoHistory,
	canUndoHistory,
	initializeHistory,
	pushHistoryState,
	redoHistory,
	undoHistory,
} from "@/lib/workflow/history";
import { slugify } from "@/lib/slugify";
import { useWorkflowApiToken } from "@/hooks/useWorkflowApiToken";
import {
	createWorkflow,
	getWorkflow,
	updateWorkflow as updateWorkflowApi,
} from "@/lib/workflow-api/workflows";
import { ApiError, extractApiErrorMessage } from "@/lib/workflow-api/http";
import type { Workflow } from "@/lib/workflow-api/types";

// Legacy keys for backward compatibility (single-workflow editor mode)
const LEGACY_STORAGE_KEY = "cartera-workflow-state";
const LEGACY_WORKFLOW_API_ID_KEY = "cartera-workflow-api-id";

// Per-workflow draft key for multi-workflow mode
const getDraftKey = (id: string) => `cartera-workflow-draft-${id}`;
// Keep old STORAGE_KEY alias so existing localStorage still loads
const STORAGE_KEY = LEGACY_STORAGE_KEY;
const WORKFLOW_API_ID_KEY = LEGACY_WORKFLOW_API_ID_KEY;

/**
 * Derives a PascalCase class name from a workflow name.
 * e.g. "Credit App Workflow" → "CreditAppWorkflow"
 */
function toClassName(name: string): string {
	return (
		name
			.replace(/[^a-zA-Z0-9\s]/g, "")
			.trim()
			.split(/\s+/)
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join("") || "GeneratedWorkflow"
	);
}

/**
 * Extracts the major version number from a semver string.
 * e.g. "2.1.0" → 2, "v3" → 3. Falls back to 1.
 */
function extractMajorVersion(version: string): number {
	const match = version.match(/(\d+)/);
	if (!match) return 1;
	const parsed = Number.parseInt(match[1], 10);
	return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

type NodeWithOptionalStaleTimeout = Omit<WorkflowNode, "staleTimeout"> & {
	staleTimeout?: WorkflowNode["staleTimeout"];
	checkpointType?: WorkflowNode["checkpointType"];
};

const nodeSupportsStaleTimeout = (type: WorkflowNode["type"]) =>
	STALE_SUPPORTED_NODE_TYPES.includes(type);

// Función de migración para convertir nodos legacy a nuevos tipos
function migrateLegacyNodes(
	nodes: Array<Omit<WorkflowNode, "type"> & { type: string }>,
): WorkflowNode[] {
	return nodes.map((node) => {
		const nodeType = node.type as string;
		// Migrar Status a FlagChange
		if (nodeType === "Status") {
			return {
				...node,
				type: "FlagChange" as const,
				config: {
					...node.config,
					flagChanges: [],
				},
			};
		}
		// Migrar Approve a End
		if (nodeType === "Approve") {
			return {
				...node,
				type: "End" as const,
			};
		}
		// Migrar ManualDecision a Decision
		if (nodeType === "ManualDecision") {
			return {
				...node,
				type: "Decision" as const,
				config: {
					condition: (node.config.condition as string) || "true",
					...Object.fromEntries(
						Object.entries(node.config).filter(
							([key]) => key !== "sla" && key !== "instructions",
						),
					),
				},
			};
		}
		return node as WorkflowNode;
	});
}

const withDefaultStaleTimeout = (
	node: NodeWithOptionalStaleTimeout,
): WorkflowNode => ({
	...node,
	checkpointType:
		node.type === "Checkpoint" ? (node.checkpointType ?? "normal") : undefined,
	staleTimeout: nodeSupportsStaleTimeout(node.type)
		? (node.staleTimeout ?? null)
		: null,
});

const createInitialStartNode = (): WorkflowNode =>
	withDefaultStaleTimeout({
		id: `node-${Date.now()}`,
		type: "Start",
		title: "Inicio",
		description: "Punto de inicio del flujo",
		roles: [],
		config: {},
		position: { x: 200, y: 200 }, // Posición inicial pensada para layout horizontal
		groupId: null,
	});

const createDefaultMetadata = (): WorkflowMetadata => ({
	name: "Nuevo Flujo de Trabajo",
	description: "",
	version: "1.0.0",
	author: "",
	tags: [],
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
});

const createHistoryEnabledState = (
	state: Omit<WorkflowState, "history" | "historyIndex">,
): WorkflowState => {
	const { history, historyIndex } = initializeHistory(state.nodes, state.edges);
	return {
		...state,
		history,
		historyIndex,
	};
};

const createEmptyWorkflowState = (): WorkflowState => {
	const nodes = [createInitialStartNode()];
	const edges: WorkflowEdge[] = [];

	return createHistoryEnabledState({
		metadata: createDefaultMetadata(),
		nodes,
		edges,
		flags: [],
		selectedNodeIds: [],
		selectedEdgeIds: [],
		zoom: 1,
		pan: { ...DEFAULT_START_NODE_PAN },
	});
};

type HistoryChange = Partial<WorkflowState> & {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	recordHistory?: boolean;
};

interface WorkflowEditorProps {
	/** If provided, load this workflow from the API. */
	workflowId?: string;
}

function buildDefinitionJson(
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
	flags: Flag[],
	zoom: number,
	pan: { x: number; y: number },
): string {
	return JSON.stringify({ nodes, edges, flags, zoom, pan });
}

function parseDefinitionJson(definition: string): {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	flags: Flag[];
	zoom: number;
	pan: { x: number; y: number };
} | null {
	try {
		const parsed = JSON.parse(definition);
		return {
			nodes: migrateLegacyNodes(parsed.nodes || []).map(
				withDefaultStaleTimeout,
			),
			edges: parsed.edges || [],
			flags: parsed.flags || [],
			zoom: parsed.zoom ?? 1,
			pan: parsed.pan || { ...DEFAULT_START_NODE_PAN },
		};
	} catch {
		return null;
	}
}

export function WorkflowEditor({ workflowId }: WorkflowEditorProps = {}) {
	const router = useRouter();
	const { token: apiToken } = useWorkflowApiToken();

	// When workflowId prop is given, it is the authoritative API ID.
	// Otherwise fall back to legacy localStorage key.
	const [workflowApiId, setWorkflowApiId] = useState<string | null>(() => {
		if (workflowId !== undefined) return workflowId;
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem(WORKFLOW_API_ID_KEY);
			if (saved) return saved;
		}
		return null;
	});

	const [workflowStatus, setWorkflowStatus] = useState<
		"draft" | "published" | "archived"
	>("draft");
	const [isLoadingFromApi, setIsLoadingFromApi] = useState(
		workflowId !== undefined,
	);

	// Initial state — overridden by API load when workflowId is set
	const [workflowState, setWorkflowState] = useState<WorkflowState>(() => {
		// If editing an existing workflow, start with empty and load from API
		if (workflowId !== undefined) {
			// Try per-workflow draft first (unsaved local changes)
			if (typeof window !== "undefined") {
				const draft = localStorage.getItem(getDraftKey(workflowId));
				if (draft) {
					const parsed = parseDefinitionJson(draft);
					if (parsed) {
						return createHistoryEnabledState({
							metadata: createDefaultMetadata(),
							...parsed,
							selectedNodeIds: [],
							selectedEdgeIds: [],
						});
					}
				}
			}
			return createEmptyWorkflowState();
		}

		// Legacy single-workflow mode: load from localStorage
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				try {
					const parsed = JSON.parse(saved);
					const migratedNodes = migrateLegacyNodes(parsed.nodes || []);
					const selectedNodeIds = parsed.selectedNodeIds
						? parsed.selectedNodeIds
						: parsed.selectedNodeId
							? [parsed.selectedNodeId]
							: [];
					const selectedEdgeIds = parsed.selectedEdgeIds
						? parsed.selectedEdgeIds
						: parsed.selectedEdgeId
							? [parsed.selectedEdgeId]
							: [];
					return createHistoryEnabledState({
						metadata: parsed.metadata || createDefaultMetadata(),
						nodes: migratedNodes.map(withDefaultStaleTimeout),
						edges: parsed.edges || [],
						flags: parsed.flags || [],
						selectedNodeIds,
						selectedEdgeIds,
						zoom: parsed.zoom ?? 1,
						pan: parsed.pan || { ...DEFAULT_START_NODE_PAN },
					});
				} catch (e) {
					console.error("[WorkflowEditor] Error loading from localStorage:", e);
				}
			}
		}
		return createEmptyWorkflowState();
	});

	// Load workflow from API when workflowId prop is set
	useEffect(() => {
		if (workflowId === undefined || !apiToken) return;

		let cancelled = false;
		setIsLoadingFromApi(true);

		getWorkflow(workflowId, { jwt: apiToken })
			.then((wf: Workflow) => {
				if (cancelled) return;

				setWorkflowStatus(wf.status ?? "draft");

				// Build metadata from API data
				const metadata: WorkflowMetadata = {
					name: wf.name,
					description: wf.description,
					version: `${wf.current_major_version}.0.0`,
					author: "",
					tags: [],
					createdAt: wf.created_at,
					updatedAt: wf.updated_at,
				};

				// Parse definition if available, otherwise keep current state
				if (wf.definition) {
					const parsed = parseDefinitionJson(wf.definition);
					if (parsed) {
						setWorkflowState(
							createHistoryEnabledState({
								metadata,
								nodes: parsed.nodes,
								edges: parsed.edges,
								flags: parsed.flags,
								zoom: parsed.zoom,
								pan: parsed.pan,
								selectedNodeIds: [],
								selectedEdgeIds: [],
							}),
						);
					} else {
						setWorkflowState((prev) => ({
							...prev,
							metadata,
						}));
					}
				} else {
					// No definition yet — just update the metadata
					setWorkflowState((prev) => ({
						...prev,
						metadata,
					}));
				}
			})
			.catch((err) => {
				if (cancelled) return;
				console.error("[WorkflowEditor] Failed to load from API:", err);
				toast.error("No se pudo cargar el workflow", {
					description: extractApiErrorMessage(err),
				});
			})
			.finally(() => {
				if (!cancelled) setIsLoadingFromApi(false);
			});

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [workflowId, apiToken]);

	const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
		[],
	);
	const [showPreview, setShowPreview] = useState(false);
	const [showJSON, setShowJSON] = useState(false);
	const [jsonMode, setJsonMode] = useState<"export" | "import">("export");
	const [showCode, setShowCode] = useState(false);
	const [showFlagManager, setShowFlagManager] = useState(false);
	const [showWorkflowProperties, setShowWorkflowProperties] = useState(false);
	const [showPublish, setShowPublish] = useState(false);
	const [validationStatus, setValidationStatus] = useState<
		"idle" | "valid" | "invalid"
	>("idle");
	const [lastValidationErrorCount, setLastValidationErrorCount] = useState(0);
	const hasMountedRef = useRef(false);

	useEffect(() => {
		if (typeof window !== "undefined" && !isLoadingFromApi) {
			const definitionJson = buildDefinitionJson(
				workflowState.nodes,
				workflowState.edges,
				workflowState.flags,
				workflowState.zoom,
				workflowState.pan,
			);

			if (workflowId !== undefined) {
				// Per-workflow draft key for multi-workflow mode
				localStorage.setItem(getDraftKey(workflowId), definitionJson);
			} else {
				// Legacy single-workflow key
				const toSave = {
					metadata: {
						...workflowState.metadata,
						updatedAt: new Date().toISOString(),
					},
					nodes: workflowState.nodes,
					edges: workflowState.edges,
					flags: workflowState.flags,
					zoom: workflowState.zoom,
					pan: workflowState.pan,
				};
				localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
			}
		}
	}, [
		workflowId,
		isLoadingFromApi,
		workflowState.nodes,
		workflowState.edges,
		workflowState.flags,
		workflowState.zoom,
		workflowState.pan,
		workflowState.metadata,
	]);

	useEffect(() => {
		if (!hasMountedRef.current) {
			hasMountedRef.current = true;
			return;
		}
		setValidationStatus("idle");
		setLastValidationErrorCount(0);
	}, [
		workflowState.nodes,
		workflowState.edges,
		workflowState.flags,
		workflowState.metadata,
	]);

	const updateWorkflow = useCallback((updates: Partial<WorkflowState>) => {
		setWorkflowState((prev) => ({ ...prev, ...updates }));
	}, []);

	const applyHistoryChange = useCallback(
		(getUpdates: (prev: WorkflowState) => HistoryChange) => {
			setWorkflowState((prev) => {
				const { recordHistory = true, ...updates } = getUpdates(prev);
				const historyPayload = recordHistory
					? pushHistoryState({
							history: prev.history,
							historyIndex: prev.historyIndex,
							nodes: updates.nodes,
							edges: updates.edges,
						})
					: {};

				return {
					...prev,
					...updates,
					...historyPayload,
				};
			});
		},
		[setWorkflowState],
	);

	const commitHistorySnapshot = useCallback(() => {
		setWorkflowState((prev) => {
			const historyPayload = pushHistoryState({
				history: prev.history,
				historyIndex: prev.historyIndex,
				nodes: prev.nodes,
				edges: prev.edges,
			});

			return {
				...prev,
				...historyPayload,
			};
		});
	}, []);

	const addNode = useCallback(
		(node: WorkflowNode) => {
			applyHistoryChange((prev) => ({
				nodes: [...prev.nodes, withDefaultStaleTimeout(node)],
				edges: prev.edges,
			}));
		},
		[applyHistoryChange],
	);

	const updateNode = useCallback(
		(
			nodeId: string,
			updates: Partial<WorkflowNode>,
			options?: { recordHistory?: boolean },
		) => {
			if (options?.recordHistory === false) {
				setWorkflowState((prev) => ({
					...prev,
					nodes: prev.nodes.map((n) => {
						if (n.id !== nodeId) return n;
						const nextNode = { ...n, ...updates };
						return withDefaultStaleTimeout(nextNode);
					}),
				}));
				return;
			}

			applyHistoryChange((prev) => ({
				nodes: prev.nodes.map((n) => {
					if (n.id !== nodeId) return n;
					const nextNode = { ...n, ...updates };
					return withDefaultStaleTimeout(nextNode);
				}),
				edges: prev.edges,
				recordHistory: true,
			}));
		},
		[applyHistoryChange],
	);

	const deleteNode = useCallback(
		(nodeId: string) => {
			applyHistoryChange((prev) => {
				const nextEdges = prev.edges.filter(
					(e) => e.from !== nodeId && e.to !== nodeId,
				);
				const nextEdgeIds = new Set(nextEdges.map((edge) => edge.id));
				return {
					nodes: prev.nodes.filter((n) => n.id !== nodeId),
					edges: nextEdges,
					selectedNodeIds: prev.selectedNodeIds.filter((id) => id !== nodeId),
					selectedEdgeIds: prev.selectedEdgeIds.filter((id) =>
						nextEdgeIds.has(id),
					),
				};
			});
		},
		[applyHistoryChange],
	);

	const addEdge = useCallback(
		(edge: WorkflowEdge) => {
			applyHistoryChange((prev) => ({
				nodes: prev.nodes,
				edges: [...prev.edges, edge],
			}));
		},
		[applyHistoryChange],
	);

	const updateEdge = useCallback(
		(edgeId: string, updates: Partial<WorkflowEdge>) => {
			applyHistoryChange((prev) => ({
				nodes: prev.nodes,
				edges: prev.edges.map((e) =>
					e.id === edgeId ? { ...e, ...updates } : e,
				),
			}));
		},
		[applyHistoryChange],
	);

	const deleteEdge = useCallback(
		(edgeId: string) => {
			applyHistoryChange((prev) => ({
				nodes: prev.nodes,
				edges: prev.edges.filter((e) => e.id !== edgeId),
				selectedEdgeIds: prev.selectedEdgeIds.filter((id) => id !== edgeId),
			}));
		},
		[applyHistoryChange],
	);

	const handleCopy = useCallback(
		(copiedNodes: WorkflowNode[], copiedEdges: WorkflowEdge[]) => {
			// Copy operation is handled by Canvas, this callback is for future use if needed
			// (e.g., showing a toast notification)
			console.log(
				"[v0] Copied",
				copiedNodes.length,
				"nodes and",
				copiedEdges.length,
				"edges",
			);
		},
		[],
	);

	const handlePaste = useCallback(
		(pastedNodes: WorkflowNode[], pastedEdges: WorkflowEdge[]) => {
			applyHistoryChange((prev) => {
				const newNodes = [
					...prev.nodes,
					...pastedNodes.map(withDefaultStaleTimeout),
				];
				const newEdges = [...prev.edges, ...pastedEdges];
				return {
					nodes: newNodes,
					edges: newEdges,
					selectedNodeIds: pastedNodes.map((n) => n.id),
					selectedEdgeIds: pastedEdges.map((e) => e.id),
				};
			});
		},
		[applyHistoryChange],
	);

	const handleUndo = useCallback(() => {
		setWorkflowState((prev) => {
			const undoResult = undoHistory({
				history: prev.history,
				historyIndex: prev.historyIndex,
			});

			if (!undoResult) {
				return prev;
			}

			return {
				...prev,
				nodes: undoResult.nodes,
				edges: undoResult.edges,
				selectedNodeIds: [],
				selectedEdgeIds: [],
				historyIndex: undoResult.historyIndex,
			};
		});
	}, [setWorkflowState]);

	const handleRedo = useCallback(() => {
		setWorkflowState((prev) => {
			const redoResult = redoHistory({
				history: prev.history,
				historyIndex: prev.historyIndex,
			});

			if (!redoResult) {
				return prev;
			}

			return {
				...prev,
				nodes: redoResult.nodes,
				edges: redoResult.edges,
				selectedNodeIds: [],
				selectedEdgeIds: [],
				historyIndex: redoResult.historyIndex,
			};
		});
	}, [setWorkflowState]);

	const handleValidate = useCallback(() => {
		const errors = validateWorkflow(workflowState.nodes, workflowState.edges);
		setValidationErrors(errors);
		const isValid = errors.length === 0;
		setLastValidationErrorCount(errors.length);
		setValidationStatus(isValid ? "valid" : "invalid");
		return isValid;
	}, [workflowState.nodes, workflowState.edges]);

	const handleSave = useCallback(async () => {
		if (!apiToken) {
			toast.error("No autenticado", {
				description: "Debes iniciar sesión para guardar el workflow.",
			});
			return;
		}

		const definitionJson = buildDefinitionJson(
			workflowState.nodes,
			workflowState.edges,
			workflowState.flags,
			workflowState.zoom,
			workflowState.pan,
		);

		const payload = {
			name: workflowState.metadata.name || "Nuevo Flujo de Trabajo",
			slug: slugify(workflowState.metadata.name || "nuevo-flujo-de-trabajo"),
			description: workflowState.metadata.description || "",
			class_name: toClassName(
				workflowState.metadata.name || "GeneratedWorkflow",
			),
			current_major_version: extractMajorVersion(
				workflowState.metadata.version,
			),
			definition: definitionJson,
		};

		try {
			if (workflowApiId !== null) {
				await updateWorkflowApi(workflowApiId, payload, { jwt: apiToken });
				toast.success("Workflow actualizado", {
					description: `"${payload.name}" guardado correctamente.`,
				});
			} else {
				const created = await createWorkflow(
					{ ...payload, status: "draft" },
					{ jwt: apiToken },
				);
				setWorkflowApiId(created.id);
				if (typeof window !== "undefined") {
					localStorage.setItem(WORKFLOW_API_ID_KEY, String(created.id));
				}
				toast.success("Workflow guardado", {
					description: `"${payload.name}" creado correctamente.`,
				});
				// Redirect to the per-workflow editor URL
				router.replace(`/editor/${created.id}`);
			}
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) {
				toast.error("No autorizado", {
					description: "Tu sesión expiró. Por favor inicia sesión nuevamente.",
				});
			} else if (error instanceof ApiError && error.status === 403) {
				toast.error("Acceso denegado", {
					description: "Solo los administradores pueden guardar workflows.",
				});
			} else if (error instanceof ApiError && error.status === 409) {
				toast.error("Nombre duplicado", {
					description: extractApiErrorMessage(error),
				});
			} else {
				toast.error("Error al guardar", {
					description: extractApiErrorMessage(error),
				});
			}
		}
	}, [apiToken, workflowApiId, workflowState, router]);

	const handleBack = useCallback(() => {
		router.push("/");
	}, [router]);

	const handleReset = useCallback(() => {
		// In multi-workflow mode (workflowId prop given), "New" navigates to /editor
		if (workflowId !== undefined) {
			router.push("/editor");
			return;
		}
		const confirmed = window.confirm(
			"¿Estás seguro de que deseas eliminar el flujo actual? Esta acción no se puede deshacer.",
		);
		if (confirmed) {
			setWorkflowState(createEmptyWorkflowState());
			setWorkflowApiId(null);
			setValidationErrors([]);
			setValidationStatus("idle");
			setLastValidationErrorCount(0);
			if (typeof window !== "undefined") {
				localStorage.removeItem(STORAGE_KEY);
				localStorage.removeItem(WORKFLOW_API_ID_KEY);
			}
		}
	}, [workflowId, router]);

	const handleLoadExample = useCallback(
		(exampleKey: "basic" | "api" | "manual") => {
			const example = EXAMPLE_WORKFLOWS[exampleKey];
			const nextNodes = example.nodes.map(withDefaultStaleTimeout);
			applyHistoryChange((prev) => ({
				nodes: nextNodes,
				edges: example.edges,
				selectedNodeIds: [],
				selectedEdgeIds: [],
			}));
			setValidationErrors([]);
			setValidationStatus("idle");
			setLastValidationErrorCount(0);
		},
		[applyHistoryChange],
	);

	const handleExportJSON = useCallback(() => {
		setJsonMode("export");
		setShowJSON(true);
	}, []);

	const handleImportJSON = useCallback(() => {
		setJsonMode("import");
		setShowJSON(true);
	}, []);

	const handlePublish = useCallback(() => {
		const isValid = handleValidate();
		if (isValid) {
			setShowPublish(true);
		}
	}, [handleValidate]);

	// Handle global keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Check if user is typing in an input/textarea
			const activeElement = document.activeElement;
			const isInputActive =
				activeElement &&
				(activeElement.tagName === "INPUT" ||
					activeElement.tagName === "TEXTAREA" ||
					activeElement.getAttribute("contenteditable") === "true");

			if (isInputActive) {
				return;
			}

			const toolbarAction = matchToolbarShortcut(e);
			if (toolbarAction) {
				e.preventDefault();
				if (toolbarAction === "publish") {
					handlePublish();
				} else if (toolbarAction === "export") {
					handleExportJSON();
				} else if (toolbarAction === "import") {
					handleImportJSON();
				} else if (toolbarAction === "flags") {
					setShowFlagManager(true);
				} else if (toolbarAction === "settings") {
					setShowWorkflowProperties((prev) => {
						const newValue = !prev;
						if (newValue) {
							updateWorkflow({ selectedNodeIds: [], selectedEdgeIds: [] });
						}
						return newValue;
					});
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handlePublish, handleExportJSON, handleImportJSON, updateWorkflow]);

	const updateMetadata = useCallback((updates: Partial<WorkflowMetadata>) => {
		setWorkflowState((prev) => ({
			...prev,
			metadata: {
				...prev.metadata,
				...updates,
				updatedAt: new Date().toISOString(),
			},
		}));
	}, []);

	const updateFlags = useCallback((flags: Flag[]) => {
		setWorkflowState((prev) => ({
			...prev,
			flags,
		}));
	}, []);

	const hasMultipleSelections =
		workflowState.selectedNodeIds.length +
			workflowState.selectedEdgeIds.length >
			1 ||
		(workflowState.selectedNodeIds.length > 0 &&
			workflowState.selectedEdgeIds.length > 0);

	const hasSingleNodeSelected = workflowState.selectedNodeIds.length === 1;
	const hasSingleEdgeSelected = workflowState.selectedEdgeIds.length === 1;
	const canUndo = canUndoHistory(workflowState.historyIndex);
	const canRedo = canRedoHistory(
		workflowState.history,
		workflowState.historyIndex,
	);
	const shouldShowWorkflowPanel =
		showWorkflowProperties &&
		workflowState.selectedNodeIds.length === 0 &&
		workflowState.selectedEdgeIds.length === 0;

	const shouldShowPropertiesOverlay =
		!hasMultipleSelections &&
		(shouldShowWorkflowPanel || hasSingleNodeSelected || hasSingleEdgeSelected);

	if (isLoadingFromApi) {
		return (
			<div className="flex h-screen items-center justify-center bg-background">
				<div className="flex flex-col items-center gap-3 text-muted-foreground">
					<Loader2 className="h-8 w-8 animate-spin" />
					<span className="text-sm">Cargando workflow...</span>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-screen flex-col bg-background">
			<TopBar
				onNew={handleReset}
				onSave={handleSave}
				onPublish={handlePublish}
				onExportJSON={handleExportJSON}
				onImportJSON={handleImportJSON}
				onLoadExample={handleLoadExample}
				onManageFlags={() => setShowFlagManager(true)}
				onToggleWorkflowProperties={() => {
					setShowWorkflowProperties((prev) => {
						const newValue = !prev;
						// Si se está abriendo el panel de propiedades del flujo, deseleccionar nodo/edge
						if (newValue) {
							updateWorkflow({ selectedNodeIds: [], selectedEdgeIds: [] });
						}
						return newValue;
					});
				}}
				workflowMetadata={workflowState.metadata}
				workflowStatus={workflowStatus}
				onBack={workflowId !== undefined ? handleBack : undefined}
				paletteProps={{
					onAddNode: addNode,
					zoom: workflowState.zoom,
					pan: workflowState.pan,
				}}
			/>

			<div className="flex flex-1 flex-col overflow-hidden">
				<div className="flex flex-1 overflow-hidden">
					<div className="relative flex-1">
						<Canvas
							nodes={workflowState.nodes}
							edges={workflowState.edges}
							selectedNodeIds={workflowState.selectedNodeIds}
							selectedEdgeIds={workflowState.selectedEdgeIds}
							zoom={workflowState.zoom}
							pan={workflowState.pan}
							flags={workflowState.flags}
							onUpdateNode={updateNode}
							onDeleteNode={deleteNode}
							onAddEdge={addEdge}
							onDeleteEdge={deleteEdge}
							onSelectNodes={(nodeIds) => {
								updateWorkflow({ selectedNodeIds: nodeIds });
								if (nodeIds.length > 0) {
									setShowWorkflowProperties(false);
								} else {
									// Si se deselecciona todo, cerrar también el panel de propiedades del flujo
									setShowWorkflowProperties(false);
								}
							}}
							onSelectEdges={(edgeIds) => {
								updateWorkflow({ selectedEdgeIds: edgeIds });
								if (edgeIds.length > 0) {
									setShowWorkflowProperties(false);
								} else {
									// Si se deselecciona todo, cerrar también el panel de propiedades del flujo
									setShowWorkflowProperties(false);
								}
							}}
							onUpdateZoom={(zoom) => updateWorkflow({ zoom })}
							onUpdatePan={(pan) => updateWorkflow({ pan })}
							validationErrors={validationErrors}
							onSave={handleSave}
							onReset={handleReset}
							onValidate={handleValidate}
							onPreview={() => setShowPreview(true)}
							onGenerateCode={() => setShowCode(true)}
							validationState={{
								status: validationStatus,
							}}
							onCopy={handleCopy}
							onPaste={handlePaste}
							onUndo={handleUndo}
							canUndo={canUndo}
							onRedo={handleRedo}
							canRedo={canRedo}
							onCommitHistory={commitHistorySnapshot}
						/>

						{validationErrors.length > 0 && (
							<ValidationTray
								errors={validationErrors}
								onClose={() => setValidationErrors([])}
								onSelectNode={(nodeId) =>
									updateWorkflow({ selectedNodeIds: nodeId ? [nodeId] : [] })
								}
							/>
						)}

						<div
							className={`absolute inset-y-0 left-0 z-30 flex w-80 transition-opacity duration-200 ${
								shouldShowPropertiesOverlay
									? "pointer-events-auto opacity-100"
									: "pointer-events-none opacity-0"
							}`}
						>
							<PropertiesPanel
								selectedNodes={
									workflowState.selectedNodeIds.length > 0
										? workflowState.selectedNodeIds
												.map((id) =>
													workflowState.nodes.find((n) => n.id === id),
												)
												.filter((n): n is WorkflowNode => n !== undefined)
										: []
								}
								selectedEdges={
									workflowState.selectedEdgeIds.length > 0
										? workflowState.selectedEdgeIds
												.map((id) =>
													workflowState.edges.find((e) => e.id === id),
												)
												.filter((e): e is WorkflowEdge => e !== undefined)
										: []
								}
								workflowMetadata={workflowState.metadata}
								nodes={workflowState.nodes}
								edges={workflowState.edges}
								flags={workflowState.flags}
								onUpdateNode={updateNode}
								onUpdateEdge={updateEdge}
								onUpdateMetadata={updateMetadata}
								onAddEdge={addEdge}
								onDeleteEdge={deleteEdge}
								showWorkflowProperties={showWorkflowProperties}
								onCloseWorkflowProperties={() =>
									setShowWorkflowProperties(false)
								}
								position="left"
							/>
						</div>
					</div>
				</div>
			</div>

			{showPreview && (
				<PreviewModal
					nodes={workflowState.nodes}
					edges={workflowState.edges}
					onClose={() => setShowPreview(false)}
				/>
			)}

			{showJSON && (
				<JSONModal
					mode={jsonMode}
					workflow={{ nodes: workflowState.nodes, edges: workflowState.edges }}
					onClose={() => setShowJSON(false)}
					onImport={(data) => {
						// Migrar nodos legacy antes de importar
						const migratedNodes = migrateLegacyNodes(data.nodes);
						applyHistoryChange((prev) => ({
							nodes: migratedNodes.map(withDefaultStaleTimeout),
							edges: data.edges,
							selectedNodeIds: [],
							selectedEdgeIds: [],
						}));
						setShowJSON(false);
						setValidationErrors([]);
						setValidationStatus("idle");
						setLastValidationErrorCount(0);
					}}
				/>
			)}

			{showFlagManager && (
				<FlagManagerModal
					flags={workflowState.flags}
					onClose={() => setShowFlagManager(false)}
					onUpdateFlags={updateFlags}
				/>
			)}

			{showCode && (
				<CodeModal
					nodes={workflowState.nodes}
					edges={workflowState.edges}
					metadata={workflowState.metadata}
					onClose={() => setShowCode(false)}
				/>
			)}

			{showPublish && (
				<PublishModal
					nodes={workflowState.nodes}
					edges={workflowState.edges}
					metadata={workflowState.metadata}
					flags={workflowState.flags}
					zoom={workflowState.zoom}
					pan={workflowState.pan}
					workflowApiId={workflowApiId}
					onSave={handleSave}
					apiToken={apiToken}
					onClose={() => setShowPublish(false)}
					onPublished={(status) => setWorkflowStatus(status)}
				/>
			)}

			<Toaster position="top-right" richColors />
		</div>
	);
}
