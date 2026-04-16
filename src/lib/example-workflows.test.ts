import { describe, it, expect } from "vitest";
import { EXAMPLE_WORKFLOWS } from "./example-workflows";

describe("EXAMPLE_WORKFLOWS", () => {
	it("exports basic, api, and manual workflow templates", () => {
		expect(EXAMPLE_WORKFLOWS).toHaveProperty("basic");
		expect(EXAMPLE_WORKFLOWS).toHaveProperty("api");
		expect(EXAMPLE_WORKFLOWS).toHaveProperty("manual");
	});

	it("basic has nodes and edges with expected shape", () => {
		const { basic } = EXAMPLE_WORKFLOWS;
		expect(basic.nodes).toBeDefined();
		expect(Array.isArray(basic.nodes)).toBe(true);
		expect(basic.nodes.length).toBeGreaterThan(0);
		expect(basic.nodes[0]).toMatchObject({
			id: expect.any(String),
			type: expect.any(String),
			title: expect.any(String),
			position: expect.objectContaining({
				x: expect.any(Number),
				y: expect.any(Number),
			}),
		});

		expect(basic.edges).toBeDefined();
		expect(Array.isArray(basic.edges)).toBe(true);
		expect(basic.edges[0]).toMatchObject({
			id: expect.any(String),
			from: expect.any(String),
			to: expect.any(String),
		});
	});

	it("api has nodes and edges", () => {
		const { api } = EXAMPLE_WORKFLOWS;
		expect(api.nodes.length).toBeGreaterThan(0);
		expect(api.edges.length).toBeGreaterThan(0);
	});

	it("manual has nodes and edges", () => {
		const { manual } = EXAMPLE_WORKFLOWS;
		expect(manual.nodes.length).toBeGreaterThan(0);
		expect(manual.edges.length).toBeGreaterThan(0);
	});
});
