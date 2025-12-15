import type { WorkflowNode, WorkflowEdge, APIFailureHandling } from "./types";

export interface CopiedSelection {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
}

const PASTE_OFFSET = 50; // Offset in pixels for pasted elements

/**
 * Serializes selected nodes and edges for copying
 * Filters out Start nodes and edges that don't connect selected nodes
 */
export function serializeSelection(
	selectedNodeIds: string[],
	selectedEdgeIds: string[],
	allNodes: WorkflowNode[],
	allEdges: WorkflowEdge[],
): CopiedSelection | null {
	// Filter out Start nodes - they cannot be copied
	const selectedNodes = allNodes.filter(
		(node) => selectedNodeIds.includes(node.id) && node.type !== "Start",
	);

	if (selectedNodes.length === 0 && selectedEdgeIds.length === 0) {
		return null;
	}

	const selectedNodeIdSet = new Set(selectedNodes.map((n) => n.id));

	// Only include edges where both from and to nodes are in the selection
	// OR edges that are explicitly selected
	const selectedEdges = allEdges.filter((edge) => {
		// If edge is explicitly selected, include it
		if (selectedEdgeIds.includes(edge.id)) {
			// But only if both nodes are in selection
			return selectedNodeIdSet.has(edge.from) && selectedNodeIdSet.has(edge.to);
		}
		// Otherwise, only include if both nodes are selected
		return selectedNodeIdSet.has(edge.from) && selectedNodeIdSet.has(edge.to);
	});

	return {
		nodes: selectedNodes,
		edges: selectedEdges,
	};
}

/**
 * Regenerates IDs for nodes and edges, and creates a mapping
 */
function regenerateIds(
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
): {
	newNodes: WorkflowNode[];
	newEdges: WorkflowEdge[];
	idMapping: Map<string, string>;
} {
	const idMapping = new Map<string, string>();
	const timestamp = Date.now();

	// Regenerate node IDs
	const newNodes = nodes.map((node, index) => {
		const newId = `node-${timestamp}-${index}`;
		idMapping.set(node.id, newId);
		return {
			...node,
			id: newId,
		};
	});

	// Regenerate edge IDs and update from/to references
	// Only update edges where both nodes are in the mapping (both were copied)
	const newEdges = edges
		.map((edge, index) => {
			const newId = `edge-${timestamp}-${index}`;
			const newFrom = idMapping.get(edge.from);
			const newTo = idMapping.get(edge.to);
			// Only include edges where both nodes were in the copied selection
			if (newFrom && newTo) {
				return {
					...edge,
					id: newId,
					from: newFrom,
					to: newTo,
				};
			}
			return null;
		})
		.filter((edge): edge is WorkflowEdge => edge !== null);

	return { newNodes, newEdges, idMapping };
}

/**
 * Resolves dependencies for copied nodes
 * - Cleans up checkpoint references that don't exist in the copied set
 * - Handles Reject nodes with allowRetry
 */
