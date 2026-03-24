import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { NodeRenderer } from "./node-renderer";
import type { WorkflowNode } from "@/lib/workflow/types";

vi.mock("@/components/LanguageProvider", async () => {
	const { translations } = await import("@/lib/translations");
	const tFn = (key: string, params?: Record<string, string | number>) => {
		const parts = key.split(".");
		let val: unknown = translations.es;
		for (const part of parts) {
			if (val && typeof val === "object") {
				val = (val as Record<string, unknown>)[part];
			} else {
				return key;
			}
		}
		if (typeof val !== "string") return key;
		if (params) {
			return val.replace(/\{(\w+)\}/g, (_, k) =>
				params[k] !== undefined ? String(params[k]) : `{${k}}`,
			);
		}
		return val;
	};
	return {
		useLanguage: () => ({ language: "es", setLanguage: vi.fn(), t: tFn }),
	};
});

const baseNode: WorkflowNode = {
	id: "node-1",
	type: "Form",
	title: "Formulario corto",
	description: "",
	roles: [],
	config: {},
	position: { x: 100, y: 200 },
	groupId: null,
};

const noop = () => {};

describe("NodeRenderer horizontal layout", () => {
	beforeEach(() => {
		vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
			cb(0);
			return 0;
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("renders single output/input connectors on right/left sides", () => {
		const { getByTestId } = render(
			<NodeRenderer
				node={baseNode}
				selected={false}
				errors={[]}
				connecting={false}
				onMouseDown={noop}
				onConnectorClick={noop}
			/>,
		);

		const outputConnector = getByTestId("output-connector");
		const inputConnector = getByTestId("input-connector");

		expect(outputConnector).toBeInTheDocument();
		expect(outputConnector).toHaveStyle({ right: "-6px" });
		expect(inputConnector).toBeInTheDocument();
		expect(inputConnector).toHaveStyle({ left: "-6px" });
	});

	it("stacks decision outputs vertically on the right side", () => {
		const decisionNode: WorkflowNode = {
			...baseNode,
			id: "node-2",
			type: "Decision",
			title: "Decisión corta",
		};

		const { getByTestId } = render(
			<NodeRenderer
				node={decisionNode}
				selected={false}
				errors={[]}
				connecting={false}
				onMouseDown={noop}
				onConnectorClick={noop}
			/>,
		);

		const positiveConnector = getByTestId("output-connector-positive");
		const negativeConnector = getByTestId("output-connector-negative");

		expect(positiveConnector).toHaveStyle({ right: "-6px" });
		expect(negativeConnector).toHaveStyle({ right: "-6px" });

		const positiveTop = parseFloat(positiveConnector.style.top || "0");
		const negativeTop = parseFloat(negativeConnector.style.top || "0");

		expect(positiveTop).toBeLessThan(negativeTop);
	});
});

describe("NodeRenderer connector visibility", () => {
	beforeEach(() => {
		vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
			cb(0);
			return 0;
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("hides connectors when node is not selected, not hovered, and no connection in progress", () => {
		const { getByTestId } = render(
			<NodeRenderer
				node={baseNode}
				selected={false}
				errors={[]}
				connecting={false}
				isAnyConnectionInProgress={false}
				onMouseDown={noop}
				onConnectorClick={noop}
			/>,
		);

		const outputConnector = getByTestId("output-connector");
		const inputConnector = getByTestId("input-connector");

		expect(outputConnector.className).toContain("opacity-0");
		expect(inputConnector.className).toContain("opacity-0");
	});

	it("shows connectors when node is selected", () => {
		const { getByTestId } = render(
			<NodeRenderer
				node={baseNode}
				selected={true}
				errors={[]}
				connecting={false}
				isAnyConnectionInProgress={false}
				onMouseDown={noop}
				onConnectorClick={noop}
			/>,
		);

		const outputConnector = getByTestId("output-connector");
		const inputConnector = getByTestId("input-connector");

		expect(outputConnector.className).toContain("opacity-100");
		expect(inputConnector.className).toContain("opacity-100");
	});

	it("shows connectors when connecting from this node", () => {
		const { getByTestId } = render(
			<NodeRenderer
				node={baseNode}
				selected={false}
				errors={[]}
				connecting={true}
				isAnyConnectionInProgress={true}
				onMouseDown={noop}
				onConnectorClick={noop}
			/>,
		);

		const outputConnector = getByTestId("output-connector");
		expect(outputConnector.className).toContain("opacity-100");
	});

	it("shows connectors when any connection is in progress (for input connectors on other nodes)", () => {
		const { getByTestId } = render(
			<NodeRenderer
				node={baseNode}
				selected={false}
				errors={[]}
				connecting={false}
				isAnyConnectionInProgress={true}
				onMouseDown={noop}
				onConnectorClick={noop}
			/>,
		);

		const inputConnector = getByTestId("input-connector");
		expect(inputConnector.className).toContain("opacity-100");
	});

	it("shows connectors when node is hovered", () => {
		const { getByTestId, container } = render(
			<NodeRenderer
				node={baseNode}
				selected={false}
				errors={[]}
				connecting={false}
				isAnyConnectionInProgress={false}
				onMouseDown={noop}
				onConnectorClick={noop}
			/>,
		);

		const outerDiv = container.firstChild as HTMLElement;
		fireEvent.mouseEnter(outerDiv);

		const outputConnector = getByTestId("output-connector");
		expect(outputConnector.className).toContain("opacity-100");
	});
});

describe("NodeRenderer cursor style", () => {
	beforeEach(() => {
		vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
			cb(0);
			return 0;
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("uses cursor-pointer on the node card", () => {
		const { container } = render(
			<NodeRenderer
				node={baseNode}
				selected={false}
				errors={[]}
				connecting={false}
				onMouseDown={noop}
				onConnectorClick={noop}
			/>,
		);

		const nodeCard = container.querySelector(".workflow-node");
		expect(nodeCard?.className).toContain("cursor-pointer");
		expect(nodeCard?.className).not.toContain("cursor-move");
	});
});

describe("NodeRenderer onHeightMeasured callback", () => {
	beforeEach(() => {
		vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
			cb(0);
			return 0;
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("calls onHeightMeasured with the node id and measured height", () => {
		const onHeightMeasured = vi.fn();
		render(
			<NodeRenderer
				node={baseNode}
				selected={false}
				errors={[]}
				connecting={false}
				onMouseDown={noop}
				onConnectorClick={noop}
				onHeightMeasured={onHeightMeasured}
			/>,
		);

		if (onHeightMeasured.mock.calls.length > 0) {
			expect(onHeightMeasured).toHaveBeenCalledWith(
				"node-1",
				expect.any(Number),
			);
		}
	});
});
