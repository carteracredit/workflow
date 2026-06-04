import type { Meta, StoryObj } from "@storybook/nextjs";
import { PropertiesPanel } from "@/components/workflow/properties-panel";
import type {
	WorkflowNode,
	WorkflowEdge,
	WorkflowMetadata,
} from "@/lib/workflow/types";

const mockMetadata: WorkflowMetadata = {
	name: "Flujo de Crédito",
	description: "Flujo de aprobación de créditos",
	version: "1.0.0",
	author: "Juan Pérez",
	tags: ["crédito", "aprobación"],
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
};

const mockNode: WorkflowNode = {
	id: "node-1",
	type: "Form",
	title: "Formulario de Solicitud",
	description: "Captura de datos del solicitante",
	roles: ["client", "seller"],
	visibilityRoles: ["client", "seller", "credit_agent", "org_manager"],
	config: { formId: "form-1" },
	staleTimeout: null,
	position: { x: 100, y: 200 },
	groupId: null,
};

const mockEdge: WorkflowEdge = {
	id: "edge-1",
	from: "node-1",
	to: "node-2",
	label: "Siguiente",
	thickness: 2,
};

const meta: Meta<typeof PropertiesPanel> = {
	title: "Components/Workflow/PropertiesPanel",
	component: PropertiesPanel,
	parameters: {
		layout: "padded",
	},
	args: {
		onUpdateNode: () => {},
		onUpdateEdge: () => {},
		onUpdateMetadata: () => {},
		onAddEdge: () => {},
		onDeleteEdge: () => {},
		workflowMetadata: mockMetadata,
		nodes: [],
		edges: [],
		flags: [],
		showWorkflowProperties: false,
		onCloseWorkflowProperties: () => {},
		selectedNodes: [],
		selectedEdges: [],
	},
	decorators: [
		(Story) => (
			<div style={{ height: "600px", display: "flex" }}>
				<Story />
			</div>
		),
	],
};

export default meta;
type Story = StoryObj<typeof PropertiesPanel>;

export const NoSelection: Story = {
	args: {
		selectedNodes: [],
		selectedEdges: [],
	},
};

export const NodeSelected: Story = {
	args: {
		selectedNodes: [mockNode],
		selectedEdges: [],
	},
};

export const NodeWithPartialVisibility: Story = {
	name: "Form — Visibility roles (partial)",
	args: {
		selectedNodes: [
			{
				...mockNode,
				visibilityRoles: ["seller"],
			},
		],
		selectedEdges: [],
	},
};

export const NodeWithNoVisibility: Story = {
	name: "Form — Visibility roles (none, warning)",
	args: {
		selectedNodes: [
			{
				...mockNode,
				visibilityRoles: [],
			},
		],
		selectedEdges: [],
	},
};

export const EdgeSelected: Story = {
	args: {
		selectedNodes: [],
		selectedEdges: [mockEdge],
	},
};

// ─── Signature Challenge Stories ──────────────────────────────────────────────

const signatureChallengeNode: WorkflowNode = {
	id: "sig-challenge-1",
	type: "Challenge",
	title: "Firma el Contrato",
	description: "El cliente debe firmar el contrato de crédito",
	roles: ["client"],
	config: {
		challengeType: "signature",
		challengeTimeout: { value: 72, unit: "hours" },
		deliveryMethod: "email",
		templateId: "a1b2c3d4e5f6",
		flow: "embedded",
		signers: [
			{
				role: "Client",
				source: "case_role",
				caseRole: "client",
			},
		],
		customFields: [
			{
				apiId: "loanAmount",
				name: "Monto del préstamo",
				type: "text",
				value: "${coapplicantForm.requestedAmount}",
				required: true,
				source: "discovered",
			},
		],
	},
	staleTimeout: null,
	position: { x: 200, y: 300 },
	groupId: null,
};

export const SignatureChallengeEmbedded: Story = {
	name: "Challenge — Firma (Embedded)",
	args: {
		selectedNodes: [signatureChallengeNode],
		selectedEdges: [],
	},
};

export const SignatureChallengeEmailOnly: Story = {
	name: "Challenge — Firma (Email Only)",
	args: {
		selectedNodes: [
			{
				...signatureChallengeNode,
				id: "sig-challenge-email",
				config: {
					...signatureChallengeNode.config,
					flow: "email_only",
				},
			},
		],
		selectedEdges: [],
	},
};

