import type { WorkflowEdge, WorkflowNode, WorkflowState } from "./types";

const MAX_HISTORY_LENGTH = 50;

const cloneDeep = <T>(value: T): T => {
	if (typeof structuredClone === "function") {
		return structuredClone(value);
	}
	return JSON.parse(JSON.stringify(value));
};

const createHistorySnapshot = (
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
): WorkflowState["history"][number] => ({
	nodes: cloneDeep(nodes),
	edges: cloneDeep(edges),
});

const initializeHistory = (nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
	const snapshot = createHistorySnapshot(nodes, edges);
	return {
		history: [snapshot],
		historyIndex: 0,
	};
};

type HistoryState = Pick<WorkflowState, "history" | "historyIndex">;

const pushHistoryState = ({
	history,
	historyIndex,
	nodes,
	edges,
}: HistoryState & { nodes: WorkflowNode[]; edges: WorkflowEdge[] }) => {
	const baseHistory =
		historyIndex >= 0 && history.length > 0
			? history.slice(0, historyIndex + 1)
			: history.length > 0
				? [history[history.length - 1]]
				: [];

	const nextHistory = [...baseHistory, createHistorySnapshot(nodes, edges)];
	const trimmedHistory =
		nextHistory.length > MAX_HISTORY_LENGTH
			? nextHistory.slice(nextHistory.length - MAX_HISTORY_LENGTH)
			: nextHistory;

	return {
		history: trimmedHistory,
		historyIndex: trimmedHistory.length - 1,
	};
};

const canUndoHistory = (historyIndex: number) => historyIndex > 0;

const undoHistory = ({ history, historyIndex }: HistoryState) => {
	if (!canUndoHistory(historyIndex)) {
		return null;
	}

	const nextIndex = historyIndex - 1;
	const snapshot = history[nextIndex];
	if (!snapshot) {
		return null;
	}

	return {
		nodes: cloneDeep(snapshot.nodes),
		edges: cloneDeep(snapshot.edges),
		historyIndex: nextIndex,
	};
};

export {
	MAX_HISTORY_LENGTH,
	canUndoHistory,
	createHistorySnapshot,
	initializeHistory,
	pushHistoryState,
	undoHistory,
};
