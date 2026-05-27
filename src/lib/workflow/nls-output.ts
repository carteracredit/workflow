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
					id: "nls-matches-match-taxIdNumber",
					name: "taxIdNumber",
					type: "string",
					description: "SSN or ITIN (may be null)",
				},
				{
					id: "nls-matches-match-phone",
					name: "phone",
					type: "string",
					description: "Phone number (may be null)",
				},
				{
					id: "nls-matches-match-email",
					name: "email",
					type: "string",
					description: "Email address (may be null)",
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
					id: "nls-matches-match-preApprovalDate",
					name: "preApprovalDate",
					type: "string",
					description: "ISO date of pre-approval",
				},
				{
					id: "nls-matches-match-passesValidation",
					name: "passesValidation",
					type: "number",
					description: "1 if passes validation, 0 otherwise",
				},
				{
					id: "nls-matches-match-lastPullType",
					name: "lastPullType",
					type: "string",
					description: "Type of the last credit pull (soft/hard/new)",
				},
				{
					id: "nls-matches-match-lastPullAt",
					name: "lastPullAt",
					type: "string",
					description: "ISO date of the last credit pull",
				},
				{
					id: "nls-matches-match-createdAt",
					name: "createdAt",
					type: "string",
					description: "ISO date of the prequalification record",
				},
				{
					id: "nls-matches-match-bureau",
					name: "bureau",
					type: "object",
					description: "Bureau credit data snapshot",
					properties: [
						{
							id: "nls-matches-match-bureau-fico",
							name: "fico",
							type: "number",
							description: "FICO credit score",
						},
						{
							id: "nls-matches-match-bureau-scoreFactor1",
							name: "scoreFactor1",
							type: "string",
							description: "First score factor from bureau",
						},
						{
							id: "nls-matches-match-bureau-scoreFactor2",
							name: "scoreFactor2",
							type: "string",
							description: "Second score factor from bureau",
						},
						{
							id: "nls-matches-match-bureau-scoreFactor3",
							name: "scoreFactor3",
							type: "string",
							description: "Third score factor from bureau",
						},
						{
							id: "nls-matches-match-bureau-scoreFactor4",
							name: "scoreFactor4",
							type: "string",
							description: "Fourth score factor from bureau",
						},
						{
							id: "nls-matches-match-bureau-bankruptcyColor",
							name: "bankruptcyColor",
							type: "string",
							description: "Bankruptcy color indicator",
						},
						{
							id: "nls-matches-match-bureau-mortgageColor",
							name: "mortgageColor",
							type: "string",
							description: "Mortgage color indicator",
						},
						{
							id: "nls-matches-match-bureau-adjudication",
							name: "adjudication",
							type: "string",
							description: "Adjudication result",
						},
						{
							id: "nls-matches-match-bureau-defaults",
							name: "defaults",
							type: "number",
							description: "Number of defaults",
						},
						{
							id: "nls-matches-match-bureau-hasMortgage",
							name: "hasMortgage",
							type: "boolean",
							description: "True if applicant has a mortgage",
						},
						{
							id: "nls-matches-match-bureau-hasBankruptcy",
							name: "hasBankruptcy",
							type: "boolean",
							description: "True if applicant has a bankruptcy",
						},
					],
				},
				{
					id: "nls-matches-match-lastRun",
					name: "lastRun",
					type: "object",
					description: "Latest prequalification run details",
					properties: [
						{
							id: "nls-matches-match-lastRun-runId",
							name: "runId",
							type: "string",
							description: "Run ID",
						},
						{
							id: "nls-matches-match-lastRun-passes",
							name: "passes",
							type: "boolean",
							description: "True if the run passed prequalification",
						},
						{
							id: "nls-matches-match-lastRun-reason",
							name: "reason",
							type: "string",
							description: "Rejection reason if applicable",
						},
						{
							id: "nls-matches-match-lastRun-scoreCardV3",
							name: "scoreCardV3",
							type: "number",
							description: "SageMaker V3 score card number",
						},
						{
							id: "nls-matches-match-lastRun-scoreCardV4",
							name: "scoreCardV4",
							type: "number",
							description: "SageMaker V4 score card number",
						},
						{
							id: "nls-matches-match-lastRun-errorCode",
							name: "errorCode",
							type: "string",
							description: "Error code if an error occurred",
						},
						{
							id: "nls-matches-match-lastRun-executedAt",
							name: "executedAt",
							type: "string",
							description: "ISO date when the run started",
						},
						{
							id: "nls-matches-match-lastRun-completedAt",
							name: "completedAt",
							type: "string",
							description: "ISO date when the run completed",
						},
					],
				},
			],
		},
	},
];

// ── Oleada 1 — Loan Reads ─────────────────────────────────────────────────────