export const SignatureChallengeEmailAndSms: Story = {
	name: "Challenge — Firma (Email + SMS)",
	args: {
		selectedNodes: [
			{
				...signatureChallengeNode,
				id: "sig-challenge-sms",
				config: {
					...signatureChallengeNode.config,
					flow: "email_and_sms",
					signers: [
						{
							role: "Client",
							source: "variable",
							email: "${clientForm.email}",
							name: "${clientForm.fullName}",
							smsPhoneNumber: "${clientForm.phone}",
						},
					],
				},
			},
		],
		selectedEdges: [],
	},
};

export const SignatureChallengeEmpty: Story = {
	name: "Challenge — Firma (Sin Config)",
	args: {
		selectedNodes: [
			{
				...signatureChallengeNode,
				id: "sig-challenge-empty",
				config: {
					challengeType: "signature",
					challengeTimeout: { value: 48, unit: "hours" },
					deliveryMethod: "none",
					templateId: "",
					flow: "email_only",
					signers: [],
					customFields: [],
				},
			},
		],
		selectedEdges: [],
	},
};

// ─── API Node Stories ──────────────────────────────────────────────────────────

const apiNodeBase: WorkflowNode = {
	id: "api-1",
	type: "API",
	title: "Llamada API Externa",
	description: "Consulta a servicio externo",
	roles: [],
	config: {
		url: "https://api.example.com/resource",
		method: "POST",
	},
	staleTimeout: null,
	position: { x: 150, y: 150 },
	groupId: null,
};

export const ApiNodeXmlTemplateValid: Story = {
	name: "API — Body: XML Template (válido)",
	args: {
		selectedNodes: [
			{
				...apiNodeBase,
				config: {
					...apiNodeBase.config,
					bodyConfig: {
						mode: "raw-xml",
						rawXml:
							"<request>\n  <loanId>${node-form.loanId}</loanId>\n  <amount>1000</amount>\n</request>",
					},
				},
			},
		],
		selectedEdges: [],
	},
};

export const ApiNodeXmlTemplateMalformed: Story = {
	name: "API — Body: XML Template (mal formado)",
	args: {
		selectedNodes: [
			{
				...apiNodeBase,
				config: {
					...apiNodeBase.config,
					bodyConfig: {
						mode: "raw-xml",
						rawXml: "<request><loanId>123</loanId>",
					},
				},
			},
		],
		selectedEdges: [],
	},
};

export const ApiNodeJsonTemplateInvalid: Story = {
	name: "API — Body: JSON Template (inválido)",
	args: {
		selectedNodes: [
			{
				...apiNodeBase,
				config: {
					...apiNodeBase.config,
					bodyConfig: {
						mode: "raw-json",
						rawJson: '{"loanId": }',
					},
				},
			},
		],
		selectedEdges: [],
	},
};

// ─── NLS Node Stories ──────────────────────────────────────────────────────────

const nlsNodeBase: WorkflowNode = {
	id: "nls-1",
	type: "NLS",
	title: "NLS Operation",
	description: "Operación NLS",
	roles: [],
	config: {
		functionId: undefined,
		fields: [],
		failureHandling: {
			onFailure: "stop",
			maxRetries: 0,
			retryCount: 0,
			cacheStrategy: "always-execute",
			timeout: 30000,
		},
	},
	staleTimeout: null,
	position: { x: 150, y: 400 },
	groupId: null,
};

export const NlsNodeEmpty: Story = {
	name: "NLS — Sin función seleccionada",
	args: {
		selectedNodes: [nlsNodeBase],
		selectedEdges: [],
	},
};

export const NlsNodeCreateLoan: Story = {
	name: "NLS — createLoan",
	args: {
		selectedNodes: [
			{
				...nlsNodeBase,
				title: "Crear Préstamo",
				config: {
					...nlsNodeBase.config,
					functionId: "createLoan",
					fields: [
						{
							fieldId: "loanNumber",
							value: "${start.loanNumber}",
							source: "discovered",
						},
						{
							fieldId: "source",
							value: "PORTAL",
							source: "discovered",
						},
					],
				},
			},
		],
		selectedEdges: [],
	},
};

// ── Oleada 1 — Loan Reads representative stories ─────────────────────────────

export const NlsNodeGetLoan: Story = {
	name: "NLS — getLoan",
	args: {
		selectedNodes: [
			{
				...nlsNodeBase,
				title: "Obtener Préstamo",
				config: {
					...nlsNodeBase.config,
					functionId: "getLoan" as const,
					fields: [
						{
							fieldId: "loanNumber",
							value: "${start.loanNumber}",
							source: "discovered" as const,
						},
					],
				},
			},
		],
		selectedEdges: [],
	},
};

export const NlsNodeGetPaymentInfo: Story = {
	name: "NLS — getPaymentInfo",
	args: {
		selectedNodes: [
			{
				...nlsNodeBase,
				title: "Obtener Info de Pago",
				config: {
					...nlsNodeBase.config,
					functionId: "getPaymentInfo" as const,
					fields: [
						{
							fieldId: "loanNumber",
							value: "${start.loanNumber}",
							source: "discovered" as const,
						},
					],
				},
			},
		],
		selectedEdges: [],
	},
};