function resolveDependencies(
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
	copiedNodeIdSet: Set<string>,
	originalCheckpointIdSet?: Set<string>,
): {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
} {
	const checkpointIdSet = new Set(
		nodes.filter((n) => n.type === "Checkpoint").map((n) => n.id),
	);

	// Process nodes to resolve dependencies
	const resolvedNodes = nodes.map((node) => {
		// Handle API nodes with return-to-checkpoint
		if (node.type === "API") {
			const failureHandling = node.config.failureHandling as
				| (APIFailureHandling & { checkpointId?: string })
				| undefined;

			if (
				failureHandling?.onFailure === "return-to-checkpoint" &&
				failureHandling.checkpointId
			) {
				// Check against original checkpoint IDs if provided (before ID regeneration)
				// or against new checkpoint IDs (after ID regeneration)
				const checkpointExists =
					originalCheckpointIdSet?.has(failureHandling.checkpointId) ||
					checkpointIdSet.has(failureHandling.checkpointId);

				if (!checkpointExists) {
					const cleanedFailureHandling: APIFailureHandling & {
						checkpointId?: string;
					} = {
						...failureHandling,
						onFailure: "stop", // Default to stop if checkpoint is missing
						checkpointId: undefined,
					};
					return {
						...node,
						config: {
							...node.config,
							failureHandling: cleanedFailureHandling,
						},
					};
				}
				// If checkpoint is in the set, preserve the configuration
				// (checkpointId will be updated to new ID later in deserializeSelection)
			}
		}

		// Handle Reject nodes with allowRetry
		if (node.type === "Reject") {
			const allowRetry = (node.config.allowRetry as boolean) === true;
			if (allowRetry) {
				// Check if there's an edge to a checkpoint in the copied set
				const retryEdge = edges.find(
					(e) =>
						e.from === node.id &&
						copiedNodeIdSet.has(e.to) &&
						nodes.some((n) => n.id === e.to && n.type === "Checkpoint"),
				);

				// If no valid retry edge exists in the copied set, disable allowRetry
				if (!retryEdge) {
					return {
						...node,
						config: {
							...node.config,
							allowRetry: false,
						},
					};
				}
			}
		}

		return node;
	});

	// Filter out retry edges for Reject nodes that no longer have allowRetry enabled
	// Also filter edges that go to checkpoints not in the copied set
	const resolvedEdges = edges.filter((edge) => {
		const fromNode = resolvedNodes.find((n) => n.id === edge.from);
		const toNode = resolvedNodes.find((n) => n.id === edge.to);

		if (fromNode?.type === "Reject") {
			const allowRetry = (fromNode.config.allowRetry as boolean) === true;
			// If edge goes to a checkpoint, it's a retry edge
			if (toNode?.type === "Checkpoint") {
				// Filter out if allowRetry is disabled
				if (!allowRetry) {
					return false;
				}
				// Also filter out if checkpoint is not in copied set
				// Check both new IDs and original IDs
				if (!copiedNodeIdSet.has(edge.to)) {
					// The edge.to might be an old ID, check if it maps to a new ID in copied set
					// But since we're after ID regeneration, edge.to should already be a new ID
					// So if it's not in copiedNodeIdSet, it's an external checkpoint
					return false;
				}
			}
		}
		return true;
	});

	return { nodes: resolvedNodes, edges: resolvedEdges };
}

/**
 * Calculates the offset to apply to pasted elements to avoid collisions
 */
export function calculatePasteOffset(
	existingNodes: WorkflowNode[],
	copiedNodes: WorkflowNode[],
): { x: number; y: number } {
	if (copiedNodes.length === 0) {
		return { x: PASTE_OFFSET, y: PASTE_OFFSET };
	}

	// Find the bounding box of copied nodes
	const minX = Math.min(...copiedNodes.map((n) => n.position.x));
	const minY = Math.min(...copiedNodes.map((n) => n.position.y));
	const maxX = Math.max(...copiedNodes.map((n) => n.position.x));
	const maxY = Math.max(...copiedNodes.map((n) => n.position.y));

	const copiedWidth = maxX - minX;
	const copiedHeight = maxY - minY;

	// Check if there's any overlap with existing nodes
	// We need to check if any existing node would be inside the bounding box of pasted nodes
	const hasOverlap = existingNodes.some((existingNode) => {
		const existingX = existingNode.position.x;
		const existingY = existingNode.position.y;

		// Check if existing node would be inside the bounding box of pasted nodes at offset
		const pastedMinX = minX + PASTE_OFFSET;
		const pastedMaxX = maxX + PASTE_OFFSET;
		const pastedMinY = minY + PASTE_OFFSET;
		const pastedMaxY = maxY + PASTE_OFFSET;

		// Use a tolerance to account for node size (approximate node size ~180-320px)
		const tolerance = 200;
		// Check if existing node center is within the pasted bounding box + tolerance
		return (
			existingX >= pastedMinX - tolerance &&
			existingX <= pastedMaxX + tolerance &&
			existingY >= pastedMinY - tolerance &&
			existingY <= pastedMaxY + tolerance
		);
	});

	// If there's overlap, use a larger offset
	if (hasOverlap) {
		// Use a larger offset based on the size of the copied content
		const largerOffsetX = Math.max(
			PASTE_OFFSET * 2,
			PASTE_OFFSET + Math.max(copiedWidth, 200) / 2,
		);
		const largerOffsetY = Math.max(
			PASTE_OFFSET * 2,
			PASTE_OFFSET + Math.max(copiedHeight, 200) / 2,
		);
		return {
			x: largerOffsetX,
			y: largerOffsetY,
		};
	}

	return { x: PASTE_OFFSET, y: PASTE_OFFSET };
}