const GET_LOAN_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-getLoan-Loan_Number",
		name: "Loan_Number",
		type: "string",
		description: "Loan number",
		readOnly: true,
	},
	{
		id: "nls-getLoan-Account_Name",
		name: "Account_Name",
		type: "string",
		description: "Account holder name",
		readOnly: true,
	},
	{
		id: "nls-getLoan-Loan_Amount",
		name: "Loan_Amount",
		type: "number",
		description: "Original loan amount",
		readOnly: true,
	},
	{
		id: "nls-getLoan-Interest_Rate",
		name: "Interest_Rate",
		type: "number",
		description: "Loan interest rate",
		readOnly: true,
	},
	{
		id: "nls-getLoan-Origination_Date",
		name: "Origination_Date",
		type: "string",
		description: "Loan origination date",
		readOnly: true,
	},
	{
		id: "nls-getLoan-Maturity_Date",
		name: "Maturity_Date",
		type: "string",
		description: "Loan maturity date",
		readOnly: true,
	},
	{
		id: "nls-getLoan-Current_Balance",
		name: "Current_Balance",
		type: "number",
		description: "Current outstanding balance",
		readOnly: true,
	},
	{
		id: "nls-getLoan-Loan_Status",
		name: "Loan_Status",
		type: "string",
		description: "Current loan status",
		readOnly: true,
	},
];

const GET_LOAN_DETAIL1_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-getLoanDetail1-UserDefined1",
		name: "UserDefined1",
		type: "string",
		description: "User Defined field 1",
		readOnly: true,
	},
	{
		id: "nls-getLoanDetail1-UserDefined2",
		name: "UserDefined2",
		type: "string",
		description: "User Defined field 2",
		readOnly: true,
	},
	{
		id: "nls-getLoanDetail1-UserDefined3",
		name: "UserDefined3",
		type: "string",
		description: "User Defined field 3",
		readOnly: true,
	},
	{
		id: "nls-getLoanDetail1-UserDefined4",
		name: "UserDefined4",
		type: "string",
		description: "User Defined field 4",
		readOnly: true,
	},
	{
		id: "nls-getLoanDetail1-UserDefined5",
		name: "UserDefined5",
		type: "string",
		description: "User Defined field 5",
		readOnly: true,
	},
];

const GET_PAYMENT_INFO_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-getPaymentInfo-Next_Payment_Date",
		name: "Next_Payment_Date",
		type: "string",
		description: "Date of next payment",
		readOnly: true,
	},
	{
		id: "nls-getPaymentInfo-Next_Payment_Total_Amount",
		name: "Next_Payment_Total_Amount",
		type: "number",
		description: "Amount of next payment",
		readOnly: true,
	},
	{
		id: "nls-getPaymentInfo-Past_Due_Amount",
		name: "Past_Due_Amount",
		type: "number",
		description: "Amount currently past due",
		readOnly: true,
	},
	{
		id: "nls-getPaymentInfo-Current_Balance",
		name: "Current_Balance",
		type: "number",
		description: "Current outstanding balance",
		readOnly: true,
	},
];

const GET_COLLECTION_FIELDS_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-getCollectionFields-items",
		name: "items",
		type: "array",
		description: "Array of collection field records",
		readOnly: true,
	},
];

const GET_STATUSES_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-getStatuses-items",
		name: "items",
		type: "array",
		description: "Array of loan status records",
		readOnly: true,
	},
];

const GET_PAYMENT_HISTORY_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-getPaymentHistory-items",
		name: "items",
		type: "array",
		description: "Array of payment history records",
		readOnly: true,
	},
];

const GET_PAYMENTS_DUE_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-getPaymentsDue-items",
		name: "items",
		type: "array",
		description: "Array of upcoming payments due",
		readOnly: true,
	},
];

const GET_PAYOFF_AMOUNTS_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-getPayoffAmounts-items",
		name: "items",
		type: "array",
		description: "Array of payoff amount records by date",
		readOnly: true,
	},
];

const GET_PAYOFF_DETAILS_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-getPayoffDetails-Payoff_Amount",
		name: "Payoff_Amount",
		type: "number",
		description: "Total payoff amount",
		readOnly: true,
	},
	{
		id: "nls-getPayoffDetails-Interest_Due",
		name: "Interest_Due",
		type: "number",
		description: "Interest accrued",
		readOnly: true,
	},
	{
		id: "nls-getPayoffDetails-Fees_Due",
		name: "Fees_Due",
		type: "number",
		description: "Fees due",
		readOnly: true,
	},
	{
		id: "nls-getPayoffDetails-Payoff_Date",
		name: "Payoff_Date",
		type: "string",
		description: "Payoff date used for calculation",
		readOnly: true,
	},
];

// ── Collection Comments ────────────────────────────────────────────────────────

const ADD_COLLECTION_COMMENT_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-addCollectionComment-Row_ID",
		name: "Row_ID",
		type: "string",
		description: "Newly created comment row ID",
		readOnly: true,
	},
];