// ── Collection Comments & Search representative stories ───────────────────────

export const NlsNodeAddCollectionComment: Story = {
	name: "NLS — addCollectionComment",
	args: {
		selectedNodes: [
			{
				...nlsNodeBase,
				title: "Agregar Comentario de Cobranza",
				config: {
					...nlsNodeBase.config,
					functionId: "addCollectionComment" as const,
					fields: [
						{
							fieldId: "loanNumber",
							value: "${start.loanNumber}",
							source: "discovered" as const,
						},
						{
							fieldId: "Action_Code_No",
							value: "10",
							source: "manual" as const,
						},
						{
							fieldId: "Result_Code_No",
							value: "22",
							source: "manual" as const,
						},
						{
							fieldId: "Comments",
							value: "${start.commentText}",
							source: "discovered" as const,
						},
					],
				},
			},
		],
		selectedEdges: [],
	},
};

export const NlsNodeSearchLoans: Story = {
	name: "NLS — searchLoans",
	args: {
		selectedNodes: [
			{
				...nlsNodeBase,
				title: "Buscar Préstamos por CIF",
				config: {
					...nlsNodeBase.config,
					functionId: "searchLoans" as const,
					fields: [
						{
							fieldId: "Cifno",
							value: "${prequal.cifNumber}",
							source: "discovered" as const,
						},
						{
							fieldId: "limit",
							value: "10",
							source: "manual" as const,
						},
					],
					// outputSchema populated as it would be after the function is
					// selected in the editor (nlsOutputFieldsToSchema from proxy-svc)
					outputSchema: {
						name: "searchLoansOutput",
						properties: [
							{
								id: "nls-searchLoans-items",
								name: "items",
								type: "array",
								readOnly: true,
								items: {
									id: "nls-searchLoans-items-item",
									name: "item",
									type: "object",
									readOnly: true,
									properties: [
										{
											id: "nls-searchLoans-items-item-Loan_Number",
											name: "Loan_Number",
											type: "string",
											readOnly: true,
										},
										{
											id: "nls-searchLoans-items-item-Cifno",
											name: "Cifno",
											type: "number",
											readOnly: true,
										},
										{
											id: "nls-searchLoans-items-item-Name",
											name: "Name",
											type: "string",
											readOnly: true,
										},
										{
											id: "nls-searchLoans-items-item-Status_Code_No",
											name: "Status_Code_No",
											type: "number",
											readOnly: true,
										},
										{
											id: "nls-searchLoans-items-item-Current_Payoff_Balance",
											name: "Current_Payoff_Balance",
											type: "number",
											readOnly: true,
										},
									],
								},
							},
							{
								id: "nls-searchLoans-total",
								name: "total",
								type: "number",
								readOnly: true,
							},
						],
					},
				},
			},
		],
		selectedEdges: [],
	},
};

// ── Contacts & Utils representative stories ────────────────────────────────────

export const NlsNodeGetContact: Story = {
	name: "NLS — getContact",
	args: {
		selectedNodes: [
			{
				...nlsNodeBase,
				title: "Obtener Contacto",
				config: {
					...nlsNodeBase.config,
					functionId: "getContact" as const,
					fields: [
						{
							fieldId: "cifNo",
							value: "${start.cifNumber}",
							source: "discovered" as const,
						},
					],
				},
			},
		],
		selectedEdges: [],
	},
};

export const NlsNodeCalculateAmortizedPayment: Story = {
	name: "NLS — calculateAmortizedPayment",
	args: {
		selectedNodes: [
			{
				...nlsNodeBase,
				title: "Calcular Pago Amortizado",
				config: {
					...nlsNodeBase.config,
					functionId: "calculateAmortizedPayment" as const,
					fields: [
						{
							fieldId: "LoanAmount",
							value: "${start.loanAmount}",
							source: "discovered" as const,
						},
						{
							fieldId: "InterestRate",
							value: "${start.interestRate}",
							source: "discovered" as const,
						},
						{
							fieldId: "NumberOfPayments",
							value: "${start.term}",
							source: "discovered" as const,
						},
						{
							fieldId: "PaymentsPerYear",
							value: "12",
							source: "manual" as const,
						},
					],
				},
			},
		],
		selectedEdges: [],
	},
};

