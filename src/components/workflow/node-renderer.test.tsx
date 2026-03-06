import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { NodeRenderer } from "./node-renderer";
import type { WorkflowNode } from "@/lib/workflow/types";

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
