"use client";

import type React from "react";

import type { WorkflowNode, WorkflowEdge } from "@/lib/workflow/types";
import { Trash2 } from "lucide-react";
import { estimateNodeDimensions } from "./node-metrics";

const ARROW_MARKER_WIDTH = 12;
const ARROW_MARKER_HEIGHT = 8;
const ARROW_MARKER_REF_Y = ARROW_MARKER_HEIGHT / 2;
const LINE_END_PADDING = 12;

interface EdgeRendererProps {
	edge: WorkflowEdge;
	nodes: WorkflowNode[];
	edges: WorkflowEdge[]; // All edges to calculate connection positions
	selected: boolean;
	onSelect: (e: React.MouseEvent) => void;
	onDelete: () => void;
	measuredNodeHeights?: Record<string, number>;
	dragState?: {
		nodeId: string;
		offsetX: number;
		offsetY: number;
	} | null;
}

export function EdgeRenderer({
	edge,
	nodes,
	edges,
	selected,
	onSelect,
	onDelete,
	measuredNodeHeights = {},
	dragState,
}: EdgeRendererProps) {
	const fromNode = nodes.find((n) => n.id === edge.from);
	const toNode = nodes.find((n) => n.id === edge.to);

	if (!fromNode || !toNode) return null;

	const fromNodeDragOffset =
		dragState?.nodeId === fromNode.id
			? { x: dragState.offsetX, y: dragState.offsetY }
			: { x: 0, y: 0 };

	const toNodeDragOffset =
		dragState?.nodeId === toNode.id
			? { x: dragState.offsetX, y: dragState.offsetY }
			: { x: 0, y: 0 };

	const fromNodeX = fromNode.position.x + fromNodeDragOffset.x;
	const fromNodeY = fromNode.position.y + fromNodeDragOffset.y;
	const toNodeX = toNode.position.x + toNodeDragOffset.x;
	const toNodeY = toNode.position.y + toNodeDragOffset.y;

	// Calcular tamaños para los nodos usando alturas reales medidas cuando estén disponibles
	const calculateNodeSize = (node: WorkflowNode) => {
		const estimated = estimateNodeDimensions(node);
		const realHeight = measuredNodeHeights[node.id];
		return {
			width: estimated.width,
			height: realHeight ?? estimated.height,
		};
	};

	const isExternalLinkChallengeSource =
		fromNode.type === "ExternalLink" &&
		(fromNode.config as { mode?: string }).mode === "challenge";
	const hasDualOutputs =
		fromNode.type === "Decision" ||
		fromNode.type === "Challenge" ||
		isExternalLinkChallengeSource;
	const isChallengeSource =
		fromNode.type === "Challenge" || isExternalLinkChallengeSource;

	const hasMultipleInputs = toNode.type === "Join";

	// Posiciones de inicio desde el costado derecho del nodo origen (layout horizontal)
	let startX: number;
	let startY: number;

	const fromNodeActualSize = calculateNodeSize(fromNode);

	if (hasDualOutputs && edge.fromPort) {
		const positiveRatio = isChallengeSource ? 0.35 : 0.33;
		const negativeRatio = isChallengeSource ? 0.65 : 0.67;
		startX = fromNodeX + fromNodeActualSize.width;
		startY =
			edge.fromPort === "top"
				? fromNodeY + fromNodeActualSize.height * positiveRatio
				: fromNodeY + fromNodeActualSize.height * negativeRatio;
	} else {
		// Nodo normal: conector centrado en el costado derecho
		startX = fromNodeX + fromNodeActualSize.width;
		startY = fromNodeY + fromNodeActualSize.height / 2;
	}

	// Posiciones de fin hacia el costado izquierdo del nodo destino (layout horizontal)
	let endX: number;
	let endY: number;

	const toNodeActualSize = calculateNodeSize(toNode);

	if (hasMultipleInputs) {
		// For Join nodes, distribute connections visually along the top edge
		// Find all edges going to this node and calculate position based on index
		const allEdgesToNode = edges.filter((e) => e.to === edge.to);

		// Sort edges by the Y position of their source nodes (top to bottom)
		// This prevents connections from crossing each other en layout horizontal
		const sortedEdges = [...allEdgesToNode].sort(
			(a: WorkflowEdge, b: WorkflowEdge) => {
				const aSourceNode = nodes.find((n) => n.id === a.from);
				const bSourceNode = nodes.find((n) => n.id === b.from);
				if (!aSourceNode || !bSourceNode) return 0;

				// Calculate center Y position of source nodes
				const aSourceSize = calculateNodeSize(aSourceNode);
				const bSourceSize = calculateNodeSize(bSourceNode);
				const aCenterY = aSourceNode.position.y + aSourceSize.height / 2;
				const bCenterY = bSourceNode.position.y + bSourceSize.height / 2;

				return aCenterY - bCenterY;
			},
		);

		// Find the index of the current edge
		const connectionIndex = sortedEdges.findIndex((e) => e.id === edge.id);
		const totalConnections = sortedEdges.length;

		// Distribute connections uniformly along the left edge
		// Leave some margin on top/bottom (10% on each side = 0.1 to 0.9)
		const margin = 0.1;
		const availableHeight = 1 - 2 * margin;

		if (totalConnections === 1) {
			// Single connection: center
			endY = toNodeY + toNodeActualSize.height * 0.5;
		} else {
			// Multiple connections: distribute uniformly
			const positionRatio =
				margin + (availableHeight * connectionIndex) / (totalConnections - 1);
			endY = toNodeY + toNodeActualSize.height * positionRatio;
		}

		endX = toNodeX;
	} else {
		endX = toNodeX;
		endY = toNodeY + toNodeActualSize.height / 2;
	}

	const rawDistance = Math.abs(endX - startX);
	const direction = Math.sign(endX - startX) || 1;
	const arrowPadding =
		rawDistance <= LINE_END_PADDING
			? rawDistance * 0.5
			: Math.min(LINE_END_PADDING, rawDistance * 0.45);
	const pathEndX = endX - direction * arrowPadding;
	const distance = Math.abs(pathEndX - startX);

	// Detectar si es un edge de reintento para calcular mejor routing
	const isRetryEdge =
		edge.label === "Reintento" || edge.color === "rgb(234, 179, 8)";

	// Función para calcular mejor path que rodee nodos intermedios (layout horizontal)
	const calculateSmartPath = (
		sx: number,
		sy: number,
		ex: number,
		ey: number,
		allNodes: WorkflowNode[],
		fromNodeId: string,
		toNodeId: string,
	): string => {
		// Encontrar nodos que están entre el origen y destino (horizontal)
		const minX = Math.min(sx, ex);
		const maxX = Math.max(sx, ex);
		const minY = Math.min(sy, ey);
		const maxY = Math.max(sy, ey);

		const intermediateNodes = allNodes.filter((node) => {
			if (node.id === fromNodeId || node.id === toNodeId) return false;
			const nodeSize = calculateNodeSize(node);
			const nodeLeft = node.position.x;
			const nodeRight = nodeLeft + nodeSize.width;
			const nodeTop = node.position.y;
			const nodeBottom = nodeTop + nodeSize.height;

			// Verificar si el nodo está en el área entre origen y destino (horizontal)
			return (
				nodeLeft < maxX &&
				nodeRight > minX &&
				nodeTop < maxY &&
				nodeBottom > minY
			);
		});

		if (intermediateNodes.length === 0) {
			// Sin nodos intermedios, usar curva estándar horizontal
			const curveStrength = Math.min(distance * 0.5, 160);
			const controlPoint1X = sx + Math.sign(ex - sx) * curveStrength;
			const controlPoint2X = ex - Math.sign(ex - sx) * curveStrength;
			return `M ${sx} ${sy} C ${controlPoint1X} ${sy}, ${controlPoint2X} ${ey}, ${ex} ${ey}`;
		}

		// Hay nodos intermedios, calcular curva que los rodee verticalmente
		// Calcular posición promedio vertical de los nodos intermedios
		const avgY =
			intermediateNodes.reduce((sum, node) => {
				const nodeSize = calculateNodeSize(node);
				return sum + node.position.y + nodeSize.height / 2;
			}, 0) / intermediateNodes.length;

		// Decidir si rodear por arriba o por abajo basado en la posición de los nodos
		const midY = (sy + ey) / 2;
		const shouldGoAbove = avgY > midY;

		// Calcular los límites verticales de los nodos intermedios
		const maxNodeBottom = Math.max(
			...intermediateNodes.map((n) => {
				const nodeSize = calculateNodeSize(n);
				return n.position.y + nodeSize.height;
			}),
		);
		const minNodeTop = Math.min(...intermediateNodes.map((n) => n.position.y));

		// Calcular offset vertical para rodear los nodos (con margen de 60px)
		const margin = 60;
		const curveY = shouldGoAbove
			? Math.min(sy, ey, minNodeTop) - margin // Rodear por arriba
			: Math.max(sy, ey, maxNodeBottom) + margin; // Rodear por abajo

		// Usar curva con control points horizontales hacia la zona libre
		const curveStrength = Math.min(distance * 0.4, 160);
		const direction = Math.sign(ex - sx) || 1;
		const controlPoint1X = sx + direction * curveStrength;
		const controlPoint2X = ex - direction * curveStrength;

		return `M ${sx} ${sy} C ${controlPoint1X} ${curveY}, ${controlPoint2X} ${curveY}, ${ex} ${ey}`;
	};

	const pathEndY = endY;

	const path = isRetryEdge
		? calculateSmartPath(
				startX,
				startY,
				pathEndX,
				pathEndY,
				nodes,
				fromNode.id,
				toNode.id,
			)
		: (() => {
				// Curva horizontal estándar
				const curveStrength = Math.min(distance * 0.5, 160);
				const controlPoint1X = startX + direction * curveStrength;
				const controlPoint2X = pathEndX - direction * curveStrength;
				return `M ${startX} ${startY} C ${controlPoint1X} ${startY}, ${controlPoint2X} ${pathEndY}, ${pathEndX} ${pathEndY}`;
			})();

	const midX = (startX + pathEndX) / 2;
	const midY = (startY + pathEndY) / 2;

	const defaultColor =
		hasDualOutputs && edge.fromPort
			? edge.fromPort === "top"
				? "rgb(34, 197, 94)"
				: "rgb(239, 68, 68)"
			: selected
				? "var(--primary)"
				: "var(--muted-foreground)";

	const edgeColor = edge.color || defaultColor;
	const edgeThickness = edge.thickness || 2;

	// isRetryEdge ya está declarado arriba
	const retryColor = "rgb(234, 179, 8)"; // Amarillo para reintentos
	const retryThickness = 2.5; // Grosor moderado para reintentos

	return (
		<g className="workflow-edge">
			{/* Invisible wider path for easier clicking */}
			<path
				d={path}
				stroke="transparent"
				strokeWidth={30}
				fill="none"
				style={{ pointerEvents: "auto", cursor: "pointer" }}
				onClick={(e) => {
					e.stopPropagation();
					console.warn(
						"[v0] Edge path clicked:",
						edge.id,
						"shift:",
						e.shiftKey,
					);
					// Always call onSelect - let the canvas handle shift+click for selection toggling
					onSelect(e);
				}}
				onMouseEnter={() => console.warn("[v0] Edge hover:", edge.id)}
			/>

			{isRetryEdge ? (
				<>
					{/* Línea de fondo más gruesa con opacidad reducida para profundidad sutil */}
					<path
						d={path}
						stroke={retryColor}
						strokeWidth={retryThickness + 0.5}
						strokeOpacity={0.1}
						fill="none"
						style={{ pointerEvents: "none" }}
					/>
					{/* Línea principal con patrón de guiones más largo y visible */}
					<path
						d={path}
						stroke={retryColor}
						strokeWidth={retryThickness}
						strokeDasharray="12,6"
						strokeOpacity={0.7}
						fill="none"
						style={{
							pointerEvents: "none",
							filter: "drop-shadow(0 0 1px rgba(234, 179, 8, 0.3))",
						}}
						markerEnd={`url(#arrowhead-retry-${edge.id})`}
					>
						{/* Animación sutil de movimiento del patrón */}
						<animate
							attributeName="stroke-dashoffset"
							values="0;18"
							dur="1.5s"
							repeatCount="indefinite"
						/>
					</path>
				</>
			) : (
				/* Línea normal para edges no-reintento */
				<path
					d={path}
					stroke={edgeColor}
					strokeWidth={selected ? edgeThickness + 0.5 : edgeThickness}
					fill="none"
					style={{ pointerEvents: "none" }}
					markerEnd={`url(#arrowhead-${edge.id})`}
				/>
			)}

			{/* Delete button when selected */}
			{selected && (
				<g style={{ pointerEvents: "auto" }}>
					<circle
						cx={midX}
						cy={midY}
						r={16}
						fill="var(--destructive)"
						style={{ cursor: "pointer" }}
						className="transition-all hover:r-18"
						onClick={(e) => {
							e.stopPropagation();
							console.warn("[v0] Delete button clicked:", edge.id);
							onDelete();
						}}
					/>
					<foreignObject
						x={midX - 12}
						y={midY - 12}
						width={24}
						height={24}
						style={{ pointerEvents: "none" }}
					>
						<Trash2 className="h-6 w-6 text-destructive-foreground" />
					</foreignObject>
				</g>
			)}

			{/* Edge label */}
			{edge.label && (
				<text
					x={midX}
					y={midY - 25}
					textAnchor="middle"
					className="pointer-events-none fill-foreground text-xs font-medium"
					style={{ userSelect: "none" }}
				>
					{edge.label}
				</text>
			)}

			{/* Arrowhead marker definitions */}
			<defs>
				<marker
					id={`arrowhead-${edge.id}`}
					markerWidth={ARROW_MARKER_WIDTH}
					markerHeight={ARROW_MARKER_HEIGHT}
					refX={0}
					refY={ARROW_MARKER_REF_Y}
					orient="auto"
					markerUnits="userSpaceOnUse"
					viewBox={`0 0 ${ARROW_MARKER_WIDTH} ${ARROW_MARKER_HEIGHT}`}
				>
					<polygon
						points={`0 0, ${ARROW_MARKER_WIDTH} ${ARROW_MARKER_REF_Y}, 0 ${ARROW_MARKER_HEIGHT}`}
						fill={edgeColor}
						className="pointer-events-none"
					/>
				</marker>
				{/* Marker especial para edges de reintento */}
				{isRetryEdge && (
					<marker
						id={`arrowhead-retry-${edge.id}`}
						markerWidth={ARROW_MARKER_WIDTH}
						markerHeight={ARROW_MARKER_HEIGHT}
						refX={0}
						refY={ARROW_MARKER_REF_Y}
						orient="auto"
						markerUnits="userSpaceOnUse"
						viewBox={`0 0 ${ARROW_MARKER_WIDTH} ${ARROW_MARKER_HEIGHT}`}
					>
						<polygon
							points={`0 0, ${ARROW_MARKER_WIDTH} ${ARROW_MARKER_REF_Y}, 0 ${ARROW_MARKER_HEIGHT}`}
							fill={retryColor}
							fillOpacity="0.7"
							className="pointer-events-none"
							style={{ filter: "drop-shadow(0 0 1px rgba(234, 179, 8, 0.3))" }}
						/>
					</marker>
				)}
			</defs>
		</g>
	);
}
