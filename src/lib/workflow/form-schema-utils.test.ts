import { describe, it, expect } from "vitest";
import {
	labelToCamelCase,
	formFieldTypeToSchemaType,
	buildOutputSchemaFromFields,
	getCompoundFieldSubProperties,
} from "./form-schema-utils";
import type { FormField } from "@/lib/workflow-api/forms";

describe("labelToCamelCase", () => {
	it("converts a simple two-word label", () => {
		expect(labelToCamelCase("Experience rating")).toBe("experienceRating");
	});

	it("converts a single word", () => {
		expect(labelToCamelCase("Email")).toBe("email");
	});

	it("converts multiple words", () => {
		expect(labelToCamelCase("Service quality score")).toBe(
			"serviceQualityScore",
		);
	});

	it("strips accent characters", () => {
		expect(labelToCamelCase("Calificación de servicio")).toBe(
			"calificacionDeServicio",
		);
	});

	it("strips accent uppercase characters", () => {
		expect(labelToCamelCase("Óptica Ñoño")).toBe("opticaNono");
	});

	it("handles labels with numbers in the middle", () => {
		expect(labelToCamelCase("Field 1 value")).toBe("field1Value");
	});

	it("prefixes with 'field' when label starts with a digit", () => {
		expect(labelToCamelCase("1st name")).toBe("field1stName");
	});

	it("strips special leading character and uses the word normally", () => {
		expect(labelToCamelCase("@handle")).toBe("handle");
	});

	it("returns 'field' for an empty string", () => {
		expect(labelToCamelCase("")).toBe("field");
	});

	it("returns 'field' for a whitespace-only string", () => {
		expect(labelToCamelCase("   ")).toBe("field");
	});

	it("returns 'field' for a string with only special characters", () => {
		expect(labelToCamelCase("@#$%")).toBe("field");
	});

	it("strips single and double quotes", () => {
		expect(labelToCamelCase("User's name")).toBe("usersName");
	});

	it("handles multiple consecutive separators", () => {
		expect(labelToCamelCase("first -- name")).toBe("firstName");
	});
});

describe("formFieldTypeToSchemaType", () => {
	it("maps rating to number", () => {
		expect(formFieldTypeToSchemaType("rating")).toBe("number");
	});

	it("maps number to number", () => {
		expect(formFieldTypeToSchemaType("number")).toBe("number");
	});

	it("maps checkbox to boolean", () => {
		expect(formFieldTypeToSchemaType("checkbox")).toBe("boolean");
	});

	it("maps checkbox-group to array", () => {
		expect(formFieldTypeToSchemaType("checkbox-group")).toBe("array");
	});

	it("maps file to array", () => {
		expect(formFieldTypeToSchemaType("file")).toBe("array");
	});

	it("maps text to string", () => {
		expect(formFieldTypeToSchemaType("text")).toBe("string");
	});

	it("maps email to string", () => {
		expect(formFieldTypeToSchemaType("email")).toBe("string");
	});

	it("maps date to string", () => {
		expect(formFieldTypeToSchemaType("date")).toBe("string");
	});

	it("maps phone to string", () => {
		expect(formFieldTypeToSchemaType("phone")).toBe("string");
	});

	it("maps unknown type to string", () => {
		expect(formFieldTypeToSchemaType("unknown-type")).toBe("string");
	});

	it("maps name to object", () => {
		expect(formFieldTypeToSchemaType("name")).toBe("object");
	});

	it("maps address to object", () => {
		expect(formFieldTypeToSchemaType("address")).toBe("object");
	});
});

describe("getCompoundFieldSubProperties", () => {
	it("returns null for non-compound field types", () => {
		expect(getCompoundFieldSubProperties("f1", "text")).toBeNull();
		expect(getCompoundFieldSubProperties("f1", "email")).toBeNull();
		expect(getCompoundFieldSubProperties("f1", "number")).toBeNull();
		expect(getCompoundFieldSubProperties("f1", "date")).toBeNull();
	});

	it("returns firstName, lastName, fullName for name field without middleName", () => {
		const props = getCompoundFieldSubProperties("f1", "name");
		expect(props).not.toBeNull();
		const names = props!.map((p) => p.name);
		expect(names).toEqual(["firstName", "lastName", "fullName"]);
		expect(props!.every((p) => p.type === "string")).toBe(true);
	});

	it("includes middleName when includeMiddleName is true", () => {
		const props = getCompoundFieldSubProperties("f1", "name", {
			includeMiddleName: true,
		});
		expect(props).not.toBeNull();
		const names = props!.map((p) => p.name);
		expect(names).toEqual(["firstName", "lastName", "middleName", "fullName"]);
	});

	it("does not include middleName when includeMiddleName is false", () => {
		const props = getCompoundFieldSubProperties("f1", "name", {
			includeMiddleName: false,
		});
		expect(props).not.toBeNull();
		const names = props!.map((p) => p.name);
		expect(names).not.toContain("middleName");
	});

	it("uses fieldId as prefix for sub-property ids", () => {
		const props = getCompoundFieldSubProperties("myField123", "name");
		expect(props![0].id).toBe("myField123_firstName");
		expect(props![1].id).toBe("myField123_lastName");
	});

	it("returns all address sub-fields", () => {
		const props = getCompoundFieldSubProperties("f2", "address");
		expect(props).not.toBeNull();
		const names = props!.map((p) => p.name);
		expect(names).toEqual([
			"street",
			"street2",
			"city",
			"state",
			"zip",
			"country",
			"fullAddress",
		]);
		expect(props!.every((p) => p.type === "string")).toBe(true);
	});
});

