import { describe, it, expect, beforeAll } from "vitest";
import {
	findNearestPreviousCheckpoint,
	findAllNearestPreviousCheckpoints,
	getCheckpointNode,
	findUpstreamNodes,
	buildSecretsSource,
	buildVariableSourceNodes,
	SECRETS_SOURCE_ID,
} from "./graph-utils";
import type { WorkflowNode, WorkflowEdge } from "./types";
import { updateNlsCache } from "./nls-functions-cache";
import type { NlsFunctionSummary } from "@/lib/workflow-api/nls";

// ---------------------------------------------------------------------------
// Pre-populate the NLS output fields cache for tests that involve NLS nodes.
// In production this is done by useNlsFunctionsCache hook; in tests we do it
// directly so graph-utils can resolve output schemas synchronously.
// ---------------------------------------------------------------------------
const NLS_FUNCTION_FIXTURES: NlsFunctionSummary[] = [
	{
		id: "createLoan",
		label: "Create Loan",
		description: "Creates a loan",
		outputFields: [
			{ id: "success", label: "Success", type: "boolean" },
			{ id: "loanNumber", label: "Loan Number", type: "string" },
			{ id: "originationDate", label: "Origination Date", type: "string" },
			{ id: "firstPaymentDate", label: "First Payment Date", type: "string" },
			{ id: "term", label: "Term", type: "number" },
			{ id: "loanAmount", label: "Loan Amount", type: "number" },
			{ id: "interestRate", label: "Interest Rate", type: "number" },
		],
	},
	{
		id: "getAmortization",
		label: "Get Amortization",
		description: "Gets amortization",
		outputFields: [
			{ id: "LoanAmount", label: "Loan Amount", type: "number" },
			{ id: "totalOfPayments", label: "Total of Payments", type: "number" },
			{
				id: "regularPaymentAmount",
				label: "Regular Payment Amount",
				type: "number",
			},
			{ id: "firstPaymentApr", label: "First Payment Date", type: "string" },
			{ id: "lastPaymentAmount", label: "Last Payment Amount", type: "number" },
			{ id: "lastPaymentDate", label: "Last Payment Date", type: "string" },
			{ id: "OriginationDate", label: "Origination Date", type: "string" },
			{ id: "apr", label: "APR", type: "number" },
			{ id: "CashFlow", label: "Cash Flow", type: "number" },
			{
				id: "schedule",
				label: "Amortization Schedule",
				type: "array",
				items: {
					id: "item",
					label: "Entry",
					type: "object",
					properties: [
						{ id: "PaymentNumber", label: "Payment Number", type: "number" },
						{ id: "PaymentAmount", label: "Payment Amount", type: "number" },
					],
				},
			},
		],
	},
	{
		id: "searchLoans",
		label: "Search Loans",
		description: "Searches loans",
		outputFields: [
			{
				id: "items",
				label: "Loans Array",
				type: "array",
				items: {
					id: "item",
					label: "Loan",
					type: "object",
					properties: [
						{ id: "Loan_Number", label: "Loan Number", type: "string" },
						{ id: "Cifno", label: "CIF No", type: "number" },
					],
				},
			},
			{ id: "total", label: "Total", type: "number" },
		],
	},
];

beforeAll(() => {
	updateNlsCache(NLS_FUNCTION_FIXTURES);
});

