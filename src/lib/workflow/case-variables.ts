import type { OutputSchemaProperty } from "./types";

/**
 * Fixed case-level variables that are **always** injected into every workflow
 * instance by cases-svc as part of the `WorkflowInstancePayload`. They come
 * from the Case row + the client user's pre-approval (via auth-svc) and are
 * therefore guaranteed to be present for every execution.
 *
 * These are exposed in the VariablePicker from the Start node so any
 * downstream node (Message, API, Transform, Decision, etc.) can reference
 * them without the user having to model them manually in the Start output
 * schema.
 *
 * All entries are marked `readOnly: true` so the Start node's custom output
 * schema editor lists them as fixed, non-editable fields and keeps user-
 * defined fields editable below.
 *
 * NOTE: `promotion` / `selectedTerm` are intentionally **NOT** here — they
 * are no longer populated at workflow start. Promotion data will be exposed
 * by a dedicated Promotion node's `outputSchema` (Phase 2).
 */
export const CASE_VARIABLES: OutputSchemaProperty[] = [
	{
		id: "case-var-caseId",
		name: "caseId",
		type: "string",
		description: "Case UUID (Case.id)",
		readOnly: true,
	},
	{
		id: "case-var-caseNumber",
		name: "caseNumber",
		type: "string",
		description: "Human-readable case number (Case.caseNumber)",
		readOnly: true,
	},
	{
		id: "case-var-requestedAmount",
		name: "requestedAmount",
		type: "number",
		description: "Amount requested by the client in USD",
		readOnly: true,
	},
	{
		id: "case-var-clientUserId",
		name: "clientUserId",
		type: "string",
		description: "UUID of the client applying for credit",
		readOnly: true,
	},
	{
		id: "case-var-clientName",
		name: "clientName",
		type: "string",
		description: "Client full display name",
		readOnly: true,
	},
	{
		id: "case-var-clientFirstName",
		name: "clientFirstName",
		type: "string",
		description: "Client first name",
		readOnly: true,
	},
	{
		id: "case-var-clientMiddleName",
		name: "clientMiddleName",
		type: "string",
		description: "Client middle name (may be empty)",
		readOnly: true,
	},
	{
		id: "case-var-clientLastName",
		name: "clientLastName",
		type: "string",
		description: "Client last name",
		readOnly: true,
	},
	{
		id: "case-var-clientEmail",
		name: "clientEmail",
		type: "string",
		description: "Client email address",
		readOnly: true,
	},
	{
		id: "case-var-clientPhone",
		name: "clientPhone",
		type: "string",
		description: "Client phone number (may be empty)",
		readOnly: true,
	},
	{
		id: "case-var-clientAddress",
		name: "clientAddress",
		type: "object",
		description: "Client postal address captured during pre-approval",
		readOnly: true,
		properties: [
			{
				id: "case-var-clientAddress-streetNumber",
				name: "streetNumber",
				type: "string",
				readOnly: true,
			},
			{
				id: "case-var-clientAddress-streetName",
				name: "streetName",
				type: "string",
				readOnly: true,
			},
			{
				id: "case-var-clientAddress-apt",
				name: "apt",
				type: "string",
				readOnly: true,
			},
			{
				id: "case-var-clientAddress-city",
				name: "city",
				type: "string",
				readOnly: true,
			},
			{
				id: "case-var-clientAddress-state",
				name: "state",
				type: "string",
				readOnly: true,
			},
			{
				id: "case-var-clientAddress-zipCode",
				name: "zipCode",
				type: "string",
				readOnly: true,
			},
		],
	},
	{
		id: "case-var-productCode",
		name: "productCode",
		type: "string",
		description: "Product code from the case (e.g. HVAC)",
		readOnly: true,
	},
	{
		id: "case-var-productName",
		name: "productName",
		type: "string",
		description: "Human-readable product name in English",
		readOnly: true,
	},
	{
		id: "case-var-productNameEs",
		name: "productNameEs",
		type: "string",
		description: "Human-readable product name in Spanish",
		readOnly: true,
	},
	{
		id: "case-var-jurisdiction",
		name: "jurisdiction",
		type: "string",
		description: "US state code used as jurisdiction (e.g. TX)",
		readOnly: true,
	},
	{
		id: "case-var-jurisdictionName",
		name: "jurisdictionName",
		type: "string",
		description: "Full jurisdiction name in English (e.g. Texas)",
		readOnly: true,
	},
	{
		id: "case-var-roleContacts",
		name: "roleContacts",
		type: "object",
		description:
			"Resolved contact info (email/name/phone) keyed by role: client, seller, org_manager, credit_agent",
		readOnly: true,
		properties: [
			{
				id: "case-var-roleContacts-client",
				name: "client",
				type: "object",
				readOnly: true,
				properties: [
					{
						id: "case-var-roleContacts-client-email",
						name: "email",
						type: "string",
						readOnly: true,
					},
					{
						id: "case-var-roleContacts-client-name",
						name: "name",
						type: "string",
						readOnly: true,
					},
					{
						id: "case-var-roleContacts-client-firstName",
						name: "firstName",
						type: "string",
						readOnly: true,
					},
					{
						id: "case-var-roleContacts-client-middleName",
						name: "middleName",
						type: "string",
						readOnly: true,
					},
					{
						id: "case-var-roleContacts-client-lastName",
						name: "lastName",
						type: "string",
						readOnly: true,
					},
					{
						id: "case-var-roleContacts-client-phone",
						name: "phone",
						type: "string",
						readOnly: true,
					},
				],
			},
			{
				id: "case-var-roleContacts-seller",
				name: "seller",
				type: "object",
				readOnly: true,
				properties: [
					{
						id: "case-var-roleContacts-seller-email",
						name: "email",
						type: "string",
						readOnly: true,
					},
					{
						id: "case-var-roleContacts-seller-name",
						name: "name",
						type: "string",
						readOnly: true,
					},
					{
						id: "case-var-roleContacts-seller-firstName",
						name: "firstName",
						type: "string",
						readOnly: true,
					},
					{
						id: "case-var-roleContacts-seller-middleName",
						name: "middleName",
						type: "string",
						readOnly: true,
					},
					{
						id: "case-var-roleContacts-seller-lastName",
						name: "lastName",
						type: "string",
						readOnly: true,
					},
				],
			},
			{
				id: "case-var-roleContacts-org_manager",
				name: "org_manager",
				type: "object",
				readOnly: true,
				properties: [
					{
						id: "case-var-roleContacts-org_manager-email",
						name: "email",
						type: "string",
						readOnly: true,
					},
					{
						id: "case-var-roleContacts-org_manager-name",
						name: "name",
						type: "string",
						readOnly: true,
					},
					{
						id: "case-var-roleContacts-org_manager-firstName",
						name: "firstName",
						type: "string",
						readOnly: true,
					},
					{
						id: "case-var-roleContacts-org_manager-middleName",
						name: "middleName",
						type: "string",
						readOnly: true,
					},
					{
						id: "case-var-roleContacts-org_manager-lastName",
						name: "lastName",
						type: "string",
						readOnly: true,
					},
				],
			},
			{
				id: "case-var-roleContacts-credit_agent",
				name: "credit_agent",
				type: "object",
				readOnly: true,
				properties: [
					{
						id: "case-var-roleContacts-credit_agent-email",
						name: "email",
						type: "string",
						readOnly: true,
					},
					{
						id: "case-var-roleContacts-credit_agent-name",
						name: "name",
						type: "string",
						readOnly: true,
					},
					{
						id: "case-var-roleContacts-credit_agent-firstName",
						name: "firstName",
						type: "string",
						readOnly: true,
					},
					{
						id: "case-var-roleContacts-credit_agent-middleName",
						name: "middleName",
						type: "string",
						readOnly: true,
					},
					{
						id: "case-var-roleContacts-credit_agent-lastName",
						name: "lastName",
						type: "string",
						readOnly: true,
					},
				],
			},
		],
	},
];

/**
 * Returns a fresh deep copy of CASE_VARIABLES. Use this whenever merging with
 * user-defined properties so consumers never mutate the shared catalog.
 */
export function cloneCaseVariables(): OutputSchemaProperty[] {
	return CASE_VARIABLES.map(cloneSchemaProperty);
}

function cloneSchemaProperty(prop: OutputSchemaProperty): OutputSchemaProperty {
	const copy: OutputSchemaProperty = { ...prop };
	if (prop.properties) {
		copy.properties = prop.properties.map(cloneSchemaProperty);
	}
	if (prop.items) {
		copy.items = cloneSchemaProperty(prop.items);
	}
	if (prop.enumValues) {
		copy.enumValues = [...prop.enumValues];
	}
	return copy;
}

/** Set of reserved top-level names so user-defined fields can't collide. */
export const CASE_VARIABLE_NAMES: ReadonlySet<string> = new Set(
	CASE_VARIABLES.map((v) => v.name),
);