/**
 * Deserializes and prepares copied selection for pasting
 * - Regenerates all IDs
 * - Resolves dependencies
 * - Applies visual offset
 */
export function deserializeSelection(
	copiedSelection: CopiedSelection,
	existingNodes: WorkflowNode[],
	offset?: { x: number; y: number },
): {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
} {
	// Create set of original node IDs for dependency resolution (before ID regeneration)
	const originalNodeIdSet = new Set(copiedSelection.nodes.map((n) => n.id));
	const originalCheckpointIdSet = new Set(
		copiedSelection.nodes
			.filter((n) => n.type === "Checkpoint")
			.map((n) => n.id),
	);

	// Regenerate IDs
	const { newNodes, newEdges, idMapping } = regenerateIds(
		copiedSelection.nodes,
		copiedSelection.edges,
	);

	// Create set of new node IDs for dependency resolution
	const newNodeIdSet = new Set(newNodes.map((n) => n.id));

	// Resolve dependencies using original IDs first, then update to new IDs
	// We need to check dependencies against original IDs before regenerating
	const { nodes: resolvedNodes, edges: resolvedEdges } = resolveDependencies(
		newNodes,
		newEdges,
		newNodeIdSet,
		originalCheckpointIdSet,
	);

	// Update checkpoint references in API nodes to use new checkpoint IDs
	// Create mapping from old checkpoint IDs to new checkpoint IDs
	const checkpointIdMapping = new Map<string, string>();
	copiedSelection.nodes.forEach((node) => {
		if (node.type === "Checkpoint") {
			const newCheckpointId = idMapping.get(node.id);
			if (newCheckpointId) {
				checkpointIdMapping.set(node.id, newCheckpointId);
			}
		}
	});

	// Update API nodes that reference checkpoints
	// Create a mapping from new node IDs back to original node IDs
	const reverseIdMapping = new Map<string, string>();
	idMapping.forEach((newId, oldId) => {
		reverseIdMapping.set(newId, oldId);
	});

	const finalNodes = resolvedNodes.map((node) => {
		if (node.type === "API") {
			const failureHandling = node.config.failureHandling as
				| (APIFailureHandling & { checkpointId?: string })
				| undefined;

			if (
				failureHandling?.onFailure === "return-to-checkpoint" &&
				failureHandling.checkpointId
			) {
				// The checkpointId in failureHandling is the old ID (from before ID regeneration)
				// Map it to the new checkpoint ID
				const newCheckpointId = checkpointIdMapping.get(
					failureHandling.checkpointId,
				);
				if (newCheckpointId) {
					return {
						...node,
						config: {
							...node.config,
							failureHandling: {
								...failureHandling,
								checkpointId: newCheckpointId,
							},
						},
					};
				}
			}
		}
		return node;
	});

	// Calculate offset if not provided
	const pasteOffset = offset || calculatePasteOffset(existingNodes, finalNodes);

	// Apply offset to node positions
	const offsetNodes = finalNodes.map((node) => ({
		...node,
		position: {
			x: node.position.x + pasteOffset.x,
			y: node.position.y + pasteOffset.y,
		},
	}));

	return {
		nodes: offsetNodes,
		edges: resolvedEdges,
	};
}