describe("graph-utils", () => {
	describe("findNearestPreviousCheckpoint", () => {
		it("should find checkpoint directly connected", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "checkpoint-1",
					type: "Checkpoint",
					title: "Checkpoint 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "checkpoint-1", to: "node-1", label: null },
			];

			const result = findNearestPreviousCheckpoint("node-1", nodes, edges);
			expect(result).toBe("checkpoint-1");
		});

		it("should find checkpoint through intermediate nodes", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "checkpoint-1",
					type: "Checkpoint",
					title: "Checkpoint 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
				{
					id: "node-2",
					type: "Decision",
					title: "Decision 1",
					description: "",
					roles: [],
					config: { condition: "test" },
					position: { x: 200, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "checkpoint-1", to: "node-1", label: null },
				{ id: "edge-2", from: "node-1", to: "node-2", label: null },
			];

			const result = findNearestPreviousCheckpoint("node-2", nodes, edges);
			expect(result).toBe("checkpoint-1");
		});

		it("should return null when no checkpoint exists", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "start-1", to: "node-1", label: null },
			];

			const result = findNearestPreviousCheckpoint("node-1", nodes, edges);
			expect(result).toBeNull();
		});

		it("should stop at Start node", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "start-1", to: "node-1", label: null },
			];

			const result = findNearestPreviousCheckpoint("node-1", nodes, edges);
			expect(result).toBeNull();
		});

		it("should handle cycles gracefully", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "checkpoint-1",
					type: "Checkpoint",
					title: "Checkpoint 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "checkpoint-1", to: "node-1", label: null },
				{ id: "edge-2", from: "node-1", to: "checkpoint-1", label: null },
			];

			const result = findNearestPreviousCheckpoint("node-1", nodes, edges);
			expect(result).toBe("checkpoint-1");
		});
	});

	describe("findAllNearestPreviousCheckpoints", () => {
		it("should find single checkpoint", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "checkpoint-1",
					type: "Checkpoint",
					title: "Checkpoint 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "checkpoint-1", to: "node-1", label: null },
			];

			const result = findAllNearestPreviousCheckpoints("node-1", nodes, edges);
			expect(result).toEqual(["checkpoint-1"]);
		});

		it("should find multiple checkpoints at same distance", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "checkpoint-1",
					type: "Checkpoint",
					title: "Checkpoint 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "checkpoint-2",
					type: "Checkpoint",
					title: "Checkpoint 2",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 100 },
					groupId: null,
				},
				{
					id: "join-1",
					type: "Join",
					title: "Join 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 50 },
					groupId: null,
				},
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 200, y: 50 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "checkpoint-1", to: "join-1", label: null },
				{ id: "edge-2", from: "checkpoint-2", to: "join-1", label: null },
				{ id: "edge-3", from: "join-1", to: "node-1", label: null },
			];

			const result = findAllNearestPreviousCheckpoints("node-1", nodes, edges);
			expect(result).toContain("checkpoint-1");
			expect(result).toContain("checkpoint-2");
			expect(result.length).toBe(2);
		});

		it("should return empty array when no checkpoint exists", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "start-1", to: "node-1", label: null },
			];

			const result = findAllNearestPreviousCheckpoints("node-1", nodes, edges);
			expect(result).toEqual([]);
		});
	});

	describe("findUpstreamNodes", () => {
		it("should return all upstream nodes excluding the target node itself", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "form-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
				{
					id: "api-1",
					type: "API",
					title: "API 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 200, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "e1", from: "start", to: "form-1", label: null },
				{ id: "e2", from: "form-1", to: "api-1", label: null },
			];

			const result = findUpstreamNodes("api-1", nodes, edges);
			const ids = result.map((n) => n.id);
			expect(ids).toContain("start");
			expect(ids).toContain("form-1");
			expect(ids).not.toContain("api-1");
		});

		it("should return empty array for start node", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];
			const result = findUpstreamNodes("start", nodes, []);
			expect(result).toEqual([]);
		});

		it("should handle disconnected upstream (no incoming edges)", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];
			const result = findUpstreamNodes("node-1", nodes, []);
			expect(result).toEqual([]);
		});
	});

	describe("buildVariableSourceNodes", () => {
		it("should skip nodes without outputSchema", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "api-1",
					type: "API",
					title: "My API",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];
			const result = buildVariableSourceNodes(nodes);
			expect(result).toEqual([]);
		});

		it("should convert a flat outputSchema to VariableSourceNode", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "api-1",
					type: "API",
					title: "My API",
					description: "",
					roles: [],
					config: {
						outputSchema: {
							name: "APIOutput",
							properties: [
								{ id: "p1", name: "status", type: "number" },
								{ id: "p2", name: "message", type: "string" },
							],
						},
					},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];

			const result = buildVariableSourceNodes(nodes);
			expect(result).toHaveLength(1);
			// id is now the camelCase alias derived from the node title
			expect(result[0].id).toBe("myApi");
			expect(result[0].name).toBe("My API");
			expect(result[0].variables).toHaveLength(2);

			const status = result[0].variables.find((v) => v.name === "status");
			expect(status?.type).toBe("number");
			expect(status?.path).toBe("myApi.status");

			const message = result[0].variables.find((v) => v.name === "message");
			expect(message?.type).toBe("string");
			expect(message?.path).toBe("myApi.message");
		});

		it("should convert nested object properties", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "api-1",
					type: "API",
					title: "My API",
					description: "",
					roles: [],
					config: {
						outputSchema: {
							name: "APIOutput",
							properties: [
								{
									id: "p1",
									name: "data",
									type: "object",
									properties: [
										{ id: "p1a", name: "id", type: "number" },
										{ id: "p1b", name: "name", type: "string" },
									],
								},
							],
						},
					},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];

			const result = buildVariableSourceNodes(nodes);
			expect(result).toHaveLength(1);

			const dataVar = result[0].variables.find((v) => v.name === "data");
			expect(dataVar?.type).toBe("object");
			expect(dataVar?.children).toHaveLength(2);
			expect(dataVar?.children?.[0].path).toBe("myApi.data.id");
		});

		it("should map enum type to string for variable picker", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "api-1",
					type: "API",
					title: "My API",
					description: "",
					roles: [],
					config: {
						outputSchema: {
							name: "APIOutput",
							properties: [
								{
									id: "p1",
									name: "status",
									type: "enum",
									enumValues: ["ACTIVE", "INACTIVE"],
								},
							],
						},
					},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];

			const result = buildVariableSourceNodes(nodes);
			const statusVar = result[0].variables.find((v) => v.name === "status");
			expect(statusVar?.type).toBe("string");
		});

		it("should expand compound name field into children in the variable tree", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "form-1",
					type: "Form",
					title: "Personal Data",
					description: "",
					roles: [],
					config: {
						outputSchema: {
							name: "personalDataOutput",
							properties: [
								{
									id: "f1",
									name: "userName",
									type: "object",
									description: "User Name",
									properties: [
										{
											id: "f1_firstName",
											name: "firstName",
											type: "string",
											description: "First name",
										},
										{
											id: "f1_lastName",
											name: "lastName",
											type: "string",
											description: "Last name",
										},
										{
											id: "f1_fullName",
											name: "fullName",
											type: "string",
											description: "Full name (computed)",
										},
									],
								},
							],
						},
					},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];

			const result = buildVariableSourceNodes(nodes);
			expect(result).toHaveLength(1);

			const userNameVar = result[0].variables.find(
				(v) => v.name === "userName",
			);
			expect(userNameVar).toBeDefined();
			expect(userNameVar?.type).toBe("object");
			expect(userNameVar?.children).toHaveLength(3);

			const firstNameChild = userNameVar?.children?.find(
				(c) => c.name === "firstName",
			);
			expect(firstNameChild).toBeDefined();
			expect(firstNameChild?.path).toBe("personalData.userName.firstName");
			expect(firstNameChild?.type).toBe("string");

			const lastNameChild = userNameVar?.children?.find(
				(c) => c.name === "lastName",
			);
			expect(lastNameChild?.path).toBe("personalData.userName.lastName");

			const fullNameChild = userNameVar?.children?.find(
				(c) => c.name === "fullName",
			);
			expect(fullNameChild?.path).toBe("personalData.userName.fullName");
		});

		it("should expand compound address field into children in the variable tree", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "form-2",
					type: "Form",
					title: "Contact Form",
					description: "",
					roles: [],
					config: {
						outputSchema: {
							name: "contactFormOutput",
							properties: [
								{
									id: "f2",
									name: "homeAddress",
									type: "object",
									description: "Home Address",
									properties: [
										{
											id: "f2_street",
											name: "street",
											type: "string",
											description: "Street address",
										},
										{
											id: "f2_city",
											name: "city",
											type: "string",
											description: "City",
										},
										{
											id: "f2_fullAddress",
											name: "fullAddress",
											type: "string",
											description: "Full address (computed)",
										},
									],
								},
							],
						},
					},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];

			const result = buildVariableSourceNodes(nodes);
			const addressVar = result[0].variables.find(
				(v) => v.name === "homeAddress",
			);
			expect(addressVar?.type).toBe("object");
			expect(addressVar?.children).toHaveLength(3);

			const streetChild = addressVar?.children?.find(
				(c) => c.name === "street",
			);
			expect(streetChild?.path).toBe("contactForm.homeAddress.street");
		});

		it("always emits the Start source with CASE_VARIABLES even when it has no custom outputSchema", () => {
			const start: WorkflowNode = {
				id: "start-1",
				type: "Start",
				title: "Start",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 0 },
				groupId: null,
			};

			const result = buildVariableSourceNodes([start]);
			expect(result).toHaveLength(1);
			// id is the camelCase alias derived from the node title "Start" → "start"
			expect(result[0].id).toBe("start");

			const names = result[0].variables.map((v) => v.name);
			expect(names).toEqual(
				expect.arrayContaining([
					"caseId",
					"caseNumber",
					"requestedAmount",
					"clientUserId",
					"clientName",
					"clientEmail",
					"clientPhone",
					"clientAddress",
					"roleContacts",
				]),
			);

			const clientAddress = result[0].variables.find(
				(v) => v.name === "clientAddress",
			);
			expect(clientAddress?.type).toBe("object");
			expect(clientAddress?.children?.map((c) => c.name)).toEqual(
				expect.arrayContaining([
					"streetNumber",
					"streetName",
					"apt",
					"city",
					"state",
					"zipCode",
				]),
			);
		});

		it("merges Start custom outputSchema on top of CASE_VARIABLES without letting custom fields shadow system ones", () => {
			const start: WorkflowNode = {
				id: "start-1",
				type: "Start",
				title: "Start",
				description: "",
				roles: [],
				config: {
					outputSchema: {
						name: "StartOutput",
						properties: [
							{ id: "custom-1", name: "campaignId", type: "string" },
							// Tries to shadow a system field; must be ignored.
							{ id: "custom-2", name: "caseId", type: "string" },
						],
					},
				},
				position: { x: 0, y: 0 },
				groupId: null,
			};

			const result = buildVariableSourceNodes([start]);
			expect(result).toHaveLength(1);

			const campaign = result[0].variables.find((v) => v.name === "campaignId");
			expect(campaign).toBeDefined();
			// path uses the alias "start" not the raw node id "start-1"
			expect(campaign?.path).toBe("start.campaignId");

			const caseIdEntries = result[0].variables.filter(
				(v) => v.name === "caseId",
			);
			expect(caseIdEntries).toHaveLength(1);
			expect(caseIdEntries[0].description).toBe("Case UUID (Case.id)");
		});

		it("emits the Start source via allNodes even when it is not reachable upstream", () => {
			const start: WorkflowNode = {
				id: "start-1",
				type: "Start",
				title: "Start",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 0 },
				groupId: null,
			};
			const disconnected: WorkflowNode = {
				id: "api-1",
				type: "API",
				title: "Dangling API",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 0 },
				groupId: null,
			};

			const result = buildVariableSourceNodes([disconnected], {
				allNodes: [start, disconnected],
			});
			expect(result).toHaveLength(1);
			// id is the alias derived from title "Start" → "start"
			expect(result[0].id).toBe("start");
			const names = result[0].variables.map((v) => v.name);
			expect(names).toContain("caseId");
		});

		it("Challenge nodes always expose CHALLENGE_OUTPUT_SCHEMA fields", () => {
			const challenge: WorkflowNode = {
				id: "challenge-1",
				type: "Challenge",
				title: "Aprobación",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 0 },
				groupId: null,
			};

			const result = buildVariableSourceNodes([challenge]);
			expect(result).toHaveLength(1);
			// id is the alias derived from title "Aprobación" → "aprobacion"
			expect(result[0].id).toBe("aprobacion");

			const names = result[0].variables.map((v) => v.name);
			expect(names).toEqual([
				"accepted",
				"timedOut",
				"respondedBy",
				"respondedAt",
			]);

			const accepted = result[0].variables.find((v) => v.name === "accepted");
			expect(accepted?.path).toBe("aprobacion.accepted");
			expect(accepted?.type).toBe("boolean");
		});

		it("Challenge merges user-declared custom properties on top of fixed outputs without duplicating", () => {
			const challenge: WorkflowNode = {
				id: "challenge-2",
				type: "Challenge",
				title: "Firma",
				description: "",
				roles: [],
				config: {
					outputSchema: {
						properties: [
							{ id: "c-1", name: "accepted", type: "string" },
							{ id: "c-2", name: "signatureId", type: "string" },
						],
					},
				},
				position: { x: 0, y: 0 },
				groupId: null,
			};

			const result = buildVariableSourceNodes([challenge]);
			expect(result).toHaveLength(1);

			const names = result[0].variables.map((v) => v.name);
			expect(names).toContain("signatureId");

			const acceptedEntries = result[0].variables.filter(
				(v) => v.name === "accepted",
			);
			expect(acceptedEntries).toHaveLength(1);
			expect(acceptedEntries[0].type).toBe("boolean");
		});

		it("Promotion nodes always expose PROMOTION_OUTPUT_SCHEMA fields", () => {
			const promotion: WorkflowNode = {
				id: "promotion-1",
				type: "Promotion",
				title: "Seleccionar promoción",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 0 },
				groupId: null,
			};

			const result = buildVariableSourceNodes([promotion]);
			expect(result).toHaveLength(1);
			// id is the alias derived from title "Seleccionar promoción" → "seleccionarPromocion"
			expect(result[0].id).toBe("seleccionarPromocion");

			const names = result[0].variables.map((v) => v.name);
			expect(names).toEqual([
				"promotionId",
				"promotionName",
				"selectedTerm",
				"finalAmount",
				"monthlyPayment",
				"interestRate",
				"downPayment",
				"contractorFee",
				"commission",
				"netLoanAmount",
				"financedAmount",
				"template",
				"loanTemplateNumber",
				"loanPortfolioName",
				"maxInterestRate",
				"minInterestRate",
				"selectedBy",
				"selectedAt",
			]);

			const monthly = result[0].variables.find(
				(v) => v.name === "monthlyPayment",
			);
			expect(monthly?.path).toBe("seleccionarPromocion.monthlyPayment");
			expect(monthly?.type).toBe("number");
		});

		it("Promotion merges user-declared custom properties without duplicating fixed outputs", () => {
			const promotion: WorkflowNode = {
				id: "promotion-2",
				type: "Promotion",
				title: "Custom promo",
				description: "",
				roles: [],
				config: {
					outputSchema: {
						properties: [
							{ id: "p-1", name: "monthlyPayment", type: "string" },
							{ id: "p-2", name: "legacyFlag", type: "boolean" },
						],
					},
				},
				position: { x: 0, y: 0 },
				groupId: null,
			};

			const result = buildVariableSourceNodes([promotion]);
			expect(result).toHaveLength(1);

			const names = result[0].variables.map((v) => v.name);
			expect(names).toContain("legacyFlag");

			const monthlyEntries = result[0].variables.filter(
				(v) => v.name === "monthlyPayment",
			);
			expect(monthlyEntries).toHaveLength(1);
			expect(monthlyEntries[0].type).toBe("number");
		});

		it("GeneratePDF nodes always expose GENERATE_PDF_OUTPUT_SCHEMA fields", () => {
			const generatePdf: WorkflowNode = {
				id: "generate-pdf-1",
				type: "GeneratePDF",
				title: "Generar PDF",
				description: "",
				roles: [],
				config: { pdfTemplateId: "tpl-1", fieldMappings: [] },
				position: { x: 0, y: 0 },
				groupId: null,
			};

			const result = buildVariableSourceNodes([generatePdf]);
			expect(result).toHaveLength(1);

			const names = result[0].variables.map((v) => v.name);
			expect(names).toEqual(["documentId", "fileName"]);

			const documentId = result[0].variables.find(
				(v) => v.name === "documentId",
			);
			expect(documentId?.type).toBe("string");
		});

		it("GeneratePDF merges user-declared custom properties without duplicating fixed outputs", () => {
			const generatePdf: WorkflowNode = {
				id: "generate-pdf-2",
				type: "GeneratePDF",
				title: "Generar PDF",
				description: "",
				roles: [],
				config: {
					pdfTemplateId: "tpl-1",
					fieldMappings: [],
					outputSchema: {
						properties: [
							{ id: "p-1", name: "fileName", type: "boolean" },
							{ id: "p-2", name: "extraFlag", type: "boolean" },
						],
					},
				},
				position: { x: 0, y: 0 },
				groupId: null,
			};

			const result = buildVariableSourceNodes([generatePdf]);
			expect(result).toHaveLength(1);

			const names = result[0].variables.map((v) => v.name);
			expect(names).toContain("extraFlag");

			const fileNameEntries = result[0].variables.filter(
				(v) => v.name === "fileName",
			);
			expect(fileNameEntries).toHaveLength(1);
			expect(fileNameEntries[0].type).toBe("string");
		});

		it("NLS nodes expose output fields based on functionId (createLoan)", () => {
			const nlsNode: WorkflowNode = {
				id: "nls-1",
				type: "NLS",
				title: "Crear préstamo",
				description: "",
				roles: [],
				config: {
					functionId: "createLoan",
					fields: [],
					failureHandling: { onFailure: "stop", maxRetries: 0 },
				},
				position: { x: 0, y: 0 },
				groupId: null,
			};

			const result = buildVariableSourceNodes([nlsNode]);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("crearPrestamo");

			const names = result[0].variables.map((v) => v.name);
			expect(names).toContain("success");
			expect(names).toContain("loanNumber");
			expect(names).toContain("originationDate");
			expect(names).toContain("firstPaymentDate");
			expect(names).toContain("term");
			expect(names).toContain("loanAmount");
			expect(names).toContain("interestRate");
		});

		it("NLS nodes expose output fields based on functionId (getAmortization)", () => {
			const nlsNode: WorkflowNode = {
				id: "nls-2",
				type: "NLS",
				title: "Obtener amortización",
				description: "",
				roles: [],
				config: {
					functionId: "getAmortization",
					fields: [],
					failureHandling: { onFailure: "stop", maxRetries: 0 },
				},
				position: { x: 0, y: 0 },
				groupId: null,
			};

			const result = buildVariableSourceNodes([nlsNode]);
			expect(result).toHaveLength(1);

			const names = result[0].variables.map((v) => v.name);
			expect(names).toContain("LoanAmount");
			expect(names).toContain("apr");
			expect(names).toContain("totalOfPayments");
			expect(names).toContain("CashFlow");
			expect(names).toContain("schedule");

			const schedule = result[0].variables.find((v) => v.name === "schedule");
			expect(schedule?.type).toBe("array");
			expect(schedule?.children).toBeDefined();
		});

		it("NLS node without functionId produces no variables", () => {
			const nlsNode: WorkflowNode = {
				id: "nls-3",
				type: "NLS",
				title: "NLS sin función",
				description: "",
				roles: [],
				config: {
					fields: [],
					failureHandling: { onFailure: "stop", maxRetries: 0 },
				},
				position: { x: 0, y: 0 },
				groupId: null,
			};

			const result = buildVariableSourceNodes([nlsNode]);
			expect(result).toEqual([]);
		});

		it("NLS searchLoans exposes items[] with Loan_Number child via cache", () => {
			const nlsNode: WorkflowNode = {
				id: "nls-search",
				type: "NLS",
				title: "Buscar préstamos",
				description: "",
				roles: [],
				config: {
					functionId: "searchLoans",
					fields: [],
					failureHandling: { onFailure: "stop", maxRetries: 0 },
				},
				position: { x: 0, y: 0 },
				groupId: null,
			};

			const result = buildVariableSourceNodes([nlsNode]);
			expect(result).toHaveLength(1);

			const itemsVar = result[0].variables.find((v) => v.name === "items");
			expect(itemsVar).toBeDefined();
			expect(itemsVar!.type).toBe("array");
			// children of an array are the ITEM PROPERTIES directly (items[0].Field)
			expect(itemsVar!.children).toBeDefined();
			expect(itemsVar!.children!.length).toBeGreaterThan(0);

			// items[0].Loan_Number should be accessible as a leaf variable
			const loanNumberLeaf = itemsVar!.children!.find(
				(c) => c.name === "Loan_Number",
			);
			expect(loanNumberLeaf).toBeDefined();
			expect(loanNumberLeaf!.type).toBe("string");
			expect(loanNumberLeaf!.path).toContain("items[0].Loan_Number");

			// items[0].Cifno should also be accessible
			const cifnoLeaf = itemsVar!.children!.find((c) => c.name === "Cifno");
			expect(cifnoLeaf).toBeDefined();
			expect(cifnoLeaf!.type).toBe("number");
		});
	});

	describe("buildSecretsSource", () => {
		it("returns null when there are no variables", () => {
			expect(buildSecretsSource([])).toBeNull();
		});

		it("returns a single source with stable id and `secret.NAME` paths, alphabetized", () => {
			const source = buildSecretsSource([
				{ name: "STRIPE_KEY", is_secret: true, environment: "production" },
				{ name: "API_BASE_URL", environment: "all" },
				{
					name: "NLS_PASSWORD",
					is_secret: true,
					description: "NLS basic auth",
				},
			]);

			expect(source).not.toBeNull();
			expect(source?.id).toBe(SECRETS_SOURCE_ID);
			expect(source?.variables.map((v) => v.name)).toEqual([
				"API_BASE_URL",
				"NLS_PASSWORD",
				"STRIPE_KEY",
			]);
			expect(source?.variables.map((v) => v.path)).toEqual([
				"secret.API_BASE_URL",
				"secret.NLS_PASSWORD",
				"secret.STRIPE_KEY",
			]);
			for (const v of source?.variables ?? []) {
				expect(v.type).toBe("string");
			}

			const stripe = source?.variables.find((v) => v.name === "STRIPE_KEY");
			expect(stripe?.description).toContain("secret");
			expect(stripe?.description).toContain("production");
		});

		it("honors a custom source name", () => {
			const source = buildSecretsSource([{ name: "A" }], {
				name: "Mis secretos",
			});
			expect(source?.name).toBe("Mis secretos");
		});
	});

	describe("getCheckpointNode", () => {
		it("should return checkpoint node when found", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "checkpoint-1",
					type: "Checkpoint",
					title: "Checkpoint 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];

			const result = getCheckpointNode("checkpoint-1", nodes);
			expect(result).not.toBeNull();
			expect(result?.id).toBe("checkpoint-1");
			expect(result?.type).toBe("Checkpoint");
		});

		it("should return null when checkpoint not found", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];

			const result = getCheckpointNode("checkpoint-1", nodes);
			expect(result).toBeNull();
		});

		it("should return null when id is null", () => {
			const nodes: WorkflowNode[] = [];
			const result = getCheckpointNode(null, nodes);
			expect(result).toBeNull();
		});

		it("should return null when node exists but is not a checkpoint", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];

			const result = getCheckpointNode("node-1", nodes);
			expect(result).toBeNull();
		});
	});
});

