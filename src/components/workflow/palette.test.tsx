import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Palette } from "./palette";

describe("Palette", () => {
	it("renders add buttons for node types", () => {
		render(<Palette onAddNode={vi.fn()} zoom={1} pan={{ x: 0, y: 0 }} />);
		expect(
			screen.getByRole("button", { name: "Agregar Inicio" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Agregar Decisión" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Agregar Fin" }),
		).toBeInTheDocument();
	});

	it("calls onAddNode with new node when Start is clicked", async () => {
		const onAddNode = vi.fn();
		render(<Palette onAddNode={onAddNode} zoom={1} pan={{ x: 0, y: 0 }} />);
		const startBtn = screen.getByRole("button", { name: "Agregar Inicio" });
		fireEvent.click(startBtn);
		expect(onAddNode).toHaveBeenCalledTimes(1);
		const [node] = onAddNode.mock.calls[0];
		expect(node).toBeDefined();
		expect(node.type).toBe("Start");
		expect(node.title).toBe("Inicio");
		expect(typeof node.id).toBe("string");
		expect(node.id).toMatch(/^node-/);
		expect(node.position).toBeDefined();
		expect(node.roles).toEqual([]);
		expect(node.config).toEqual({});
	});

	it("calls onAddNode with Challenge config when Challenge is clicked", async () => {
		const onAddNode = vi.fn();
		render(<Palette onAddNode={onAddNode} zoom={1} pan={{ x: 0, y: 0 }} />);
		const challengeBtn = screen.getByRole("button", {
			name: "Agregar Challenge",
		});
		fireEvent.click(challengeBtn);
		const [node] = onAddNode.mock.calls[0];
		expect(node.type).toBe("Challenge");
		expect(node.config).toMatchObject({
			challengeType: "acceptance",
			deliveryMethod: "none",
		});
	});

	it("calls onAddNode with checkpointType when Checkpoint is clicked", async () => {
		const onAddNode = vi.fn();
		render(<Palette onAddNode={onAddNode} zoom={1} pan={{ x: 0, y: 0 }} />);
		const checkpointBtn = screen.getByRole("button", {
			name: "Agregar Checkpoint",
		});
		fireEvent.click(checkpointBtn);
		const [node] = onAddNode.mock.calls[0];
		expect(node.type).toBe("Checkpoint");
		expect(node.checkpointType).toBe("normal");
	});

	it("applies className to container when provided", () => {
		const { container } = render(
			<Palette
				onAddNode={vi.fn()}
				zoom={1}
				pan={{ x: 0, y: 0 }}
				className="custom-palette"
			/>,
		);
		expect(container.querySelector(".custom-palette")).toBeInTheDocument();
	});
});
