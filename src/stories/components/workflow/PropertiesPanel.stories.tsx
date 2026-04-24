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
