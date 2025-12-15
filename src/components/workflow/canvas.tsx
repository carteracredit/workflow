"use client";

import type React from "react";

import { useRef, useState, useCallback, useEffect } from "react";
import type {
	WorkflowNode,
	WorkflowEdge,
	ValidationError,
	Flag,
	APIFailureHandling,
} from "@/lib/workflow/types";
import { NodeRenderer } from "./node-renderer";
import { EdgeRenderer } from "./edge-renderer";
import { Minimap } from "./minimap";
import { Button } from "@/components/ui/button";
import {
	ZoomIn,
	ZoomOut,
	Maximize,
	Save,
	Trash2,
	CheckCircle,
	Play,
	Hand,
	MousePointer2,
	Undo,
	Redo,
} from "lucide-react";
import { findNearestPreviousCheckpoint } from "@/lib/workflow/graph-utils";
import {
	canCreateConnection,
	canNodeHaveOutgoingConnections,
	getMaxOutgoingConnections,
	isRetryEdge,
} from "@/lib/workflow/connection-rules";
import { cn } from "@/lib/utils";

const MULTI_OUTPUT_NODE_TYPES: WorkflowNode["type"][] = [
	"Decision",
	"Challenge",
];

const getPortDescriptor = (
	nodeType: WorkflowNode["type"],
	port: "top" | "bottom",
): string => {
	if (nodeType === "Challenge") {
		return port === "top" ? "accepted" : "rejected";
	}
	return port === "top" ? "verde (positiva)" : "roja (negativa)";
};

interface CanvasProps {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	selectedNodeId: string | null;
	selectedEdgeId: string | null;
	zoom: number;
	pan: { x: number; y: number };
	flags?: Flag[];
	onUpdateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
	onDeleteNode: (nodeId: string) => void;
	onAddEdge: (edge: WorkflowEdge) => void;
	onDeleteEdge: (edgeId: string) => void;
	onSelectNode: (nodeId: string | null) => void;
	onSelectEdge: (edgeId: string | null) => void;
	onUpdateZoom: (zoom: number) => void;
	onUpdatePan: (pan: { x: number; y: number }) => void;
	validationErrors: ValidationError[];
	onSave?: () => void;
	onReset?: () => void;
	onValidate?: () => void;
	onPreview?: () => void;
	validationState?: {
		status: "idle" | "valid" | "invalid";
	};
}

