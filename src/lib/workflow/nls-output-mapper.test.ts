import { describe, expect, it } from "vitest";
import type { NlsFunctionOutputField } from "@/lib/workflow-api/nls";
import {
	nlsOutputFieldsToSchema,
	cloneNlsOutputFieldsToSchema,
} from "./nls-output-mapper";

describe("nlsOutputFieldsToSchema", () => {
	it("converts a flat list of fields to OutputSchemaProperty[]", () => {
		const fields: NlsFunctionOutputField[] = [
			{ id: "Loan_Number", label: "Loan Number", type: "string" },
			{ id: "Current_Balance", label: "Current Balance", type: "number" },
			{ id: "Is_Active", label: "Is Active", type: "boolean" },
		];

		const schema = nlsOutputFieldsToSchema(fields, "getLoan");

		expect(schema).toHaveLength(3);
		expect(schema[0]).toMatchObject({
			id: "nls-getLoan-Loan_Number",
			name: "Loan_Number",
			type: "string",
			readOnly: true,
		});
		expect(schema[1]).toMatchObject({
			id: "nls-getLoan-Current_Balance",
			name: "Current_Balance",
			type: "number",
		});
		expect(schema[2]).toMatchObject({
			id: "nls-getLoan-Is_Active",
			name: "Is_Active",
			type: "boolean",
		});
	});

	it("converts array field with items.properties (nested schema)", () => {
		const fields: NlsFunctionOutputField[] = [
			{
				id: "items",
				label: "Loans Array",
				type: "array",
				items: {
					id: "item",
					label: "Loan",
					type: "object",
					properties: [
						{ id: "Loan_Number", label: "Loan Number", type: "string" },
						{ id: "Cifno", label: "CIF No", type: "number" },
						{ id: "Current_Payoff_Balance", label: "Balance", type: "number" },
					],
				},
			},
			{ id: "total", label: "Total Count", type: "number" },
		];

		const schema = nlsOutputFieldsToSchema(fields, "searchLoans");

		expect(schema).toHaveLength(2);

		const itemsField = schema[0];
		expect(itemsField.type).toBe("array");
		expect(itemsField.name).toBe("items");
		expect(itemsField.items).toBeDefined();
		expect(itemsField.items!.type).toBe("object");
		expect(itemsField.items!.properties).toHaveLength(3);
		expect(itemsField.items!.properties![0]).toMatchObject({
			name: "Loan_Number",
			type: "string",
		});
		expect(itemsField.items!.properties![1]).toMatchObject({
			name: "Cifno",
			type: "number",
		});
	});

	it("maps NLS type 'date' → SchemaPropertyType 'string'", () => {
		const fields: NlsFunctionOutputField[] = [
			{ id: "createdAt", label: "Created At", type: "date" },
		];
		const schema = nlsOutputFieldsToSchema(fields, "fn");
		expect(schema[0].type).toBe("string");
	});

	it("maps NLS type 'select' → SchemaPropertyType 'string'", () => {
		const fields: NlsFunctionOutputField[] = [
			{ id: "status", label: "Status", type: "select" },
		];
		const schema = nlsOutputFieldsToSchema(fields, "fn");
		expect(schema[0].type).toBe("string");
	});

	it("maps NLS type 'object' → SchemaPropertyType 'object' with properties", () => {
		const fields: NlsFunctionOutputField[] = [
			{
				id: "bureau",
				label: "Bureau Data",
				type: "object",
				properties: [
					{ id: "fico", label: "FICO", type: "number" },
					{ id: "adjudication", label: "Adjudication", type: "string" },
				],
			},
		];
		const schema = nlsOutputFieldsToSchema(fields, "prequal");
		expect(schema[0].type).toBe("object");
		expect(schema[0].properties).toHaveLength(2);
		expect(schema[0].properties![0].name).toBe("fico");
		expect(schema[0].properties![1].name).toBe("adjudication");
	});

	it("preserves description when present", () => {
		const fields: NlsFunctionOutputField[] = [
			{
				id: "Cifno",
				label: "Cifno",
				type: "number",
				description: "NLS internal contact ID",
			},
		];
		const schema = nlsOutputFieldsToSchema(fields, "search");
		expect(schema[0].description).toBe("NLS internal contact ID");
	});

	it("returns empty array for empty input", () => {
		expect(nlsOutputFieldsToSchema([], "fn")).toEqual([]);
	});
});

describe("cloneNlsOutputFieldsToSchema", () => {
	it("returns a deep-cloned schema safe for mutation", () => {
		const fields: NlsFunctionOutputField[] = [
			{
				id: "items",
				label: "Items",
				type: "array",
				items: {
					id: "item",
					label: "Item",
					type: "object",
					properties: [
						{ id: "Loan_Number", label: "Loan Number", type: "string" },
					],
				},
			},
		];

		const schema1 = cloneNlsOutputFieldsToSchema(fields, "fn");
		const schema2 = cloneNlsOutputFieldsToSchema(fields, "fn");

		// Mutate schema1 — schema2 must be unaffected
		schema1[0].items!.properties!.push({
			id: "extra",
			name: "extra",
			type: "string",
			readOnly: true,
		});

		expect(schema2[0].items!.properties).toHaveLength(1);
	});
});

describe("nlsOutputFieldsToSchema — searchLoans integration fixture", () => {
	it("items[0].Loan_Number is reachable in the generated schema", () => {
		const loanSearchVm: NlsFunctionOutputField[] = [
			{ id: "Acctrefno", label: "Acctrefno", type: "number" },
			{ id: "Loan_Number", label: "Loan Number", type: "string" },
			{ id: "Cifno", label: "Cifno", type: "number" },
			{ id: "Cifnumber", label: "CIF Number", type: "string" },
			{ id: "Name", label: "Name", type: "string" },
			{ id: "Status_Code_No", label: "Status Code No", type: "number" },
			{
				id: "Current_Payoff_Balance",
				label: "Current Payoff Balance",
				type: "number",
			},
			{ id: "Days_Past_Due", label: "Days Past Due", type: "number" },
		];

		const searchLoansFields: NlsFunctionOutputField[] = [
			{
				id: "items",
				label: "Loans Array",
				type: "array",
				items: {
					id: "item",
					label: "Loan",
					type: "object",
					properties: loanSearchVm,
				},
			},
			{ id: "total", label: "Total Count", type: "number" },
		];

		const schema = nlsOutputFieldsToSchema(searchLoansFields, "searchLoans");
		const itemsField = schema.find((f) => f.name === "items");
		expect(itemsField).toBeDefined();
		expect(itemsField!.type).toBe("array");

		const itemProps = itemsField!.items?.properties ?? [];
		const ids = itemProps.map((p) => p.name);
		expect(ids).toContain("Loan_Number");
		expect(ids).toContain("Cifno");
		expect(ids).toContain("Name");
		expect(ids).toContain("Current_Payoff_Balance");
	});
});
