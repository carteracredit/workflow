/**
 * Converts the NLS function output fields returned by proxy-svc into the
 * OutputSchemaProperty[] format expected by the workflow editor's variable
 * picker and graph utilities.
 *
 * This replaces the hardcoded nls-output.ts catalog: proxy-svc is now the
 * single source of truth for NLS output schemas.
 */

import type { NlsFunctionOutputField } from "@/lib/workflow-api/nls";
import type { OutputSchemaProperty, SchemaPropertyType } from "./types";

function toSchemaType(nlsType: string): SchemaPropertyType {
	switch (nlsType) {
		case "number":
			return "number";
		case "boolean":
			return "boolean";
		case "array":
			return "array";
		case "object":
			return "object";
		case "enum":
			return "enum";
		// "string" | "date" | "select" and anything unknown → "string"
		default:
			return "string";
	}
}

function fieldToProperty(
	field: NlsFunctionOutputField,
	functionId: string,
): OutputSchemaProperty {
	const prop: OutputSchemaProperty = {
		id: `nls-${functionId}-${field.id}`,
		name: field.id,
		type: toSchemaType(field.type),
		readOnly: true,
	};

	if (field.description) {
		prop.description = field.description;
	}

	if (field.type === "array" && field.items) {
		prop.items = fieldToProperty(field.items, `${functionId}-${field.id}`);
	}

	if (field.type === "object" && field.properties) {
		prop.properties = field.properties.map((p) =>
			fieldToProperty(p, `${functionId}-${field.id}`),
		);
	}

	return prop;
}

/**
 * Converts NlsFunctionOutputField[] (from proxy-svc API response) into
 * OutputSchemaProperty[] (used by the workflow variable picker and graph utils).
 *
 * @param fields   outputFields array from NlsFunctionDetail or NlsFunctionSummary
 * @param functionId  the NLS function ID, used to generate unique property IDs
 */
export function nlsOutputFieldsToSchema(
	fields: NlsFunctionOutputField[],
	functionId = "nls",
): OutputSchemaProperty[] {
	return fields.map((f) => fieldToProperty(f, functionId));
}

function cloneProperty(prop: OutputSchemaProperty): OutputSchemaProperty {
	const copy: OutputSchemaProperty = { ...prop };
	if (prop.properties) copy.properties = prop.properties.map(cloneProperty);
	if (prop.items) copy.items = cloneProperty(prop.items);
	if (prop.enumValues) copy.enumValues = [...prop.enumValues];
	return copy;
}

/**
 * Same as nlsOutputFieldsToSchema, but returns deep-cloned objects safe for
 * mutation (needed by graph-utils mergePropertiesByName).
 */
export function cloneNlsOutputFieldsToSchema(
	fields: NlsFunctionOutputField[],
	functionId = "nls",
): OutputSchemaProperty[] {
	return nlsOutputFieldsToSchema(fields, functionId).map(cloneProperty);
}
