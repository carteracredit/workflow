import type { OutputSchemaProperty } from "./types";
import type { NLSFunctionId } from "./types";

const CREATE_LOAN_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-createLoan-success",
		name: "success",
		type: "boolean",
		description: "True when the loan was created successfully in NLS",
		readOnly: true,
	},
];

const CANCEL_LOAN_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-cancelLoan-success",
		name: "success",
		type: "boolean",
		description: "True when the loan was canceled successfully in NLS",
		readOnly: true,
	},
];

const GET_AMORTIZATION_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-amort-LoanAmount",
		name: "LoanAmount",
		type: "number",
		description: "Total loan amount from amortization schedule",
		readOnly: true,
	},
	{
		id: "nls-amort-totalOfPayments",
		name: "totalOfPayments",
		type: "number",
		description: "Sum of all payment amounts",
		readOnly: true,
	},
	{
		id: "nls-amort-regularPaymentAmount",
		name: "regularPaymentAmount",
		type: "number",
		description: "Amount of the first (regular) payment",
		readOnly: true,
	},
	{
		id: "nls-amort-firstPaymentApr",
		name: "firstPaymentApr",
		type: "string",
		description: "Date of the first payment",
		readOnly: true,
	},
	{
		id: "nls-amort-lastPaymentAmount",
		name: "lastPaymentAmount",
		type: "number",
		description: "Amount of the last payment",
		readOnly: true,
	},
	{
		id: "nls-amort-lastPaymentDate",
		name: "lastPaymentDate",
		type: "string",
		description: "Date of the last payment",
		readOnly: true,
	},
	{
		id: "nls-amort-OriginationDate",
		name: "OriginationDate",
		type: "string",
		description: "Origination date used for APR computation",
		readOnly: true,
	},
	{
		id: "nls-amort-apr",
		name: "apr",
		type: "number",
		description: "Computed Annual Percentage Rate",
		readOnly: true,
	},
];

export const NLS_FUNCTION_OUTPUT_SCHEMAS: Record<
	NLSFunctionId,
	OutputSchemaProperty[]
> = {
	createLoan: CREATE_LOAN_OUTPUT,
	cancelLoan: CANCEL_LOAN_OUTPUT,
	getAmortization: GET_AMORTIZATION_OUTPUT,
};

export function getNlsOutputSchema(
	functionId?: NLSFunctionId,
): OutputSchemaProperty[] {
	if (!functionId) return [];
	return NLS_FUNCTION_OUTPUT_SCHEMAS[functionId] ?? [];
}

function cloneProperty(prop: OutputSchemaProperty): OutputSchemaProperty {
	const copy: OutputSchemaProperty = { ...prop };
	if (prop.properties) copy.properties = prop.properties.map(cloneProperty);
	if (prop.items) copy.items = cloneProperty(prop.items);
	if (prop.enumValues) copy.enumValues = [...prop.enumValues];
	return copy;
}

export function cloneNlsOutputSchema(
	functionId?: NLSFunctionId,
): OutputSchemaProperty[] {
	return getNlsOutputSchema(functionId).map(cloneProperty);
}