// ---------------------------------------------------------------------------
// Pre-qualification variables in buildVariableSourceNodes
// ---------------------------------------------------------------------------

describe("buildVariableSourceNodes — prequalification variables", () => {
	const startNode: WorkflowNode = {
		id: "start-1",
		type: "Start",
		title: "Start",
		description: "",
		roles: [],
		config: {},
		position: { x: 0, y: 0 },
		groupId: null,
	};

	it("exposes start.prequalification as a variable source node", () => {
		const result = buildVariableSourceNodes([startNode], {
			allNodes: [startNode],
		});
		expect(result).toHaveLength(1);
		const startSource = result[0];
		const prequal = startSource.variables.find(
			(v) => v.name === "prequalification",
		);
		expect(prequal).toBeDefined();
		expect(prequal?.path).toBe("start.prequalification");
	});

	it("exposes start.prequalification.preApprovalResult as a leaf variable", () => {
		const result = buildVariableSourceNodes([startNode], {
			allNodes: [startNode],
		});
		const startSource = result[0];
		const prequal = startSource.variables.find(
			(v) => v.name === "prequalification",
		);
		const preApprovalResult = prequal?.children?.find(
			(c) => c.name === "preApprovalResult",
		);
		expect(preApprovalResult).toBeDefined();
		expect(preApprovalResult?.path).toBe(
			"start.prequalification.preApprovalResult",
		);
		expect(preApprovalResult?.type).toBe("number");
	});

	it("exposes start.prequalification.bureau as a nested object with leaf children", () => {
		const result = buildVariableSourceNodes([startNode], {
			allNodes: [startNode],
		});
		const startSource = result[0];
		const prequal = startSource.variables.find(
			(v) => v.name === "prequalification",
		);
		const bureau = prequal?.children?.find((c) => c.name === "bureau");
		expect(bureau).toBeDefined();
		expect(bureau?.path).toBe("start.prequalification.bureau");

		const fico = bureau?.children?.find((c) => c.name === "fico");
		expect(fico).toBeDefined();
		expect(fico?.path).toBe("start.prequalification.bureau.fico");
		expect(fico?.type).toBe("number");

		const bankruptcyColor = bureau?.children?.find(
			(c) => c.name === "bankruptcyColor",
		);
		expect(bankruptcyColor).toBeDefined();
		expect(bankruptcyColor?.path).toBe(
			"start.prequalification.bureau.bankruptcyColor",
		);
	});

	it("exposes all 11 bureau leaf variables", () => {
		const result = buildVariableSourceNodes([startNode], {
			allNodes: [startNode],
		});
		const startSource = result[0];
		const prequal = startSource.variables.find(
			(v) => v.name === "prequalification",
		);
		const bureau = prequal?.children?.find((c) => c.name === "bureau");
		expect(bureau?.children).toHaveLength(11);
	});

	it("exposes all 9 top-level prequalification fields plus the bureau object", () => {
		const result = buildVariableSourceNodes([startNode], {
			allNodes: [startNode],
		});
		const startSource = result[0];
		const prequal = startSource.variables.find(
			(v) => v.name === "prequalification",
		);
		// 9 scalar + 1 bureau object = 10 children
		expect(prequal?.children).toHaveLength(10);
	});
});
