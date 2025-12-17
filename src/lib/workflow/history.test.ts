import { describe, expect, it } from "vitest";
import type { WorkflowEdge, WorkflowNode } from "./types";
import {
	MAX_HISTORY_LENGTH,
	canRedoHistory,
	canUndoHistory,
	initializeHistory,
	pushHistoryState,
	redoHistory,
	undoHistory,
} from "./history";

const makeNode = (id: string): WorkflowNode => ({
	id: `node-${id}`,
	type: "Start",
	title: `Node ${id}`,
	description: "",
	roles: [],
	config: {},
	position: { x: 0, y: 0 },
	groupId: null,
	staleTimeout: null,
});

const makeEdge = (id: string): WorkflowEdge => ({
	id: `edge-${id}`,
	from: "node-a",
	to: "node-b",
	label: null,
});

describe("workflow history helpers", () => {
	it("initializes history with a cloned snapshot", () => {
		const nodes = [makeNode("1")];
		const edges = [makeEdge("1")];

		const { history, historyIndex } = initializeHistory(nodes, edges);

		expect(historyIndex).toBe(0);
		expect(history).toHaveLength(1);
		expect(history[0].nodes).not.toBe(nodes);
		expect(history[0].edges).not.toBe(edges);
		expect(history[0].nodes[0]).toEqual(nodes[0]);
	});

	it("appends snapshots and drops redo states when branching", () => {
		const initial = initializeHistory([makeNode("1")], []);
		const afterSecondNode = pushHistoryState({
			...initial,
			nodes: [makeNode("1"), makeNode("2")],
			edges: [],
		});

		// Simulate undo (historyIndex now points to first snapshot)
		const undoneState = {
			history: afterSecondNode.history,
			historyIndex: 0,
		};

		const branched = pushHistoryState({
			...undoneState,
			nodes: [makeNode("1"), makeNode("3")],
			edges: [],
		});

		expect(branched.history).toHaveLength(2);
		expect(branched.history[1].nodes.map((n) => n.id)).toEqual([
			"node-1",
			"node-3",
		]);
		expect(canRedoHistory(branched.history, branched.historyIndex)).toBe(false);
	});

	it("limits the number of stored snapshots", () => {
		let state = initializeHistory([makeNode("0")], []);

		for (let i = 1; i <= MAX_HISTORY_LENGTH + 5; i++) {
			state = pushHistoryState({
				...state,
				nodes: [makeNode(`${i}`)],
				edges: [],
			});
		}

		expect(state.history.length).toBe(MAX_HISTORY_LENGTH);
		expect(state.historyIndex).toBe(MAX_HISTORY_LENGTH - 1);
	});

	it("returns null when undo is not available", () => {
		const initial = initializeHistory([makeNode("solo")], []);

		expect(canUndoHistory(initial.historyIndex)).toBe(false);
		expect(
			undoHistory({
				history: initial.history,
				historyIndex: initial.historyIndex,
			}),
		).toBeNull();
	});

	it("restores the previous snapshot on undo", () => {
		const initial = initializeHistory([makeNode("1")], []);
		const afterChange = pushHistoryState({
			...initial,
			nodes: [makeNode("1"), makeNode("2")],
			edges: [makeEdge("1")],
		});

		const result = undoHistory(afterChange);

		expect(result).not.toBeNull();
		expect(result?.historyIndex).toBe(initial.historyIndex);
		expect(result?.nodes.map((n) => n.id)).toEqual(["node-1"]);
		expect(result?.edges).toEqual([]);
	});

	it("detects when redo is available", () => {
		const initial = initializeHistory([makeNode("1")], []);
		const afterChange = pushHistoryState({
			...initial,
			nodes: [makeNode("1"), makeNode("2")],
			edges: [],
		});

		const undone = undoHistory(afterChange);
		expect(undone).not.toBeNull();
		if (!undone) return;

		expect(canRedoHistory(afterChange.history, undone.historyIndex)).toBe(true);
	});

	it("returns null when redo is not available", () => {
		const initial = initializeHistory([makeNode("solo")], []);

		expect(canRedoHistory(initial.history, initial.historyIndex)).toBe(false);
		expect(
			redoHistory({
				history: initial.history,
				historyIndex: initial.historyIndex,
			}),
		).toBeNull();
	});

	it("restores the next snapshot on redo", () => {
		const initial = initializeHistory([makeNode("1")], []);
		const afterChange = pushHistoryState({
			...initial,
			nodes: [makeNode("1"), makeNode("2")],
			edges: [],
		});
		const undone = undoHistory(afterChange);
		expect(undone).not.toBeNull();
		if (!undone) return;

		const redone = redoHistory({
			history: afterChange.history,
			historyIndex: undone.historyIndex,
		});
		expect(redone).not.toBeNull();
		expect(redone?.historyIndex).toBe(afterChange.historyIndex);
		expect(redone?.nodes.map((n) => n.id)).toEqual(
			afterChange.history[afterChange.historyIndex].nodes.map((n) => n.id),
		);
	});
});