const UPDATE_COLLECTION_COMMENT_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-updateCollectionComment-Row_ID",
		name: "Row_ID",
		type: "string",
		description: "Updated comment row ID",
		readOnly: true,
	},
];

// ── Contacts & Search ──────────────────────────────────────────────────────────

const GET_CONTACT_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-getContact-Cifnumber",
		name: "Cifnumber",
		type: "string",
		description: "CIF Number",
		readOnly: true,
	},
	{
		id: "nls-getContact-Full_Name",
		name: "Full_Name",
		type: "string",
		description: "Contact full name",
		readOnly: true,
	},
	{
		id: "nls-getContact-Email_Address",
		name: "Email_Address",
		type: "string",
		description: "Contact email address",
		readOnly: true,
	},
	{
		id: "nls-getContact-Phone_Number",
		name: "Phone_Number",
		type: "string",
		description: "Contact phone number",
		readOnly: true,
	},
	{
		id: "nls-getContact-Address1",
		name: "Address1",
		type: "string",
		description: "Street address",
		readOnly: true,
	},
	{
		id: "nls-getContact-City",
		name: "City",
		type: "string",
		description: "City",
		readOnly: true,
	},
	{
		id: "nls-getContact-State_Code",
		name: "State_Code",
		type: "string",
		description: "State code",
		readOnly: true,
	},
	{
		id: "nls-getContact-Zip_Code",
		name: "Zip_Code",
		type: "string",
		description: "Zip code",
		readOnly: true,
	},
];

const SEARCH_CONTACTS_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-searchContacts-items",
		name: "items",
		type: "array",
		description: "Array of matching contact records",
		readOnly: true,
	},
	{
		id: "nls-searchContacts-total",
		name: "total",
		type: "number",
		description: "Number of results returned",
		readOnly: true,
	},
];

const SEARCH_LOANS_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-searchLoans-items",
		name: "items",
		type: "array",
		description: "Array of matching loan records",
		readOnly: true,
	},
	{
		id: "nls-searchLoans-total",
		name: "total",
		type: "number",
		description: "Number of results returned",
		readOnly: true,
	},
];

// ── Calculations ──────────────────────────────────────────────────────────────

const CALCULATE_AMORTIZED_PAYMENT_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-calculateAmortizedPayment-paymentAmount",
		name: "paymentAmount",
		type: "number",
		description: "Calculated periodic payment amount (rounded to 2 decimals)",
		readOnly: true,
	},
];

// ── Nuevas funciones ──────────────────────────────────────────────────────────

const ITEMS_TOTAL_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-itemsTotal-items",
		name: "items",
		type: "array",
		description: "Array of result items",
		readOnly: true,
	},
	{
		id: "nls-itemsTotal-total",
		name: "total",
		type: "number",
		description: "Total count of results",
		readOnly: true,
	},
];

const ADVANCE_PERIOD_OUTPUT: OutputSchemaProperty[] = [
	{
		id: "nls-advancePeriod-date",
		name: "date",
		type: "string",
		description: "Resulting date after advancing the period",
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
	prequalification: PREQUALIFICATION_OUTPUT,
	findPrequalificationMatches: FIND_MATCHES_OUTPUT,
	// Loan Reads
	getLoan: GET_LOAN_OUTPUT,
	getLoanDetail1: GET_LOAN_DETAIL1_OUTPUT,
	getPaymentInfo: GET_PAYMENT_INFO_OUTPUT,
	getCollectionFields: GET_COLLECTION_FIELDS_OUTPUT,
	getStatuses: GET_STATUSES_OUTPUT,
	getPaymentHistory: GET_PAYMENT_HISTORY_OUTPUT,
	getPaymentsDue: GET_PAYMENTS_DUE_OUTPUT,
	getPayoffAmounts: GET_PAYOFF_AMOUNTS_OUTPUT,
	getPayoffDetails: GET_PAYOFF_DETAILS_OUTPUT,
	// Collection Comments
	addCollectionComment: ADD_COLLECTION_COMMENT_OUTPUT,
	updateCollectionComment: UPDATE_COLLECTION_COMMENT_OUTPUT,
	// Contacts & Search
	getContact: GET_CONTACT_OUTPUT,
	searchContacts: SEARCH_CONTACTS_OUTPUT,
	searchLoans: SEARCH_LOANS_OUTPUT,
	// Calculations
	calculateAmortizedPayment: CALCULATE_AMORTIZED_PAYMENT_OUTPUT,
	// Nuevas funciones
	getContactLoans: ITEMS_TOTAL_OUTPUT,
	getContactPortfolio: ITEMS_TOTAL_OUTPUT,
	getContactEmployments: ITEMS_TOTAL_OUTPUT,
	getLoanTransactions: ITEMS_TOTAL_OUTPUT,
	getAmortizationSchedule: ITEMS_TOTAL_OUTPUT,
	advancePeriod: ADVANCE_PERIOD_OUTPUT,
	getLoanStatusCodes: ITEMS_TOTAL_OUTPUT,
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