export const NlsNodeGetAmortization: Story = {
	name: "NLS — getAmortization",
	args: {
		selectedNodes: [
			{
				...nlsNodeBase,
				title: "Tabla de Amortización",
				config: {
					...nlsNodeBase.config,
					functionId: "getAmortization",
					fields: [
						{
							fieldId: "loanNumber",
							value: "${start.loanNumber}",
							source: "discovered",
						},
					],
					failureHandling: {
						onFailure: "continue",
						maxRetries: 1,
						retryCount: 0,
						cacheStrategy: "always-execute",
						timeout: 60000,
					},
				},
			},
		],
		selectedEdges: [],
	},
};

export const NlsNodePrequalificationApplicant: Story = {
	name: "NLS — prequalification (Applicant)",
	args: {
		selectedNodes: [
			{
				...nlsNodeBase,
				title: "Precalificación",
				config: {
					...nlsNodeBase.config,
					functionId: "prequalification",
					fields: [
						{
							fieldId: "actorType",
							value: "applicant",
							source: "manual",
						},
						{
							fieldId: "pullType",
							value: "soft",
							source: "manual",
						},
					],
					failureHandling: {
						onFailure: "stop",
						maxRetries: 1,
						retryCount: 0,
						cacheStrategy: "always-execute",
						timeout: 60000,
					},
				},
			},
		],
		selectedEdges: [],
	},
};

export const NlsNodePrequalificationCoapplicant: Story = {
	name: "NLS — prequalification (Coapplicant)",
	args: {
		selectedNodes: [
			{
				...nlsNodeBase,
				title: "Precalificación Cosolicitante",
				config: {
					...nlsNodeBase.config,
					functionId: "prequalification",
					fields: [
						{
							fieldId: "actorType",
							value: "coapplicant",
							source: "manual",
						},
						{
							fieldId: "pullType",
							value: "hard",
							source: "manual",
						},
						{
							fieldId: "firstName",
							value: "${form.firstName}",
							source: "discovered",
						},
						{
							fieldId: "lastName",
							value: "${form.lastName}",
							source: "discovered",
						},
						{
							fieldId: "email",
							value: "${form.email}",
							source: "discovered",
						},
						{
							fieldId: "addressStreetNumber",
							value: "${form.streetNumber}",
							source: "discovered",
						},
						{
							fieldId: "addressStreetName",
							value: "${form.streetName}",
							source: "discovered",
						},
						{
							fieldId: "addressCity",
							value: "${form.city}",
							source: "discovered",
						},
						{
							fieldId: "addressState",
							value: "${form.state}",
							source: "discovered",
						},
						{
							fieldId: "addressZipCode",
							value: "${form.zipCode}",
							source: "discovered",
						},
					],
					failureHandling: {
						onFailure: "retry",
						maxRetries: 2,
						retryCount: 0,
						cacheStrategy: "always-execute",
						timeout: 90000,
					},
				},
			},
		],
		selectedEdges: [],
	},
};

// ── Nuevas funciones — representative stories ─────────────────────────────────

export const NlsNodeGetContactLoans: Story = {
	name: "NLS — getContactLoans",
	args: {
		selectedNodes: [
			{
				...nlsNodeBase,
				title: "Obtener Préstamos del Contacto",
				config: {
					...nlsNodeBase.config,
					functionId: "getContactLoans" as const,
					fields: [
						{
							fieldId: "cifNo",
							value: "${prequal.cifNumber}",
							source: "discovered" as const,
						},
					],
				},
			},
		],
		selectedEdges: [],
	},
};

export const NlsNodeGetLoanTransactions: Story = {
	name: "NLS — getLoanTransactions",
	args: {
		selectedNodes: [
			{
				...nlsNodeBase,
				title: "Obtener Transacciones del Préstamo",
				config: {
					...nlsNodeBase.config,
					functionId: "getLoanTransactions" as const,
					fields: [
						{
							fieldId: "loanNumber",
							value: "${createLoan.loanNumber}",
							source: "discovered" as const,
						},
						{
							fieldId: "limit",
							value: "50",
							source: "manual" as const,
						},
					],
				},
			},
		],
		selectedEdges: [],
	},
};

export const NlsNodeAdvancePeriod: Story = {
	name: "NLS — advancePeriod",
	args: {
		selectedNodes: [
			{
				...nlsNodeBase,
				title: "Avanzar Período",
				config: {
					...nlsNodeBase.config,
					functionId: "advancePeriod" as const,
					fields: [
						{
							fieldId: "startDate",
							value: "${createLoan.firstPaymentDate}",
							source: "discovered" as const,
						},
						{
							fieldId: "period",
							value: "MO",
							source: "manual" as const,
						},
						{
							fieldId: "numberOfPeriods",
							value: "1",
							source: "manual" as const,
						},
					],
				},
			},
		],
		selectedEdges: [],
	},
};
