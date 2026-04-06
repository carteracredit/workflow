import type { Meta, StoryObj } from "@storybook/react";

import { CodeModal } from "@/components/workflow/code-modal";
import type {
	WorkflowEdge,
	WorkflowNode,
	WorkflowMetadata,
} from "@/lib/workflow/types";

const SAMPLE_METADATA: WorkflowMetadata = {
	name: "Credit Application Workflow",
	description: "A workflow for processing credit applications",
	version: "1.0.0",
	author: "Workflow Team",
	tags: ["credit", "finance"],
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
};

const SIMPLE_NODES: WorkflowNode[] = [
	{
		id: "node-start",
		type: "Start",
		title: "Inicio",
		description: "Punto de partida",
		roles: [],
		config: {},
		staleTimeout: null,
		position: { x: 0, y: 0 },
		groupId: null,
	},
	{
		id: "node-form",
		type: "Form",
		title: "Application Form",
		description: "Collect applicant data",
		roles: ["client"],
		config: {},
		staleTimeout: null,
		position: { x: 220, y: 0 },
		groupId: null,
	},
	{
		id: "node-end",
		type: "End",
		title: "Complete",
		description: "Application submitted",
		roles: [],
		config: {},
		staleTimeout: null,
		position: { x: 440, y: 0 },
		groupId: null,
	},
];

const SIMPLE_EDGES: WorkflowEdge[] = [
	{ id: "edge-01", from: "node-start", to: "node-form", label: null },
	{ id: "edge-02", from: "node-form", to: "node-end", label: null },
];

const COMPLEX_NODES: WorkflowNode[] = [
	{
		id: "node-start",
		type: "Start",
		title: "Start",
		description: "Workflow entry point",
		roles: [],
		config: {},
		staleTimeout: null,
		position: { x: 0, y: 100 },
		groupId: null,
	},
	{
		id: "node-form",
		type: "Form",
		title: "Application Form",
		description: "Collect applicant information",
		roles: ["client"],
		config: { fields: ["name", "email", "amount"] },
		staleTimeout: null,
		position: { x: 200, y: 100 },
		groupId: null,
	},
	{
		id: "node-api",
		type: "API",
		title: "Credit Check",
		description: "Verify credit score",
		roles: [],
		config: {
			endpoint: "https://api.creditbureau.com/check",
			method: "POST",
			failureHandling: {
				onFailure: "retry",
				maxRetries: 2,
				retryCount: 0,
				cacheStrategy: "always-execute",
				timeout: 30000,
			},
		},
		staleTimeout: null,
		position: { x: 400, y: 100 },
		groupId: null,
	},
	{
		id: "node-decision",
		type: "Decision",
		title: "Amount Check",
		description: "Check if amount exceeds limit",
		roles: [],
		config: { condition: "creditScore > 700 && amount < 50000" },
		staleTimeout: null,
		position: { x: 600, y: 100 },
		groupId: null,
	},
	{
		id: "node-challenge",
		type: "Challenge",
		title: "Manager Approval",
		description: "Require manager approval for high amounts",
		roles: ["org_manager"],
		config: {
			challengeType: "acceptance",
			challengeTimeout: { value: 24, unit: "hours" },
			deliveryMethod: "email",
		},
		staleTimeout: null,
		position: { x: 800, y: 200 },
		groupId: null,
	},
	{
		id: "node-message",
		type: "Message",
		title: "Send Confirmation",
		description: "Send approval confirmation email",
		roles: [],
		config: { type: "email", template: "approval-confirmation" },
		staleTimeout: null,
		position: { x: 800, y: 0 },
		groupId: null,
	},
	{
		id: "node-end",
		type: "End",
		title: "Approved",
		description: "Application approved",
		roles: [],
		config: {},
		staleTimeout: null,
		position: { x: 1000, y: 0 },
		groupId: null,
	},
	{
		id: "node-reject",
		type: "Reject",
		title: "Rejected",
		description: "Application rejected",
		roles: [],
		config: {},
		staleTimeout: null,
		position: { x: 1000, y: 200 },
		groupId: null,
	},
];

const COMPLEX_EDGES: WorkflowEdge[] = [
	{ id: "edge-01", from: "node-start", to: "node-form", label: null },
	{ id: "edge-02", from: "node-form", to: "node-api", label: null },
	{ id: "edge-03", from: "node-api", to: "node-decision", label: null },
	{
		id: "edge-04",
		from: "node-decision",
		to: "node-message",
		label: "Yes",
		fromPort: "top",
	},
	{
		id: "edge-05",
		from: "node-decision",
		to: "node-challenge",
		label: "No",
		fromPort: "bottom",
	},
	{
		id: "edge-06",
		from: "node-challenge",
		to: "node-end",
		label: "Approved",
		fromPort: "top",
	},
	{
		id: "edge-07",
		from: "node-challenge",
		to: "node-reject",
		label: "Rejected",
		fromPort: "bottom",
	},
	{ id: "edge-08", from: "node-message", to: "node-end", label: null },
];

const INCOMPLETE_NODES: WorkflowNode[] = [
	{
		id: "node-form",
		type: "Form",
		title: "Orphan Form",
		description: "A form without connections",
		roles: [],
		config: {},
		staleTimeout: null,
		position: { x: 0, y: 0 },
		groupId: null,
	},
];

const meta = {
	title: "Components/Workflow/CodeModal",
	component: CodeModal,
	parameters: {
		layout: "fullscreen",
	},
} satisfies Meta<typeof CodeModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SimpleWorkflow: Story = {
	args: {
		nodes: SIMPLE_NODES,
		edges: SIMPLE_EDGES,
		metadata: SAMPLE_METADATA,
		onClose: () => {},
	},
	render: (args) => (
		<div className="bg-background p-6">
			<CodeModal {...args} />
		</div>
	),
};

export const ComplexWorkflow: Story = {
	args: {
		nodes: COMPLEX_NODES,
		edges: COMPLEX_EDGES,
		metadata: {
			...SAMPLE_METADATA,
			name: "Credit Application with Approval",
			description:
				"A complex workflow with API calls, decisions, and manual approvals",
		},
		onClose: () => {},
	},
	render: (args) => (
		<div className="bg-background p-6">
			<CodeModal {...args} />
		</div>
	),
};

export const WithValidationErrors: Story = {
	args: {
		nodes: INCOMPLETE_NODES,
		edges: [],
		metadata: {
			...SAMPLE_METADATA,
			name: "Incomplete Workflow",
		},
		onClose: () => {},
	},
	render: (args) => (
		<div className="bg-background p-6">
			<CodeModal {...args} />
		</div>
	),
};

export const WithoutMetadata: Story = {
	args: {
		nodes: SIMPLE_NODES,
		edges: SIMPLE_EDGES,
		onClose: () => {},
	},
	render: (args) => (
		<div className="bg-background p-6">
			<CodeModal {...args} />
		</div>
	),
};
