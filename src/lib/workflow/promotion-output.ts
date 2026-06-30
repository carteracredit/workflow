import type { OutputSchemaProperty } from "./types";

/**
 * Fixed output schema exposed by every Promotion node so downstream nodes can
 * reference the selected promotion outcome (promotionId, selectedTerm,
 * monthlyPayment, etc.) through the VariablePicker, e.g.
 * `${promotion-123.monthlyPayment}`.
 *
 * These fields are populated by the code generator right after
 * `step.waitForEvent(...)`; the event payload comes from `cases-svc` when the
 * user confirms a promotion selection.
 *
 * All entries are marked `readOnly: true` so the properties panel can render
 * them as fixed, non-editable fields (consistent with CASE_VARIABLES and
 * CHALLENGE_OUTPUT_SCHEMA).
 */
export const PROMOTION_OUTPUT_SCHEMA: OutputSchemaProperty[] = [
	{
		id: "promotion-out-promotionId",
		name: "promotionId",
		type: "string",
		description: "Identifier of the promotion selected by the user",
		readOnly: true,
	},
	{
		id: "promotion-out-promotionName",
		name: "promotionName",
		type: "string",
		description: "Human-readable name of the selected promotion",
		readOnly: true,
	},
	{
		id: "promotion-out-selectedTerm",
		name: "selectedTerm",
		type: "number",
		description: "Financing term in months selected by the user (12-60)",
		readOnly: true,
	},
	{
		id: "promotion-out-finalAmount",
		name: "finalAmount",
		type: "number",
		description:
			"Requested amount after the user's adjustment inside the Promotion node",
		readOnly: true,
	},
	{
		id: "promotion-out-monthlyPayment",
		name: "monthlyPayment",
		type: "number",
		description:
			"Monthly payment computed with the PMT formula using the selected promotion, term and commission",
		readOnly: true,
	},
	{
		id: "promotion-out-interestRate",
		name: "interestRate",
		type: "number",
		description: "Annual interest rate (percentage) of the selected promotion",
		readOnly: true,
	},
	{
		id: "promotion-out-downPayment",
		name: "downPayment",
		type: "number",
		description: "Down payment taken from the selected promotion",
		readOnly: true,
	},
	{
		id: "promotion-out-contractorFee",
		name: "contractorFee",
		type: "number",
		description: "Contractor/dealer fee taken from the selected promotion",
		readOnly: true,
	},
	{
		id: "promotion-out-commission",
		name: "commission",
		type: "number",
		description:
			"Commission resolved from the promotion's condition (operator + threshold vs requestedAmount) at selection time",
		readOnly: true,
	},
	{
		id: "promotion-out-selectedBy",
		name: "selectedBy",
		type: "string",
		description: "Identifier of the user who selected the promotion",
		readOnly: true,
	},
	{
		id: "promotion-out-selectedAt",
		name: "selectedAt",
		type: "string",
		description: "ISO timestamp when the selection was recorded",
		readOnly: true,
	},
];

/**
 * Returns a fresh deep copy of PROMOTION_OUTPUT_SCHEMA. Use this whenever
 * merging with user-defined properties so consumers never mutate the shared
 * catalog.
 */
export function clonePromotionOutputSchema(): OutputSchemaProperty[] {
	return PROMOTION_OUTPUT_SCHEMA.map(cloneProperty);
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
