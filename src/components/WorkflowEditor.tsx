"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { TopBar } from "./workflow/top-bar";
import { Canvas, DEFAULT_START_NODE_PAN } from "./workflow/canvas";
import { PropertiesPanel } from "./workflow/properties-panel";
import { ValidationTray } from "./workflow/validation-tray";
import { PreviewModal } from "./workflow/preview-modal";
import { JSONModal } from "./workflow/json-modal";
import { FlagManagerModal } from "./workflow/flag-manager-modal";
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

const STORAGE_KEY = "cartera-workflow-state";

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

export function WorkflowEditor() {
	const [workflowState, setWorkflowState] = useState<WorkflowState>(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				try {
					const parsed = JSON.parse(saved);
					// Migrar nodos legacy (Status, Approve, ManualDecision)
					const migratedNodes = migrateLegacyNodes(parsed.nodes || []);
					// Migrate old single selection to new multi-selection arrays
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
					console.error("[v0] Error loading from localStorage:", e);
				}
			}
		}
		return createEmptyWorkflowState();
	});

	const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
		[],
	);
	const [showPreview, setShowPreview] = useState(false);
	const [showJSON, setShowJSON] = useState(false);
	const [jsonMode, setJsonMode] = useState<"export" | "import">("export");
	const [showFlagManager, setShowFlagManager] = useState(false);
	const [showWorkflowProperties, setShowWorkflowProperties] = useState(false);
	const [validationStatus, setValidationStatus] = useState<
		"idle" | "valid" | "invalid"
	>("idle");
	const [lastValidationErrorCount, setLastValidationErrorCount] = useState(0);
	const hasMountedRef = useRef(false);

	useEffect(() => {
		if (typeof window !== "undefined") {
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
	}, [
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

	const handleSave = useCallback(() => {
		console.warn("[v0] Guardando flujo:", workflowState);
		// Already saved to localStorage automatically
		alert("✅ Flujo guardado exitosamente");
	}, [workflowState]);

	const handleReset = useCallback(() => {
		const confirmed = window.confirm(
			"¿Estás seguro de que deseas eliminar el flujo actual? Esta acción no se puede deshacer.",
		);
		if (confirmed) {
			setWorkflowState(createEmptyWorkflowState());
			setValidationErrors([]);
			setValidationStatus("idle");
			setLastValidationErrorCount(0);
			if (typeof window !== "undefined") {
				localStorage.removeItem(STORAGE_KEY);
			}
		}
	}, []);

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
			alert("✅ Publicación exitosa (mock)");
		} else {
			alert(
				"❌ El flujo tiene errores. Por favor corrígelos antes de publicar.",
			);
		}
	}, [handleValidate]);

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
		</div>
	);
}
