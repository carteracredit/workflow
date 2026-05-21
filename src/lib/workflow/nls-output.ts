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

const PREQUALIFICATION_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-prequal-runId",
		name: "runId",
		type: "string",
		description: "Unique identifier for this prequalification run",
		readOnly: true,
	},
	{
		id: "nls-prequal-passes",
		name: "passes",
		type: "boolean",
		description: "True if the applicant passed prequalification rules",
		readOnly: true,
	},
	{
		id: "nls-prequal-reason",
		name: "reason",
		type: "string",
		description: "Rejection reason if passes is false",
		readOnly: true,
	},
	{
		id: "nls-prequal-scoreCardV3",
		name: "scoreCardV3",
		type: "number",
		description: "SageMaker V3 score card number",
		readOnly: true,
	},
	{
		id: "nls-prequal-scoreCardV4",
		name: "scoreCardV4",
		type: "number",
		description: "SageMaker V4 score card number",
		readOnly: true,
	},
	{
		id: "nls-prequal-errorCode",
		name: "errorCode",
		type: "string",
		description: "Error code if an error occurred during prequalification",
		readOnly: true,
	},
	{
		id: "nls-prequal-requestedPullType",
		name: "requestedPullType",
		type: "string",
		description: "The credit pull type that was requested (soft/hard/new)",
		readOnly: true,
	},
	{
		id: "nls-prequal-actualPullType",
		name: "actualPullType",
		type: "string",
		description: "The credit pull type that was actually performed",
		readOnly: true,
	},
	{
		id: "nls-prequal-reusedSoftPull",
		name: "reusedSoftPull",
		type: "boolean",
		description: "True if a previous soft pull was reused",
		readOnly: true,
	},
	{
		id: "nls-prequal-actorType",
		name: "actorType",
		type: "string",
		description: "Actor type used: applicant or coapplicant",
		readOnly: true,
	},
	{
		id: "nls-prequal-cifNumber",
		name: "cifNumber",
		type: "string",
		description: "The CIF number used for NLS operations",
		readOnly: true,
	},
	{
		id: "nls-prequal-preApprovalResult",
		name: "preApprovalResult",
		type: "number",
		description:
			"Score card number for approved, or global reject number for denied",
		readOnly: true,
	},
	{
		id: "nls-prequal-preApprovalDate",
		name: "preApprovalDate",
		type: "string",
		description: "ISO date string when the prequalification completed",
		readOnly: true,
	},
	{
		id: "nls-prequal-passesValidation",
		name: "passesValidation",
		type: "number",
		description: "1 if passes validation, 0 otherwise",
		readOnly: true,
	},
	{
		id: "nls-prequal-bureau",
		name: "bureau",
		type: "object",
		description: "Bureau credit data snapshot",
		readOnly: true,
		properties: [
			{
				id: "nls-prequal-bureau-fico",
				name: "fico",
				type: "number",
				description: "FICO credit score",
			},
			{
				id: "nls-prequal-bureau-scoreFactor1",
				name: "scoreFactor1",
				type: "string",
				description: "First score factor from bureau",
			},
			{
				id: "nls-prequal-bureau-scoreFactor2",
				name: "scoreFactor2",
				type: "string",
				description: "Second score factor from bureau",
			},
			{
				id: "nls-prequal-bureau-scoreFactor3",
				name: "scoreFactor3",
				type: "string",
				description: "Third score factor from bureau",
			},
			{
				id: "nls-prequal-bureau-scoreFactor4",
				name: "scoreFactor4",
				type: "string",
				description: "Fourth score factor from bureau",
			},
			{
				id: "nls-prequal-bureau-bankruptcyColor",
				name: "bankruptcyColor",
				type: "string",
				description: "Bankruptcy color indicator (green/yellow/red)",
			},
			{
				id: "nls-prequal-bureau-mortgageColor",
				name: "mortgageColor",
				type: "string",
				description: "Mortgage color indicator (green/yellow/red)",
			},
			{
				id: "nls-prequal-bureau-adjudication",
				name: "adjudication",
				type: "string",
				description: "Adjudication result",
			},
			{
				id: "nls-prequal-bureau-defaults",
				name: "defaults",
				type: "number",
				description: "Number of defaults",
			},
			{
				id: "nls-prequal-bureau-hasMortgage",
				name: "hasMortgage",
				type: "boolean",
				description: "True if applicant has a mortgage",
			},
			{
				id: "nls-prequal-bureau-hasBankruptcy",
				name: "hasBankruptcy",
				type: "boolean",
				description: "True if applicant has a bankruptcy",
			},
		],
	},
];

const FIND_MATCHES_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-matches-matches",
		name: "matches",
		type: "array",
		description: "Array of matching prequalification records",
		readOnly: true,
		items: {
			id: "nls-matches-match-item",
			name: "match",
			type: "object",
			properties: [
				{
					id: "nls-matches-match-prequalificationId",
					name: "prequalificationId",
					type: "string",
					description: "Prequalification record ID",
				},
				{
					id: "nls-matches-match-actorType",
					name: "actorType",
					type: "string",
					description: "Actor type (applicant or coapplicant)",
				},
				{
					id: "nls-matches-match-userId",
					name: "userId",
					type: "string",
					description: "User ID (may be null)",
				},
				{
					id: "nls-matches-match-cifNumber",
					name: "cifNumber",
					type: "string",
					description: "CIF number",
				},
				{
					id: "nls-matches-match-preApprovalResult",
					name: "preApprovalResult",
					type: "number",
					description: "Pre-approval score result",
				},
				{
					id: "nls-matches-match-passesValidation",
					name: "passesValidation",
					type: "number",
					description: "1 if passes validation, 0 otherwise",
				},
				{
					id: "nls-matches-match-createdAt",
					name: "createdAt",
					type: "string",
					description: "ISO date of the prequalification record",
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
	prequalification: PREQUALIFICATION_OUTPUT,
	findPrequalificationMatches: FIND_MATCHES_OUTPUT,
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
