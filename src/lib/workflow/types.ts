export type NodeType =
	| "Start"
	| "Reject"
	| "End"
	| "Form"
	| "Decision"
	| "Transform"
	| "API"
	| "Message"
	| "Challenge"
	| "Checkpoint"
	| "Join" // Added Join node type for merging multiple flows
	| "FlagChange"; // Nodo para cambiar flags del workflow

export type CheckpointType = "normal" | "safe";

export type Role =
	| "Solicitante"
	| "Vendedor"
	| "Dealer"
	| "Agente de Crédito"
	| "Cobranza"
	| "Admin";

export const ROLE_OPTIONS: Role[] = [
	"Solicitante",
	"Vendedor",
	"Dealer",
	"Agente de Crédito",
	"Cobranza",
	"Admin",
];

// API Node Failure Handling Configuration
export type APIFailureStrategy =
	| "stop"
	| "retry"
	| "continue"
	| "return-to-checkpoint";
export type APICacheStrategy =
	| "always-execute"
	| "cache-until-checkpoint-reset"
	| "cache-until-workflow-end";

export interface APIFailureHandling {
	onFailure: APIFailureStrategy;
	maxRetries: number; // 0-2
	retryCount: number; // Runtime counter
	cacheStrategy: APICacheStrategy;
	cachedResponse?: unknown; // Runtime cache
	cacheKey?: string; // Runtime cache key
	timeout: number; // milliseconds (5000-300000)
}

export type TimeoutUnit = "seconds" | "minutes" | "hours" | "days";

export type ChallengeType = "acceptance" | "signature";
export type ChallengeDeliveryMethod = "none" | "sms" | "email" | "both";
export const MAX_CHALLENGE_RETRIES = 5;

export interface ChallengeTimeoutConfig {
	value: number;
	unit: TimeoutUnit;
}

export interface ChallengeRetryConfig {
	maxRetries: number;
	roles: Role[];
}

export interface AcceptanceChallengeConfig extends Record<string, unknown> {
	challengeType: "acceptance" | "signature";
	challengeTimeout: ChallengeTimeoutConfig;
	deliveryMethod: ChallengeDeliveryMethod;
	retries?: ChallengeRetryConfig;
}

export type ChallengeNodeConfig = AcceptanceChallengeConfig;

export const DEFAULT_CHALLENGE_TIMEOUT: ChallengeTimeoutConfig = {
	value: 5,
	unit: "minutes",
};

export const DEFAULT_CHALLENGE_RETRY_CONFIG: ChallengeRetryConfig = {
	maxRetries: 1,
	roles: [],
};

export function createDefaultChallengeConfig(
	challengeType: ChallengeType = "acceptance",
	options?: { challengeTimeout?: ChallengeTimeoutConfig },
): ChallengeNodeConfig {
	const timeout = {
		...(options?.challengeTimeout ?? DEFAULT_CHALLENGE_TIMEOUT),
	};

	return {
		challengeType,
		challengeTimeout: timeout,
		deliveryMethod: "none",
	};
}

export const STALE_SUPPORTED_NODE_TYPES: NodeType[] = [
	"Form",
	"Decision",
	"Transform",
	"API",
	"Message",
	"Challenge",
];

export interface StaleTimeoutConfig {
	value: number;
	unit: TimeoutUnit;
}

export interface WorkflowNode {
	id: string;
	type: NodeType;
	checkpointType?: CheckpointType;
	title: string;
	description: string;
	roles: Role[];
	config: Record<string, unknown>;
	staleTimeout?: StaleTimeoutConfig | null;
	position: { x: number; y: number };
	groupId: string | null;
}

export function isChallengeNode(
	node: WorkflowNode,
): node is WorkflowNode & { type: "Challenge"; config: ChallengeNodeConfig } {
	return node.type === "Challenge";
}

export interface WorkflowEdge {
	id: string;
	from: string;
	to: string;
	label: string | null;
	fromPort?: "top" | "bottom"; // For Decision/Challenge nodes with two outputs
	toPort?: "top" | "middle" | "bottom"; // For Join nodes with multiple inputs
	color?: string; // Custom edge color (defaults to theme colors)
	thickness?: number; // Edge thickness in pixels (1-5)
}

export interface ValidationError {
	nodeId?: string;
	message: string;
	severity: "error" | "warning";
}

export interface WorkflowMetadata {
	name: string;
	description: string;
	version: string;
	author: string;
	tags: string[];
	createdAt: string;
	updatedAt: string;
}

// Flag System Types
export interface FlagOption {
	id: string;
	label: string;
	color: string; // Tailwind color class (e.g., "red-500")
}

export interface Flag {
	id: string;
	name: string;
	options: FlagOption[];
}

export interface WorkflowState {
	metadata: WorkflowMetadata; // Added metadata to workflow state
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	flags: Flag[]; // Global flags for the workflow
	selectedNodeIds: string[]; // Multiple node selection support
	selectedEdgeIds: string[]; // Multiple edge selection support
	zoom: number;
	pan: { x: number; y: number };
	history: Array<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] }>;
	historyIndex: number;
}
