import type React from "react";
import { useMemo, useRef, useCallback, useId } from "react";
import type { WorkflowNode, WorkflowEdge } from "@/lib/workflow/types";
import { estimateNodeDimensions } from "./node-metrics";
import { NODE_ICON_COLORS } from "./node-renderer";

const MINIMAP_WIDTH = 220;
const MINIMAP_HEIGHT = 160;
const INNER_PADDING = 8;
const WORLD_PADDING = 120;
const MINIMAP_DOT_SPACING = 18;
const MINIMAP_DOT_RADIUS = 0.7;
type ScaledNode = {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	color?: string;
};

type ScaledEdge = {
	id: string;
	from: { x: number; y: number };
	to: { x: number; y: number };
};

export type WorldRect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type WorkflowBounds = {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
};

export const getViewportWorldRect = ({
	pan,
	zoom,
	viewportSize,
}: {
	pan: { x: number; y: number };
	zoom: number;
	viewportSize: { width: number; height: number };
}): WorldRect | null => {
	const safeZoom = Math.max(zoom, 0.0001);
	if (viewportSize.width <= 0 || viewportSize.height <= 0) {
		return null;
	}

	return {
		x: -pan.x / safeZoom,
		y: -pan.y / safeZoom,
		width: viewportSize.width / safeZoom,
		height: viewportSize.height / safeZoom,
	};
};

export const getWorkflowBounds = (
	nodes: WorkflowNode[],
	viewportWorld: WorldRect | null,
): WorkflowBounds => {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	nodes.forEach((node) => {
		const size = estimateNodeDimensions(node);
		minX = Math.min(minX, node.position.x);
		minY = Math.min(minY, node.position.y);
		maxX = Math.max(maxX, node.position.x + size.width);
		maxY = Math.max(maxY, node.position.y + size.height);
	});

	if (viewportWorld) {
		minX = Math.min(minX, viewportWorld.x);
		minY = Math.min(minY, viewportWorld.y);
		maxX = Math.max(maxX, viewportWorld.x + viewportWorld.width);
		maxY = Math.max(maxY, viewportWorld.y + viewportWorld.height);
	}

	if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
		minX = 0;
		minY = 0;
		maxX = 1;
		maxY = 1;
	}

	return {
		minX: minX - WORLD_PADDING,
		minY: minY - WORLD_PADDING,
		maxX: maxX + WORLD_PADDING,
		maxY: maxY + WORLD_PADDING,
	};
};

export const getMinimapTransform = ({
	bounds,
	width,
	height,
	padding = INNER_PADDING,
}: {
	bounds: WorkflowBounds;
	width: number;
	height: number;
	padding?: number;
}) => {
	const availableWidth = Math.max(width - padding * 2, 1);
	const availableHeight = Math.max(height - padding * 2, 1);
	const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
	const boundsHeight = Math.max(bounds.maxY - bounds.minY, 1);

	const scale = Math.min(
		availableWidth / boundsWidth,
		availableHeight / boundsHeight,
	);

	return {
		scale,
		offsetX: padding - bounds.minX * scale,
		offsetY: padding - bounds.minY * scale,
	};
};

interface MinimapProps {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	zoom: number;
	pan: { x: number; y: number };
	viewportSize: { width: number; height: number };
	onUpdatePan: (pan: { x: number; y: number }) => void;
}

