import type { FormField } from "@/lib/workflow-api/forms";
import type {
	OutputSchema,
	OutputSchemaProperty,
	SchemaPropertyType,
} from "./types";

/**
 * Converts a form field label (English by default) to lowerCamelCase.
 * E.g. "Experience rating" -> "experienceRating"
 * If the result starts with a digit, prefixes with "field".
 */
export function labelToCamelCase(label: string): string {
	if (!label || label.trim().length === 0) {
		return "field";
	}

	const cleaned = label
		.replace(/á/g, "a")
		.replace(/é/g, "e")
		.replace(/í/g, "i")
		.replace(/ó/g, "o")
		.replace(/ú/g, "u")
		.replace(/ñ/g, "n")
		.replace(/Á/g, "A")
		.replace(/É/g, "E")
		.replace(/Í/g, "I")
		.replace(/Ó/g, "O")
		.replace(/Ú/g, "U")
		.replace(/Ñ/g, "N")
		.replace(/['"]/g, "");

	const words = cleaned.split(/[^a-zA-Z0-9]+/).filter((w) => w.length > 0);

	if (words.length === 0) {
		return "field";
	}

	const camelCased = words
		.map((word, index) => {
			if (index === 0) {
				return word.charAt(0).toLowerCase() + word.slice(1).toLowerCase();
			}
			return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
		})
		.join("");

	if (!/^[a-zA-Z_]/.test(camelCased)) {
		return `field${camelCased.charAt(0).toUpperCase()}${camelCased.slice(1)}`;
	}

	return camelCased;
}

/**
 * Maps a form field type to the corresponding output schema property type.
 */
export function formFieldTypeToSchemaType(
	fieldType: string,
): SchemaPropertyType {
	switch (fieldType) {
		case "number":
		case "rating":
			return "number";
		case "checkbox":
			return "boolean";
		case "checkbox-group":
		case "file":
			return "array";
		default:
			return "string";
	}
}

/**
 * Builds an OutputSchema from a form's fields array.
 * Uses the English label to generate lowerCamelCase property names,
 * maps field types to schema types, and sets the label as description.
 * Handles duplicate names by appending a numeric suffix.
 */
export function buildOutputSchemaFromFields(
	fields: FormField[],
	formName: string,
): OutputSchema {
	const seenNames = new Map<string, number>();

	const properties: OutputSchemaProperty[] = fields.map((field) => {
		const baseName = labelToCamelCase(field.label);

		const count = seenNames.get(baseName) ?? 0;
		seenNames.set(baseName, count + 1);
		const name = count === 0 ? baseName : `${baseName}${count + 1}`;

		return {
			id: field.id,
			name,
			type: formFieldTypeToSchemaType(field.type),
			description: field.label,
		};
	});

	return {
		name: `${labelToCamelCase(formName)}Output`,
		properties,
	};
}