export function Canvas({
	nodes,
	edges,
	selectedNodeId,
	selectedEdgeId,
	zoom,
	pan,
	flags = [],
	onUpdateNode,
	onDeleteNode,
	onAddEdge,
	onDeleteEdge,
	onSelectNode,
	onSelectEdge,
	onUpdateZoom,
	onUpdatePan,
	validationErrors,
	onSave,
	onReset,
	onValidate,
	onPreview,
	validationState,
}: CanvasProps) {
	const canvasRef = useRef<HTMLDivElement>(null);
	const [isPanning, setIsPanning] = useState(false);
	const [panStart, setPanStart] = useState({ x: 0, y: 0 });
	const [isSpacePressed, setIsSpacePressed] = useState(false);
	const [isPanModeLocked, setIsPanModeLocked] = useState(false);
	const lastAutoScrolledNodeId = useRef<string | null>(null);

	const dragRef = useRef<{
		nodeId: string;
		offsetX: number;
		offsetY: number;
	} | null>(null);

	const [connectingFrom, setConnectingFrom] = useState<{
		nodeId: string;
		x: number;
		y: number;
		port?: "top" | "bottom";
	} | null>(null);
	const [tempEdgeTo, setTempEdgeTo] = useState<{ x: number; y: number } | null>(
		null,
	);

	// Función auxiliar para calcular tamaño de nodo (debe coincidir con node-renderer)
	const calculateNodeSize = useCallback((node: WorkflowNode) => {
		const MIN_NODE_WIDTH = 180; // Reducido para permitir nodos más estrechos
		const MAX_NODE_WIDTH = 320;
		const MIN_NODE_HEIGHT = 60;
		const PADDING_X = 16; // Restaurado
		const ICON_CONTAINER_SIZE = 40;

		const titleWidth = node.title.length * 9;
		const descWidth = node.description ? node.description.length * 7.5 : 0;

		// Para el cálculo en canvas, usamos una aproximación más simple
		// El cálculo real se hace en node-renderer con acceso a flags
		let flagsMaxWidth = 0;
		if (node.type === "FlagChange" && node.config.flagChanges) {
			const flagChanges = node.config.flagChanges as Array<{
				flagId: string;
				optionId: string;
			}>;
			// Aproximación: calcular ancho basado en texto promedio
			flagChanges.forEach(() => {
				// Aproximación conservadora: ~150px por badge en promedio
				flagsMaxWidth = Math.max(flagsMaxWidth, 150);
			});
		}

		const contentWidth =
			Math.max(titleWidth, descWidth, flagsMaxWidth) +
			ICON_CONTAINER_SIZE +
			12 +
			PADDING_X * 2;
		const NODE_WIDTH = Math.max(
			MIN_NODE_WIDTH,
			Math.min(MAX_NODE_WIDTH, contentWidth),
		);

		const hasDescription = !!node.description;
		const hasRoles = node.roles.length > 0;
		const flagChangesCount =
			node.type === "FlagChange" && node.config.flagChanges
				? (
						node.config.flagChanges as Array<{
							flagId: string;
							optionId: string;
						}>
					).length
				: 0;
		const hasSpecialBadges =
			(node.type === "Reject" &&
				(node.config.allowRetry as boolean) === true) ||
			flagChangesCount > 0 ||
			(node.type === "API" && node.config.failureHandling) ||
			node.type === "Challenge";

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

		return { width: NODE_WIDTH, height: estimatedHeight };
	}, []);

	const handleFitToView = useCallback(() => {
		if (nodes.length === 0) return;

		const minX = Math.min(...nodes.map((n) => n.position.x));
		const maxX = Math.max(
			...nodes.map((n) => {
				const size = calculateNodeSize(n);
				return n.position.x + size.width;
			}),
		);
		const minY = Math.min(...nodes.map((n) => n.position.y));
		const maxY = Math.max(
			...nodes.map((n) => {
				const size = calculateNodeSize(n);
				return n.position.y + size.height;
			}),
		);

		const width = maxX - minX;
		const height = maxY - minY;

		const canvasWidth = canvasRef.current?.clientWidth || 800;
		const canvasHeight = canvasRef.current?.clientHeight || 600;

		const scaleX = canvasWidth / width;
		const scaleY = canvasHeight / height;
		const newZoom = Math.min(scaleX, scaleY, 1) * 0.9;

		onUpdateZoom(newZoom);
		onUpdatePan({
			x: (canvasWidth - width * newZoom) / 2 - minX * newZoom,
			y: (canvasHeight - height * newZoom) / 2 - minY * newZoom,
		});
	}, [nodes, onUpdateZoom, onUpdatePan, calculateNodeSize]);

	// Auto-scroll al seleccionar un nodo si está fuera de la vista
	useEffect(() => {
		// Solo ejecutar si cambió el nodo seleccionado (no por cambios en pan/zoom)
		if (
			!selectedNodeId ||
			selectedNodeId === lastAutoScrolledNodeId.current ||
			!canvasRef.current
		) {
			return;
		}

		const selectedNode = nodes.find((n) => n.id === selectedNodeId);
		if (!selectedNode) return;

		// Marcar que ya procesamos este nodo
		lastAutoScrolledNodeId.current = selectedNodeId;

		// Calcular tamaño dinámico del nodo usando la función auxiliar
		const nodeSize = calculateNodeSize(selectedNode);
		const NODE_WIDTH = nodeSize.width;
		const NODE_HEIGHT = nodeSize.height;

		const canvasRect = canvasRef.current.getBoundingClientRect();
		const canvasWidth = canvasRect.width;
		const canvasHeight = canvasRect.height;

		// Calcular la posición del nodo en el espacio del canvas transformado
		const nodeScreenX = selectedNode.position.x * zoom + pan.x;
		const nodeScreenY = selectedNode.position.y * zoom + pan.y;
		const nodeScreenWidth = NODE_WIDTH * zoom;
		const nodeScreenHeight = NODE_HEIGHT * zoom;

		// Calcular los bordes del nodo en coordenadas de pantalla
		const nodeLeft = nodeScreenX;
		const nodeRight = nodeScreenX + nodeScreenWidth;
		const nodeTop = nodeScreenY;
		const nodeBottom = nodeScreenY + nodeScreenHeight;

		// Margen de padding para no pegar el nodo al borde
		const padding = 50;
		let newPanX = pan.x;
		let newPanY = pan.y;
		let needsUpdate = false;

		// Verificar si el nodo está fuera de la vista horizontalmente
		// Solo ajustar lo mínimo necesario para que sea visible
		if (nodeLeft < padding) {
			// El nodo está muy a la izquierda, ajustar solo lo necesario
			newPanX = pan.x + (padding - nodeLeft);
			needsUpdate = true;
		} else if (nodeRight > canvasWidth - padding) {
			// El nodo está muy a la derecha, ajustar solo lo necesario
			newPanX = pan.x - (nodeRight - (canvasWidth - padding));
			needsUpdate = true;
		}

		// Verificar si el nodo está fuera de la vista verticalmente
		// Solo ajustar lo mínimo necesario para que sea visible
		if (nodeTop < padding) {
			// El nodo está muy arriba, ajustar solo lo necesario
			newPanY = pan.y + (padding - nodeTop);
			needsUpdate = true;
		} else if (nodeBottom > canvasHeight - padding) {
			// El nodo está muy abajo, ajustar solo lo necesario
			newPanY = pan.y - (nodeBottom - (canvasHeight - padding));
			needsUpdate = true;
		}

		if (needsUpdate) {
			onUpdatePan({ x: newPanX, y: newPanY });
		}
	}, [selectedNodeId, nodes, zoom, pan, onUpdatePan, calculateNodeSize]);

	// Resetear el ref cuando se deselecciona
	useEffect(() => {
		if (!selectedNodeId) {
			lastAutoScrolledNodeId.current = null;
		}
	}, [selectedNodeId]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const handleWheel = (e: WheelEvent) => {
			if (e.ctrlKey || e.metaKey || e.shiftKey) {
				e.preventDefault();
			}

			const rect = canvas.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;

			// Shift + rueda del mouse: desplazamiento horizontal
			if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
				// Usar deltaX si está disponible (algunos navegadores lo proporcionan con Shift),
				// de lo contrario usar deltaY como fallback
				const horizontalDelta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
				onUpdatePan({ x: pan.x - horizontalDelta, y: pan.y });
			} else if (e.ctrlKey || e.metaKey) {
				// Ctrl/Meta + rueda del mouse: zoom
				const delta = e.deltaY > 0 ? -0.1 : 0.1;
				const newZoom = Math.max(0.1, Math.min(2, zoom + delta));

				const zoomPointX = (mouseX - pan.x) / zoom;
				const zoomPointY = (mouseY - pan.y) / zoom;

				const newPanX = mouseX - zoomPointX * newZoom;
				const newPanY = mouseY - zoomPointY * newZoom;

				onUpdateZoom(newZoom);
				onUpdatePan({ x: newPanX, y: newPanY });
			} else {
				// Rueda del mouse sola: desplazamiento vertical
				onUpdatePan({ x: pan.x, y: pan.y - e.deltaY });
			}
		};

		canvas.addEventListener("wheel", handleWheel, { passive: false });

		return () => {
			canvas.removeEventListener("wheel", handleWheel);
		};
	}, [zoom, pan, onUpdateZoom, onUpdatePan]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.code === "Space" && !isSpacePressed) {
				setIsSpacePressed(true);
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.code === "Space") {
				setIsSpacePressed(false);
				setIsPanning(false);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, [isSpacePressed]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Delete" && selectedNodeId) {
				const node = nodes.find((n) => n.id === selectedNodeId);
				if (node?.type === "Start") {
					console.warn("[v0] Cannot delete Start node - it is required");
					return;
				}
				onDeleteNode(selectedNodeId);
			}
			if (e.key === "Delete" && selectedEdgeId) {
				onDeleteEdge(selectedEdgeId);
			}
			if (e.key === "1") {
				onUpdateZoom(Math.max(0.1, zoom - 0.1));
			}
			if (e.key === "2") {
				onUpdateZoom(Math.min(2, zoom + 0.1));
			}
			if (e.key === "f" || e.key === "F") {
				handleFitToView();
			}
			if ((e.ctrlKey || e.metaKey) && e.key === "s") {
				e.preventDefault();
			}
			if (e.key === "Escape" && connectingFrom) {
				setConnectingFrom(null);
				setTempEdgeTo(null);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		selectedNodeId,
		selectedEdgeId,
		connectingFrom,
		zoom,
		onDeleteNode,
		onDeleteEdge,
		onUpdateZoom,
		handleFitToView,
		nodes,
	]);

	const startPanning = useCallback(
		(clientX: number, clientY: number) => {
			setIsPanning(true);
			setPanStart({ x: clientX - pan.x, y: clientY - pan.y });
		},
		[pan.x, pan.y],
	);

	const activateSelectionMode = useCallback(() => {
		setIsPanModeLocked(false);
		setIsPanning(false);
	}, []);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			const target = e.target as HTMLElement;

			// Verificar si el clic es en un nodo o edge
			const isNode = target.closest(".workflow-node");
			const isEdge =
				target.closest(".workflow-edge") ||
				(target.tagName === "path" && target.getAttribute("stroke") !== null);
			const isConnector =
				target.classList.contains("workflow-connector") ||
				target.closest(".workflow-connector");

			// Es fondo del canvas si NO es un nodo, edge o conector
			const isCanvasBackground =
				!isNode &&
				!isEdge &&
				!isConnector &&
				(target === e.currentTarget ||
					target.classList.contains("canvas-grid") ||
					target.tagName === "svg" ||
					target.classList.contains("canvas-svg-background") ||
					(target.tagName === "g" &&
						!target.classList.contains("workflow-edge"))); // Grupos SVG vacíos

			if (isCanvasBackground) {
				onSelectNode(null);
				onSelectEdge(null);
			}

			// Activar panning si:
			// 1. Botón del medio del mouse
			// 2. Space + clic izquierdo (temporal, override del modo actual)
			// 3. Clic izquierdo en el fondo del canvas solo si pan mode está bloqueado (manita activa)
			const shouldPanWithLeftButton =
				e.button === 0 && (isSpacePressed || isPanModeLocked);
			const shouldPanByBackgroundClick =
				e.button === 0 &&
				isCanvasBackground &&
				target === e.currentTarget &&
				isPanModeLocked &&
				!isSpacePressed; // No panear si space está presionado (se maneja arriba)

			if (
				e.button === 1 ||
				shouldPanWithLeftButton ||
				shouldPanByBackgroundClick
			) {
				e.preventDefault();
				startPanning(e.clientX, e.clientY);
			}
		},
		[onSelectNode, onSelectEdge, isSpacePressed, isPanModeLocked, startPanning],
	);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (isPanning) {
				onUpdatePan({
					x: e.clientX - panStart.x,
					y: e.clientY - panStart.y,
				});
				return;
			}

			if (dragRef.current) {
				const rect = canvasRef.current?.getBoundingClientRect();
				if (!rect) return;

				const cursorX = (e.clientX - rect.left - pan.x) / zoom;
				const cursorY = (e.clientY - rect.top - pan.y) / zoom;

				const newX = cursorX - dragRef.current.offsetX;
				const newY = cursorY - dragRef.current.offsetY;

				onUpdateNode(dragRef.current.nodeId, {
					position: { x: newX, y: newY },
				});
			}

			if (connectingFrom) {
				const rect = canvasRef.current?.getBoundingClientRect();
				if (rect) {
					setTempEdgeTo({
						x: (e.clientX - rect.left - pan.x) / zoom,
						y: (e.clientY - rect.top - pan.y) / zoom,
					});
				}
			}
		},
		[isPanning, panStart, zoom, pan, connectingFrom, onUpdatePan, onUpdateNode],
	);

	const handleMouseUp = useCallback(() => {
		setIsPanning(false);
		dragRef.current = null;
	}, []);

	const handleNodeMouseDown = useCallback(
		(nodeId: string, e: React.MouseEvent) => {
			e.stopPropagation();

			const rect = canvasRef.current?.getBoundingClientRect();
			if (!rect) return;

			if (isSpacePressed || isPanModeLocked) {
				startPanning(e.clientX, e.clientY);
				return;
			}

			const node = nodes.find((n) => n.id === nodeId);
			if (!node) return;

			const cursorX = (e.clientX - rect.left - pan.x) / zoom;
			const cursorY = (e.clientY - rect.top - pan.y) / zoom;

			dragRef.current = {
				nodeId,
				offsetX: cursorX - node.position.x,
				offsetY: cursorY - node.position.y,
			};

			onSelectNode(nodeId);
		},
		[
			onSelectNode,
			nodes,
			zoom,
			pan,
			isSpacePressed,
			isPanModeLocked,
			startPanning,
		],
	);

	const handleConnectorClick = useCallback(
		(
			nodeId: string,
			position: { x: number; y: number },
			e: React.MouseEvent,
			port?: "top" | "bottom" | "middle",
		) => {
			e.stopPropagation();

			if (!connectingFrom) {
				const sourceNode = nodes.find((n) => n.id === nodeId);

				if (!sourceNode) {
					return;
				}

				// Validar si el nodo puede tener conexiones de salida
				if (!canNodeHaveOutgoingConnections(sourceNode)) {
					if (sourceNode.type === "Reject") {
						alert(
							"Las conexiones desde nodos Reject con reintentos habilitados se crean automáticamente. Use el panel de propiedades para configurar los reintentos.",
						);
					} else if (sourceNode.type === "API") {
						alert(
							'Los nodos API con "Detener Workflow" no pueden tener conexiones salientes. El workflow terminará aquí en caso de fallo.',
						);
					}
					return;
				}

				// 'middle' port is only for input connectors, ignore it for output connections
				const outputPort = port === "middle" ? undefined : port;

				// Para nodos Decision, validar por puerto (cada puerto solo puede tener 1 conexión)
				const isMultiOutputSource = MULTI_OUTPUT_NODE_TYPES.includes(
					sourceNode.type,
				);
				if (isMultiOutputSource && outputPort) {
					// Verificar si ya existe una conexión en este puerto específico
					const existingConnectionOnPort = edges.find(
						(e) => e.from === sourceNode.id && e.fromPort === outputPort,
					);
					if (existingConnectionOnPort) {
						const portName = getPortDescriptor(sourceNode.type, outputPort);
						alert(
							`El nodo "${sourceNode.title}" ya tiene una conexión en el conector ${portName}. Cada conector solo puede tener una conexión.`,
						);
						return;
					}
				}

				// Validar límite total de conexiones de salida del nodo origen
				const maxOutgoing = getMaxOutgoingConnections(sourceNode.type);
				const currentOutgoing = edges.filter(
					(e) => e.from === sourceNode.id,
				).length;
				if (currentOutgoing >= maxOutgoing) {
					const nodeTypeName =
						sourceNode.type === "Decision"
							? "decisión"
							: sourceNode.type === "Challenge"
								? "challenge"
								: sourceNode.type === "Join"
									? "unión"
									: "normal";
					alert(
						`El nodo "${sourceNode.title}" (${nodeTypeName}) ya tiene el máximo de conexiones de salida permitidas (${maxOutgoing}).`,
					);
					return;
				}
				console.warn(
					"[v0] Starting connection from node:",
					nodeId,
					"port:",
					outputPort,
				);
				setConnectingFrom({
					nodeId,
					x: position.x,
					y: position.y,
					port: outputPort,
				});
				setTempEdgeTo(null);
			} else if (connectingFrom.nodeId !== nodeId) {
				// Validar conexión desde Reject con allowRetry
				const sourceNode = nodes.find((n) => n.id === connectingFrom.nodeId);
				if (sourceNode?.type === "Reject") {
					const allowRetry = (sourceNode.config.allowRetry as boolean) === true;
					if (allowRetry) {
						const checkpointId = findNearestPreviousCheckpoint(
							connectingFrom.nodeId,
							nodes,
							edges,
						);
						const targetNode = nodes.find((n) => n.id === nodeId);

						if (
							!checkpointId ||
							targetNode?.id !== checkpointId ||
							targetNode?.type !== "Checkpoint"
						) {
							alert(
								"Los nodos Reject con reintentos habilitados solo pueden conectarse al checkpoint anterior más próximo. Use el panel de propiedades para configurar los reintentos.",
							);
							setConnectingFrom(null);
							setTempEdgeTo(null);
							return;
						}
					}
				}

				const targetNode = nodes.find((n) => n.id === nodeId);
				const isJoinNode = targetNode?.type === "Join";

				// Validar límites de conexiones según reglas de negocio
				if (sourceNode && targetNode) {
					const connectionCheck = canCreateConnection(
						sourceNode,
						targetNode,
						edges,
						connectingFrom.port,
					);
					if (!connectionCheck.allowed) {
						alert(connectionCheck.reason || "No se puede crear esta conexión.");
						setConnectingFrom(null);
						setTempEdgeTo(null);
						return;
					}
				}

				// Solo eliminar conexiones entrantes existentes si NO es un nodo Join o Checkpoint
				// Los nodos Join pueden tener múltiples conexiones entrantes
				// Los checkpoints permiten 1 conexión normal + conexiones de reintento (amarillas)
				// Las conexiones de reintento NO deben eliminarse cuando se agrega una conexión normal
				const isCheckpointNode = targetNode?.type === "Checkpoint";
				if (!isJoinNode && !isCheckpointNode) {
					// Para nodos normales: eliminar todas las conexiones entrantes existentes
					const existingIncomingEdges = edges.filter(
						(edge) => edge.to === nodeId,
					);
					existingIncomingEdges.forEach((edge) => {
						console.warn("[v0] Removing existing incoming edge:", edge.id);
						onDeleteEdge(edge.id);
					});
				} else if (isCheckpointNode) {
					// Para checkpoints: solo eliminar conexiones normales (no las de reintento)
					const existingIncomingEdges = edges.filter(
						(edge) => edge.to === nodeId,
					);
					existingIncomingEdges.forEach((edge) => {
						// Solo eliminar si NO es una conexión de reintento
						if (!isRetryEdge(edge)) {
							console.warn(
								"[v0] Removing existing normal incoming edge:",
								edge.id,
							);
							onDeleteEdge(edge.id);
						} else {
							console.warn("[v0] Preserving retry edge:", edge.id);
						}
					});
				}

				// Para nodos Join, no necesitamos toPort ya que solo hay un conector
				// El edge-renderer se encargará de distribuir visualmente las conexiones
				const toPort: "top" | "middle" | "bottom" | undefined = undefined;

				const newEdge: WorkflowEdge = {
					id: `edge-${Date.now()}`,
					from: connectingFrom.nodeId,
					to: nodeId,
					label: null,
					fromPort: connectingFrom.port,
					toPort: toPort,
				};
				console.warn("[v0] Creating new edge:", newEdge);
				onAddEdge(newEdge);
				setConnectingFrom(null);
				setTempEdgeTo(null);
			} else {
				console.warn("[v0] Canceling connection (same node)");
				setConnectingFrom(null);
				setTempEdgeTo(null);
			}
		},
		[connectingFrom, edges, nodes, onAddEdge, onDeleteEdge],
	);

	const isHandToolActive = isPanning || isSpacePressed || isPanModeLocked;

	const showEmptyState = nodes.length <= 1 && edges.length === 0;

	return (
		<div className="relative h-full w-full select-none overflow-hidden">
			{/* Toolbar superior */}
			{(onSave || onReset || onValidate || onPreview) && (
				<div className="absolute top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border/50 bg-card/95 px-3 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/90">
					{onSave && (
						<Button variant="ghost" size="sm" onClick={onSave} title="Guardar">
							<Save className="h-4 w-4" />
						</Button>
					)}
					{onReset && (
						<Button
							variant="ghost"
							size="sm"
							onClick={onReset}
							title="Reiniciar"
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					)}
					{onValidate && (
						<Button
							variant={
								validationState?.status === "invalid" ? "destructive" : "ghost"
							}
							size="sm"
							onClick={onValidate}
							title="Validar"
						>
							<CheckCircle className="h-4 w-4" />
						</Button>
					)}
					{onPreview && (
						<Button
							variant="ghost"
							size="sm"
							onClick={onPreview}
							title="Preview"
						>
							<Play className="h-4 w-4" />
						</Button>
					)}
				</div>
			)}

			<div
				ref={canvasRef}
				className="canvas-grid h-full w-full"
				style={{
					cursor: isPanning
						? "grabbing"
						: isSpacePressed || isPanModeLocked
							? "grab"
							: "default",
				}}
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseUp}
			>
				<svg
					className="canvas-svg-background absolute inset-0 h-full w-full"
					style={{
						transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
						transformOrigin: "0 0",
						overflow: "visible",
						pointerEvents: "none",
					}}
				>
					{edges.map((edge) => (
						<EdgeRenderer
							key={edge.id}
							edge={edge}
							nodes={nodes}
							edges={edges}
							selected={edge.id === selectedEdgeId}
							onSelect={(e) => {
								e.stopPropagation();
								console.warn("[v0] Edge selected:", edge.id);
								onSelectNode(null);
								onSelectEdge(edge.id);
							}}
							onDelete={() => {
								console.warn("[v0] Edge deleted:", edge.id);
								onDeleteEdge(edge.id);
							}}
						/>
					))}

					{connectingFrom && tempEdgeTo && (
						<g className="workflow-edge">
							<path
								d={`M ${connectingFrom.x} ${connectingFrom.y} C ${connectingFrom.x} ${connectingFrom.y + 100}, ${tempEdgeTo.x} ${tempEdgeTo.y - 100}, ${tempEdgeTo.x} ${tempEdgeTo.y}`}
								stroke="var(--primary)"
								strokeWidth={2}
								fill="none"
								strokeDasharray="5,5"
								opacity={0.6}
								className="pointer-events-none"
							/>
						</g>
					)}
				</svg>

				<div
					className="absolute inset-0"
					style={{
						transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
						transformOrigin: "0 0",
						pointerEvents: "none",
					}}
				>
					{nodes.map((node) => {
						const nodeErrors = validationErrors.filter(
							(e) => e.nodeId === node.id,
						);

						// Detectar si este checkpoint está siendo referenciado por un nodo API SELECCIONADO
						const isReferencedCheckpoint =
							node.type === "Checkpoint" &&
							selectedNodeId !== null &&
							nodes.some(
								(n) =>
									n.id === selectedNodeId &&
									n.type === "API" &&
									(
										n.config.failureHandling as
											| (APIFailureHandling & { checkpointId?: string })
											| undefined
									)?.onFailure === "return-to-checkpoint" &&
									(
										n.config.failureHandling as
											| (APIFailureHandling & { checkpointId?: string })
											| undefined
									)?.checkpointId === node.id,
							);

						return (
							<NodeRenderer
								key={node.id}
								node={node}
								selected={node.id === selectedNodeId}
								errors={nodeErrors}
								connecting={connectingFrom?.nodeId === node.id}
								highlightCheckpoint={isReferencedCheckpoint}
								flags={flags}
								onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
								onConnectorClick={(position, e, port) =>
									handleConnectorClick(node.id, position, e, port)
								}
							/>
						);
					})}
				</div>

				{showEmptyState && (
					<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
						<div className="pointer-events-auto max-w-md rounded-2xl border border-dashed border-border/70 bg-background/95 p-6 text-center shadow-2xl">
							<p className="text-sm font-semibold text-foreground">
								Construye tu primer flujo
							</p>
							<p className="mt-2 text-sm text-muted-foreground">
								Usa el panel izquierdo para agregar nodos o haz clic derecho en
								el lienzo para comenzar. Puedes arrastrar elementos para
								reorganizarlos libremente.
							</p>
							<div className="mt-4 grid grid-cols-2 gap-3 text-left text-xs text-muted-foreground">
								<div className="rounded-md bg-muted/60 p-2">
									<p className="font-semibold text-foreground">
										Arrastrar lienzo
									</p>
									<p className="mt-1">
										Mantén presionada la barra espaciadora y arrastra.
									</p>
								</div>
								<div className="rounded-md bg-muted/60 p-2">
									<p className="font-semibold text-foreground">Zoom preciso</p>
									<p className="mt-1">Ctrl/⌘ + scroll para acercar o alejar.</p>
								</div>
								<div className="rounded-md bg-muted/60 p-2">
									<p className="font-semibold text-foreground">Atajos útiles</p>
									<p className="mt-1">
										1 / 2 ajustan zoom · F centra el flujo.
									</p>
								</div>
								<div className="rounded-md bg-muted/60 p-2">
									<p className="font-semibold text-foreground">Conexiones</p>
									<p className="mt-1">
										Haz clic en los conectores para unir nodos.
									</p>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Minimap - esquina inferior izquierda */}
			<div className="absolute bottom-4 left-4">
				<Minimap
					nodes={nodes}
					edges={edges}
					zoom={zoom}
					pan={pan}
					onUpdatePan={onUpdatePan}
				/>
			</div>

			{/* Controles inferiores centrales */}
			<div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3">
				{/* Indicador de zoom */}
				<div className="rounded bg-card/90 px-3 py-1 text-sm text-muted-foreground shadow-lg">
					{Math.round(zoom * 100)}%
				</div>

				{/* Herramientas y controles */}
				<div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/95 px-2 py-1.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/90">
					{/* Herramientas */}
					<Button
						size="icon"
						variant="ghost"
						className={cn(
							"h-8 w-8 transition-colors",
							isHandToolActive &&
								"border border-primary/30 bg-primary/10 text-primary shadow-inner ring-1 ring-primary/30",
						)}
						title="Herramienta de pan (mano)"
						aria-label="Herramienta de pan (mano)"
						aria-pressed={isHandToolActive}
						data-state={isHandToolActive ? "active" : "inactive"}
						onClick={() =>
							setIsPanModeLocked((prev) => {
								const next = !prev;
								if (!next) {
									setIsPanning(false);
								}
								return next;
							})
						}
					>
						<Hand
							className={cn("h-4 w-4", isHandToolActive && "text-primary")}
						/>
					</Button>
					<Button
						size="icon"
						variant="ghost"
						className={cn(
							"h-8 w-8 transition-colors",
							!isHandToolActive &&
								"border border-primary/30 bg-primary/10 text-primary shadow-inner ring-1 ring-primary/30",
						)}
						title="Herramienta de selección (puntero)"
						aria-label="Herramienta de selección (puntero)"
						aria-pressed={!isHandToolActive}
						data-state={!isHandToolActive ? "active" : "inactive"}
						onClick={activateSelectionMode}
					>
						<MousePointer2
							className={cn("h-4 w-4", !isHandToolActive && "text-primary")}
						/>
					</Button>
					<div className="mx-1 h-6 w-px bg-border" />
					<Button
						size="icon"
						variant="ghost"
						className="h-8 w-8"
						title="Deshacer (Ctrl+Z)"
						disabled
					>
						<Undo className="h-4 w-4" />
					</Button>
					<Button
						size="icon"
						variant="ghost"
						className="h-8 w-8"
						title="Rehacer (Ctrl+Y)"
						disabled
					>
						<Redo className="h-4 w-4" />
					</Button>
					<div className="mx-1 h-6 w-px bg-border" />
					{/* Controles de zoom */}
					<Button
						size="icon"
						variant="ghost"
						className="h-8 w-8"
						onClick={() => onUpdateZoom(Math.min(2, zoom + 0.1))}
						title="Acercar"
					>
						<ZoomIn className="h-4 w-4" />
					</Button>
					<Button
						size="icon"
						variant="ghost"
						className="h-8 w-8"
						onClick={() => onUpdateZoom(Math.max(0.1, zoom - 0.1))}
						title="Alejar"
					>
						<ZoomOut className="h-4 w-4" />
					</Button>
					<Button
						size="icon"
						variant="ghost"
						className="h-8 w-8"
						onClick={handleFitToView}
						title="Ajustar a vista (F)"
					>
						<Maximize className="h-4 w-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}