describe("buildOutputSchemaFromFields", () => {
	const makeField = (
		overrides: Partial<FormField> & { id: string; label: string },
	): FormField => ({
		type: "text",
		required: false,
		...overrides,
	});

	it("builds schema name from form name in camelCase", () => {
		const result = buildOutputSchemaFromFields([], "My Form");
		expect(result.name).toBe("myFormOutput");
	});

	it("creates a property per field", () => {
		const fields = [
			makeField({ id: "f1", label: "Experience rating", type: "rating" }),
			makeField({ id: "f2", label: "Email", type: "email" }),
		];
		const result = buildOutputSchemaFromFields(fields, "rating");
		expect(result.properties).toHaveLength(2);
	});

	it("sets property id to field id", () => {
		const fields = [makeField({ id: "f-abc-123", label: "Experience rating" })];
		const result = buildOutputSchemaFromFields(fields, "form");
		expect(result.properties[0].id).toBe("f-abc-123");
	});

	it("converts label to lowerCamelCase name", () => {
		const fields = [
			makeField({ id: "f1", label: "Experience rating", type: "rating" }),
		];
		const result = buildOutputSchemaFromFields(fields, "form");
		expect(result.properties[0].name).toBe("experienceRating");
	});

	it("maps field type correctly", () => {
		const fields = [
			makeField({ id: "f1", label: "Score", type: "rating" }),
			makeField({ id: "f2", label: "Accepted", type: "checkbox" }),
			makeField({ id: "f3", label: "Tags", type: "checkbox-group" }),
			makeField({ id: "f4", label: "Name", type: "text" }),
		];
		const result = buildOutputSchemaFromFields(fields, "form");
		expect(result.properties[0].type).toBe("number");
		expect(result.properties[1].type).toBe("boolean");
		expect(result.properties[2].type).toBe("array");
		expect(result.properties[3].type).toBe("string");
	});

	it("sets description to the field label", () => {
		const fields = [makeField({ id: "f1", label: "Experience rating" })];
		const result = buildOutputSchemaFromFields(fields, "form");
		expect(result.properties[0].description).toBe("Experience rating");
	});

	it("handles duplicate labels by appending numeric suffix", () => {
		const fields = [
			makeField({ id: "f1", label: "Rating" }),
			makeField({ id: "f2", label: "Rating" }),
			makeField({ id: "f3", label: "Rating" }),
		];
		const result = buildOutputSchemaFromFields(fields, "form");
		expect(result.properties[0].name).toBe("rating");
		expect(result.properties[1].name).toBe("rating2");
		expect(result.properties[2].name).toBe("rating3");
	});

	it("returns empty properties for empty fields array", () => {
		const result = buildOutputSchemaFromFields([], "form");
		expect(result.properties).toHaveLength(0);
	});

	it("builds the rating form example correctly", () => {
		const fields = [
			makeField({
				id: "f1773338729299",
				label: "Experience rating",
				type: "rating",
			}),
			makeField({
				id: "f1773338756025",
				label: "Service rating",
				type: "rating",
			}),
			makeField({ id: "f1773340849081", label: "Email", type: "email" }),
		];
		const result = buildOutputSchemaFromFields(fields, "rating");
		expect(result.name).toBe("ratingOutput");
		expect(result.properties[0]).toMatchObject({
			id: "f1773338729299",
			name: "experienceRating",
			type: "number",
			description: "Experience rating",
		});
		expect(result.properties[1]).toMatchObject({
			id: "f1773338756025",
			name: "serviceRating",
			type: "number",
			description: "Service rating",
		});
		expect(result.properties[2]).toMatchObject({
			id: "f1773340849081",
			name: "email",
			type: "string",
			description: "Email",
		});
	});

	it("expands name field to object type with sub-properties", () => {
		const fields = [makeField({ id: "f1", label: "User Name", type: "name" })];
		const result = buildOutputSchemaFromFields(fields, "form");
		const prop = result.properties[0];
		expect(prop.type).toBe("object");
		expect(prop.properties).toBeDefined();
		const subNames = prop.properties!.map((p) => p.name);
		expect(subNames).toContain("firstName");
		expect(subNames).toContain("lastName");
		expect(subNames).toContain("fullName");
		expect(subNames).not.toContain("middleName");
	});

	it("includes middleName sub-property when includeMiddleName is true", () => {
		const fields = [
			makeField({
				id: "f1",
				label: "Full Name",
				type: "name",
				properties: { includeMiddleName: true },
			}),
		];
		const result = buildOutputSchemaFromFields(fields, "form");
		const prop = result.properties[0];
		expect(prop.type).toBe("object");
		const subNames = prop.properties!.map((p) => p.name);
		expect(subNames).toContain("middleName");
	});

	it("expands address field to object type with sub-properties", () => {
		const fields = [
			makeField({ id: "f2", label: "Home Address", type: "address" }),
		];
		const result = buildOutputSchemaFromFields(fields, "form");
		const prop = result.properties[0];
		expect(prop.type).toBe("object");
		expect(prop.properties).toBeDefined();
		const subNames = prop.properties!.map((p) => p.name);
		expect(subNames).toEqual([
			"street",
			"street2",
			"city",
			"state",
			"zip",
			"country",
			"fullAddress",
		]);
	});

	it("name field has no properties key for non-compound field", () => {
		const fields = [makeField({ id: "f1", label: "Email", type: "email" })];
		const result = buildOutputSchemaFromFields(fields, "form");
		expect(result.properties[0].properties).toBeUndefined();
	});
});
