import type { OutputSchemaProperty } from "./types";

/**
 * Fixed output schema exposed by every GeneratePDF node so downstream nodes
 * can reference the generated document through the VariablePicker, e.g.
 * `${generatePdf-123.documentId}`.
 *
 * These fields are populated by the code generator right after
 * `CASES_SVC.generatePdfDocument(...)`, which fills the selected PDF
 * template's AcroForm fields, flattens it, and uploads the result to
 * doc-svc.
 *
 * All entries are marked `readOnly: true` so the properties panel can render
 * them as fixed, non-editable fields (consistent with PROMOTION_OUTPUT_SCHEMA
 * and CHALLENGE_OUTPUT_SCHEMA).
 */
export const GENERATE_PDF_OUTPUT_SCHEMA: OutputSchemaProperty[] = [
	{
		id: "generate-pdf-out-documentId",
		name: "documentId",
		type: "string",
		description: "doc-svc identifier of the generated (flattened) PDF",
		readOnly: true,
	},
	{
		id: "generate-pdf-out-fileName",
		name: "fileName",
		type: "string",
		description: "File name assigned to the generated PDF",
		readOnly: true,
	},
];

/**
 * Returns a fresh deep copy of GENERATE_PDF_OUTPUT_SCHEMA. Use this whenever
 * merging with user-defined properties so consumers never mutate the shared
 * catalog.
 */
export function cloneGeneratePdfOutputSchema(): OutputSchemaProperty[] {
	return GENERATE_PDF_OUTPUT_SCHEMA.map(cloneProperty);
}

function cloneProperty(prop: OutputSchemaProperty): OutputSchemaProperty {
	const copy: OutputSchemaProperty = { ...prop };
	if (prop.properties) {
		copy.properties = prop.properties.map(cloneProperty);
	}
	if (prop.items) {
		copy.items = cloneProperty(prop.items);
	}
	if (prop.enumValues) {
		copy.enumValues = [...prop.enumValues];
	}
	return copy;
}
