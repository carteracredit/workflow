import { describe, expect, it } from "vitest";
import {
	parseTemplateStringToSegments,
	segmentsToTemplateString,
} from "./template-utils";

describe("parseTemplateStringToSegments", () => {
	it("returns empty array for empty/null/undefined input", () => {
		expect(parseTemplateStringToSegments("")).toEqual([]);
		expect(parseTemplateStringToSegments(null)).toEqual([]);
		expect(parseTemplateStringToSegments(undefined)).toEqual([]);
	});

	it("parses a plain text string as a single text segment", () => {
		const segs = parseTemplateStringToSegments("Hello world");
		expect(segs).toHaveLength(1);
		expect(segs[0].type).toBe("text");
		expect(segs[0].value).toBe("Hello world");
	});

	it("parses a single variable reference", () => {
		const segs = parseTemplateStringToSegments("${event.payload.clientName}");
		expect(segs).toHaveLength(1);
		expect(segs[0].type).toBe("variable");
		expect(segs[0].variablePath).toBe("event.payload.clientName");
		expect(segs[0].value).toBe("clientName");
	});

	it("parses mixed text and variable", () => {
		const segs = parseTemplateStringToSegments(
			"Hola ${event.payload.clientFirstName}, tu caso es ${event.payload.caseNumber}",
		);
		expect(segs).toHaveLength(4);
		expect(segs[0]).toMatchObject({ type: "text", value: "Hola " });
		expect(segs[1]).toMatchObject({
			type: "variable",
			variablePath: "event.payload.clientFirstName",
		});
		expect(segs[2]).toMatchObject({ type: "text", value: ", tu caso es " });
		expect(segs[3]).toMatchObject({
			type: "variable",
			variablePath: "event.payload.caseNumber",
		});
	});

	it("parses variable at start followed by text", () => {
		const segs = parseTemplateStringToSegments(
			"${event.payload.productName} - disponible",
		);
		expect(segs).toHaveLength(2);
		expect(segs[0].type).toBe("variable");
		expect(segs[1]).toMatchObject({ type: "text", value: " - disponible" });
	});

	it("preserves a whitespace-only text segment between two variables (regression: space between streetNumber and streetName)", () => {
		const segs = parseTemplateStringToSegments(
			"${event.payload.streetNumber} ${event.payload.streetName}",
		);
		expect(segs).toHaveLength(3);
		expect(segs[0]).toMatchObject({
			type: "variable",
			variablePath: "event.payload.streetNumber",
		});
		expect(segs[1]).toMatchObject({ type: "text", value: " " });
		expect(segs[2]).toMatchObject({
			type: "variable",
			variablePath: "event.payload.streetName",
		});
	});
});

describe("segmentsToTemplateString", () => {
	it("returns empty string for no segments", () => {
		expect(segmentsToTemplateString([])).toBe("");
	});

	it("concatenates text segments", () => {
		const result = segmentsToTemplateString([
			{ id: "1", type: "text", value: "Hello " },
			{ id: "2", type: "text", value: "world" },
		]);
		expect(result).toBe("Hello world");
	});

	it("emits ${variablePath} for variable segments", () => {
		const result = segmentsToTemplateString([
			{
				id: "1",
				type: "variable",
				value: "clientName",
				variablePath: "event.payload.clientName",
			},
		]);
		expect(result).toBe("${event.payload.clientName}");
	});

	it("round-trips through parseTemplateStringToSegments", () => {
		const original =
			"Estimado ${event.payload.clientFirstName}, producto: ${event.payload.productName}";
		const segs = parseTemplateStringToSegments(original);
		const back = segmentsToTemplateString(segs);
		expect(back).toBe(original);
	});

	it("round-trips a whitespace-only segment between two variables (regression: space between streetNumber and streetName)", () => {
		const original =
			"${event.payload.streetNumber} ${event.payload.streetName}";
		const segs = parseTemplateStringToSegments(original);
		const back = segmentsToTemplateString(segs);
		expect(back).toBe(original);
	});
});
