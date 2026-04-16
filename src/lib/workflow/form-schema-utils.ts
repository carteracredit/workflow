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
 * Compound field types (name, address) map to "object".
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
		case "name":
		case "address":
			return "object";
		default:
			return "string";
	}
}

/**
 * Generates a unique property id for compound sub-fields.
 */
function makeSubPropId(fieldId: string, subName: string): string {
	return `${fieldId}_${subName}`;
}

/**
 * Returns the sub-properties for a compound field type.
 * For "name" fields, `includeMiddleName` controls whether middleName is included.
 * Returns null for non-compound field types.
 */
export function getCompoundFieldSubProperties(
	fieldId: string,
	fieldType: string,
	fieldProperties?: { includeMiddleName?: boolean },
): OutputSchemaProperty[] | null {
	if (fieldType === "name") {
		const props: OutputSchemaProperty[] = [
			{
				id: makeSubPropId(fieldId, "firstName"),
				name: "firstName",
				type: "string",
				description: "First name",
			},
			{
				id: makeSubPropId(fieldId, "lastName"),
				name: "lastName",
				type: "string",
				description: "Last name",
			},
			{
				id: makeSubPropId(fieldId, "fullName"),
				name: "fullName",
				type: "string",
				description: "Full name (computed)",
			},
		];
		if (fieldProperties?.includeMiddleName) {
			props.splice(2, 0, {
				id: makeSubPropId(fieldId, "middleName"),
				name: "middleName",
				type: "string",
				description: "Middle name",
			});
		}
		return props;
	}
	if (fieldType === "address") {
		return [
			{
				id: makeSubPropId(fieldId, "street"),
				name: "street",
				type: "string",
				description: "Street address",
			},
			{
				id: makeSubPropId(fieldId, "street2"),
				name: "street2",
				type: "string",
				description: "Street address line 2",
			},
			{
				id: makeSubPropId(fieldId, "city"),
				name: "city",
				type: "string",
				description: "City",
			},
			{
				id: makeSubPropId(fieldId, "state"),
				name: "state",
				type: "string",
				description: "State / Province",
			},
			{
				id: makeSubPropId(fieldId, "zip"),
				name: "zip",
				type: "string",
				description: "ZIP / Postal code",
			},
			{
				id: makeSubPropId(fieldId, "country"),
				name: "country",
				type: "string",
				description: "Country",
			},
			{
				id: makeSubPropId(fieldId, "fullAddress"),
				name: "fullAddress",
				type: "string",
				description: "Full address (computed)",
			},
		];
	}
	return null;
}

/**
 * Builds an OutputSchema from a form's fields array.
 * Uses the English label to generate lowerCamelCase property names,
 * maps field types to schema types, and sets the label as description.
 * Handles duplicate names by appending a numeric suffix.
 * Compound fields (name, address) are expanded to nested object properties.
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

		const schemaType = formFieldTypeToSchemaType(field.type);
		const subProperties = getCompoundFieldSubProperties(
			field.id,
			field.type,
			field.properties,
		);

		const prop: OutputSchemaProperty = {
			id: field.id,
			name,
			type: schemaType,
			description: field.label,
		};

		if (subProperties) {
			prop.properties = subProperties;
		}

		return prop;
	});

	return {
		name: `${labelToCamelCase(formName)}Output`,
		properties,
	};
}
