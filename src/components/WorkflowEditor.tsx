"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { TopBar } from "./workflow/top-bar";
import { Palette } from "./workflow/palette";
import { Canvas } from "./workflow/canvas";
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
		position: { x: 200, y: 50 }, // Posición inicial para layout vertical
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
					return {
						...parsed,
						metadata: parsed.metadata || createDefaultMetadata(),
						nodes: migratedNodes.map(withDefaultStaleTimeout),
						flags: parsed.flags || [],
						selectedNodeIds,
						selectedEdgeIds,
					};
				} catch (e) {
					console.error("[v0] Error loading from localStorage:", e);
				}
			}
		}
		return {
			metadata: createDefaultMetadata(),
			nodes: [createInitialStartNode()],
			edges: [],
			flags: [],
			selectedNodeIds: [],
			selectedEdgeIds: [],
			zoom: 1,
			pan: { x: 200, y: 100 }, // Pan inicial para centrar el nodo Start
			history: [],
			historyIndex: -1,
		};
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

	const addNode = useCallback((node: WorkflowNode) => {
		setWorkflowState((prev) => ({
			...prev,
			nodes: [...prev.nodes, withDefaultStaleTimeout(node)],
		}));
	}, []);

	const updateNode = useCallback(
		(nodeId: string, updates: Partial<WorkflowNode>) => {
			setWorkflowState((prev) => ({
				...prev,
				nodes: prev.nodes.map((n) => {
					if (n.id !== nodeId) return n;
					const nextNode = { ...n, ...updates };
					return withDefaultStaleTimeout(nextNode);
				}),
			}));
		},
		[],
	);

	const deleteNode = useCallback((nodeId: string) => {
		setWorkflowState((prev) => ({
			...prev,
			nodes: prev.nodes.filter((n) => n.id !== nodeId),
			edges: prev.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
			selectedNodeIds: prev.selectedNodeIds.filter((id) => id !== nodeId),
		}));
	}, []);

	const addEdge = useCallback((edge: WorkflowEdge) => {
		setWorkflowState((prev) => ({
			...prev,
			edges: [...prev.edges, edge],
		}));
	}, []);

	const updateEdge = useCallback(
		(edgeId: string, updates: Partial<WorkflowEdge>) => {
			setWorkflowState((prev) => ({
				...prev,
				edges: prev.edges.map((e) =>
					e.id === edgeId ? { ...e, ...updates } : e,
				),
			}));
		},
		[],
	);

	const deleteEdge = useCallback((edgeId: string) => {
		setWorkflowState((prev) => ({
			...prev,
			edges: prev.edges.filter((e) => e.id !== edgeId),
			selectedEdgeIds: prev.selectedEdgeIds.filter((id) => id !== edgeId),
		}));
	}, []);

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
			setWorkflowState((prev) => {
				// Add pasted nodes with default stale timeout
				const newNodes = [
					...prev.nodes,
					...pastedNodes.map(withDefaultStaleTimeout),
				];

				// Add pasted edges
				const newEdges = [...prev.edges, ...pastedEdges];

				// Select the pasted elements
				const pastedNodeIds = pastedNodes.map((n) => n.id);
				const pastedEdgeIds = pastedEdges.map((e) => e.id);

				return {
					...prev,
					nodes: newNodes,
					edges: newEdges,
					selectedNodeIds: pastedNodeIds,
					selectedEdgeIds: pastedEdgeIds,
				};
			});
		},
		[],
	);

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
			const emptyState: WorkflowState = {
				metadata: createDefaultMetadata(),
				nodes: [createInitialStartNode()],
				edges: [],
				flags: [],
				selectedNodeIds: [],
				selectedEdgeIds: [],
				zoom: 1,
				pan: { x: 200, y: 100 }, // Pan inicial para centrar el nodo Start
				history: [],
				historyIndex: -1,
			};
			setWorkflowState(emptyState);
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
			setWorkflowState((prev) => ({
				...prev,
				nodes: example.nodes.map(withDefaultStaleTimeout),
				edges: example.edges,
				selectedNodeIds: [],
				selectedEdgeIds: [],
			}));
			setValidationErrors([]);
			setValidationStatus("idle");
			setLastValidationErrorCount(0);
		},
		[],
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
			/>

			<div className="flex flex-1 overflow-hidden">
				<Palette
					onAddNode={addNode}
					zoom={workflowState.zoom}
					pan={workflowState.pan}
					stats={{
						nodes: workflowState.nodes.length,
						edges: workflowState.edges.length,
					}}
					validationState={{
						status: validationStatus,
						errorsCount: lastValidationErrorCount,
					}}
				/>

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
				</div>

				<PropertiesPanel
					selectedNodes={
						workflowState.selectedNodeIds.length > 0
							? workflowState.selectedNodeIds
									.map((id) => workflowState.nodes.find((n) => n.id === id))
									.filter((n): n is WorkflowNode => n !== undefined)
							: []
					}
					selectedEdges={
						workflowState.selectedEdgeIds.length > 0
							? workflowState.selectedEdgeIds
									.map((id) => workflowState.edges.find((e) => e.id === id))
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
					onCloseWorkflowProperties={() => setShowWorkflowProperties(false)}
				/>
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
						setWorkflowState((prev) => ({
							...prev,
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
