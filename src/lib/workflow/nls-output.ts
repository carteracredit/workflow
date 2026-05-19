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
	{
		id: "nls-createLoan-loanNumber",
		name: "loanNumber",
		type: "string",
		description: "The loan number assigned or generated",
		readOnly: true,
	},
	{
		id: "nls-createLoan-originationDate",
		name: "originationDate",
		type: "string",
		description: "Origination date of the loan",
		readOnly: true,
	},
	{
		id: "nls-createLoan-firstPaymentDate",
		name: "firstPaymentDate",
		type: "string",
		description: "Date of the first payment",
		readOnly: true,
	},
	{
		id: "nls-createLoan-term",
		name: "term",
		type: "number",
		description: "Loan term in months",
		readOnly: true,
	},
	{
		id: "nls-createLoan-loanAmount",
		name: "loanAmount",
		type: "number",
		description: "Loan amount",
		readOnly: true,
	},
	{
		id: "nls-createLoan-interestRate",
		name: "interestRate",
		type: "number",
		description: "Interest rate",
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
	{
		id: "nls-cancelLoan-loanNumber",
		name: "loanNumber",
		type: "string",
		description: "The loan number that was canceled",
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
		id: "nls-amort-CashFlow",
		name: "CashFlow",
		type: "string",
		description: "Cash flow string (date;amount pairs)",
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
	{
		id: "nls-amort-schedule",
		name: "schedule",
		type: "array",
		description: "Full amortization schedule rows",
		readOnly: true,
		items: {
			id: "nls-amort-schedule-item",
			name: "row",
			type: "object",
			properties: [
				{
					id: "nls-amort-schedule-item-PaymentNumber",
					name: "PaymentNumber",
					type: "number",
					description: "Payment number in sequence",
				},
				{
					id: "nls-amort-schedule-item-LoanAmount",
					name: "LoanAmount",
					type: "number",
					description: "Remaining loan amount",
				},
				{
					id: "nls-amort-schedule-item-PaymentDate",
					name: "PaymentDate",
					type: "string",
					description: "Date of the payment",
				},
				{
					id: "nls-amort-schedule-item-PaymentAmount",
					name: "PaymentAmount",
					type: "number",
					description: "Payment amount",
				},
			],
		},
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