export function Minimap({
	nodes,
	edges,
	zoom,
	pan,
	viewportSize,
	onUpdatePan,
}: MinimapProps) {
	if (nodes.length === 0) return null;

	const containerRef = useRef<HTMLDivElement>(null);
	const isPointerDownRef = useRef(false);
	const safeZoom = Math.max(zoom, 0.0001);
	const reactId = useId();
	const patternId = useMemo(() => reactId.replace(/:/g, "-"), [reactId]);

	const viewportWorld = useMemo(
		() =>
			getViewportWorldRect({
				pan,
				zoom: safeZoom,
				viewportSize,
			}),
		[pan.x, pan.y, safeZoom, viewportSize.width, viewportSize.height],
	);

	const bounds = useMemo(
		() => getWorkflowBounds(nodes, viewportWorld),
		[nodes, viewportWorld],
	);

	const { scale, offsetX, offsetY } = useMemo(
		() =>
			getMinimapTransform({
				bounds,
				width: MINIMAP_WIDTH,
				height: MINIMAP_HEIGHT,
			}),
		[bounds],
	);

	const scaledNodes = useMemo<ScaledNode[]>(
		() =>
			nodes.map((node) => {
				const size = estimateNodeDimensions(node);
				return {
					id: node.id,
					x: node.position.x * scale + offsetX,
					y: node.position.y * scale + offsetY,
					width: Math.max(size.width * scale, 4),
					height: Math.max(size.height * scale, 4),
					color:
						node.type === "Checkpoint" && node.checkpointType === "safe"
							? "var(--node-safe-icon-color)"
							: NODE_ICON_COLORS[node.type],
				};
			}),
		[nodes, scale, offsetX, offsetY],
	);

	const scaledNodeCenters = useMemo(() => {
		const map = new Map<string, { x: number; y: number }>();
		scaledNodes.forEach((node) => {
			map.set(node.id, {
				x: node.x + node.width / 2,
				y: node.y + node.height / 2,
			});
		});
		return map;
	}, [scaledNodes]);

	const scaledEdges = useMemo<ScaledEdge[]>(() => {
		return edges
			.map((edge) => {
				const from = scaledNodeCenters.get(edge.from);
				const to = scaledNodeCenters.get(edge.to);
				if (!from || !to) return null;
				return {
					id: edge.id,
					from,
					to,
				};
			})
			.filter((edge): edge is ScaledEdge => Boolean(edge));
	}, [edges, scaledNodeCenters]);

	const viewportIndicator = useMemo(() => {
		if (!viewportWorld) return null;
		return {
			x: viewportWorld.x * scale + offsetX,
			y: viewportWorld.y * scale + offsetY,
			width: viewportWorld.width * scale,
			height: viewportWorld.height * scale,
		};
	}, [viewportWorld, scale, offsetX, offsetY]);

	const convertPointToWorld = useCallback(
		(clientX: number, clientY: number) => {
			const element = containerRef.current;
			if (!element || scale <= 0) return null;

			const rect = element.getBoundingClientRect();
			const localX = clientX - rect.left;
			const localY = clientY - rect.top;

			const clampedX = Math.min(Math.max(localX, 0), MINIMAP_WIDTH);
			const clampedY = Math.min(Math.max(localY, 0), MINIMAP_HEIGHT);

			return {
				x: (clampedX - offsetX) / scale,
				y: (clampedY - offsetY) / scale,
			};
		},
		[scale, offsetX, offsetY],
	);

	const updatePanFromMinimap = useCallback(
		(clientX: number, clientY: number) => {
			if (viewportSize.width <= 0 || viewportSize.height <= 0) return;

			const worldPoint = convertPointToWorld(clientX, clientY);
			if (!worldPoint) return;

			onUpdatePan({
				x: viewportSize.width / 2 - worldPoint.x * safeZoom,
				y: viewportSize.height / 2 - worldPoint.y * safeZoom,
			});
		},
		[
			convertPointToWorld,
			viewportSize.width,
			viewportSize.height,
			safeZoom,
			onUpdatePan,
		],
	);

	const handlePointerDown = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			event.preventDefault();
			isPointerDownRef.current = true;
			updatePanFromMinimap(event.clientX, event.clientY);
		},
		[updatePanFromMinimap],
	);

	const handlePointerMove = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (!isPointerDownRef.current) return;
			event.preventDefault();
			updatePanFromMinimap(event.clientX, event.clientY);
		},
		[updatePanFromMinimap],
	);

	const stopPointerInteraction = useCallback(() => {
		isPointerDownRef.current = false;
	}, []);

	const isInteractive = viewportWorld !== null;

	return (
		<div className="rounded border border-border/60 bg-card/80 p-2 shadow-lg backdrop-blur">
			<div
				ref={containerRef}
				className="relative overflow-hidden rounded"
				style={{
					width: MINIMAP_WIDTH,
					height: MINIMAP_HEIGHT,
					cursor: isInteractive ? "pointer" : "not-allowed",
				}}
				onPointerDown={isInteractive ? handlePointerDown : undefined}
				onPointerMove={isInteractive ? handlePointerMove : undefined}
				onPointerUp={isInteractive ? stopPointerInteraction : undefined}
				onPointerLeave={isInteractive ? stopPointerInteraction : undefined}
			>
				<svg width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} className="block">
					<defs>
						<pattern
							id={patternId}
							width={MINIMAP_DOT_SPACING}
							height={MINIMAP_DOT_SPACING}
							patternUnits="userSpaceOnUse"
						>
							<rect
								width={MINIMAP_DOT_SPACING}
								height={MINIMAP_DOT_SPACING}
								fill="var(--canvas-bg, hsl(var(--background)))"
							/>
							<circle
								cx={MINIMAP_DOT_RADIUS * 2}
								cy={MINIMAP_DOT_RADIUS * 2}
								r={MINIMAP_DOT_RADIUS}
								fill="var(--canvas-grid, hsl(var(--foreground)))"
								opacity={0.45}
							/>
						</pattern>
					</defs>

					<rect
						width={MINIMAP_WIDTH}
						height={MINIMAP_HEIGHT}
						fill={`url(#${patternId})`}
					/>

					{scaledEdges.map((edge) => (
						<line
							key={edge.id}
							x1={edge.from.x}
							y1={edge.from.y}
							x2={edge.to.x}
							y2={edge.to.y}
							stroke="var(--border)"
							strokeWidth={1}
							opacity={0.35}
						/>
					))}

					{scaledNodes.map((node) => (
						<rect
							key={node.id}
							x={node.x}
							y={node.y}
							width={node.width}
							height={node.height}
							fill={node.color || "var(--primary)"}
							opacity={0.45}
							rx={2}
						/>
					))}

					{viewportIndicator && (
						<rect
							x={viewportIndicator.x}
							y={viewportIndicator.y}
							width={viewportIndicator.width}
							height={viewportIndicator.height}
							fill="rgba(99, 102, 241, 0.18)"
							stroke="rgba(99, 102, 241, 0.9)"
							strokeWidth={1.5}
							rx={3}
						/>
					)}
				</svg>
			</div>
		</div>
	);
}
