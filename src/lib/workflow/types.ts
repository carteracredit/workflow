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
	| "Promotion"
	| "Checkpoint"
	| "Join"
	| "FlagChange"
	| "NLS"
	| "ExternalLink";

export type CheckpointType = "normal" | "safe";

export type Role = "client" | "seller" | "credit_agent" | "org_manager";

export const ROLE_OPTIONS: Role[] = [
	"client",
	"seller",
	"credit_agent",
	"org_manager",
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

// API Node Authentication Configuration
export type APIAuthType =
	| "none"
	| "bearer"
	| "api-key"
	| "oauth2-client-credentials";

export interface APIAuthConfig {
	type: APIAuthType;
	// Bearer: env var name whose value is the token
	bearerToken?: string;
	// API Key: header name + env var name holding the key value
	apiKeyHeader?: string;
	apiKeyValue?: string;
	// OAuth2 Client Credentials / Password grant
	oauth2TokenUrl?: string; // env var name or literal URL
	oauth2ClientId?: string; // env var name
	oauth2ClientSecret?: string; // env var name
	oauth2Scope?: string; // env var name (optional)
	oauth2Username?: string; // env var name (password grant)
	oauth2Password?: string; // env var name (password grant)
}

// Custom request headers
export interface APIHeaderEntry {
	key: string;
	value: string; // literal, env var name prefix "env:", or ${nodeId.prop}
}

// Request body configuration
export type APIBodyMode = "none" | "raw-json" | "raw-xml" | "field-mapping";

export interface APIBodyFieldMapping {
	sourceExpression: string; // ${nodeId.prop} or literal
	targetKey: string;
}

export interface APIBodyConfig {
	mode: APIBodyMode;
	rawJson?: string;
	rawXml?: string;
	fieldMappings?: APIBodyFieldMapping[];
}

// Response extraction
export interface APIResponseConfig {
	extractPath?: string; // dot-notation, e.g. "payload.data"
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
	/** Optional UI labels shown in the cases resolver. Fallback to hardcoded defaults when absent. */
	labels?: ChallengeLabels;
}

export interface ChallengeLabels {
	/** Prompt text shown above the approve/reject buttons (EN) */
	prompt?: string;
	/** Prompt text shown above the approve/reject buttons (ES) */
	promptEs?: string;
	/** Label for the positive/approve button (EN) */
	approveLabel?: string;
	/** Label for the positive/approve button (ES) */
	approveLabelEs?: string;
	/** Label for the negative/reject button (EN) */
	rejectLabel?: string;
	/** Label for the negative/reject button (ES) */
	rejectLabelEs?: string;
}

export type ChallengeNodeConfig =
	| AcceptanceChallengeConfig
	| SignatureChallengeConfig;

// ─── Signature Challenge Config ────────────────────────────────────────────────

export type SignatureFlow = "embedded" | "email_only" | "email_and_sms";

/**
 * Configuration for a single signer in a Dropbox Sign signature request.
 * source === "case_role" auto-resolves email/name from the case at runtime.
 * source === "variable" uses VariableTemplateInput expressions.
 */
export interface SignatureSignerConfig {
	/** Role name as defined in the Dropbox Sign template (e.g. "Client", "Dealer"). */
	role: string;
	source: "case_role" | "variable";
	/** Only set when source === "case_role". Mapped to a user in cases-svc. */
	caseRole?: "client" | "seller" | "credit_agent" | "org_manager";
	/** Template expression for email when source === "variable". */
	email?: string;
	/** Template expression for name when source === "variable". */
	name?: string;
	/** E.164 phone for SMS Delivery add-on. Only used when flow === "email_and_sms". */
	smsPhoneNumber?: string;
}

/**
 * Configuration for a single custom field injected into the Dropbox Sign template.
 * source === "discovered" means the field was loaded via API (auto-discover).
 * source === "manual" means the user added it manually.
 */
export interface SignatureCustomFieldConfig {
	apiId: string;
	name: string;
	/** "text" | "checkbox" | "date_signed" | "dropdown" | "initials" */
	type?: string;
	/** Template expression value (may reference workflow variables). */
	value: string;
	required?: boolean;
	source: "discovered" | "manual";
}

/**
 * Full config for a Challenge node with challengeType === "signature".
 * Extends AcceptanceChallengeConfig (inherits timeout, deliveryMethod, retries, labels).
 *
 * NOTE: deliveryMethod on AcceptanceChallengeConfig controls how the actor is
 * NOTIFIED that a challenge is waiting. It has NO relation to the Dropbox Sign
 * email/SMS delivery flow (controlled by `flow` here).
 */
export interface SignatureChallengeConfig extends AcceptanceChallengeConfig {
	challengeType: "signature";
	/**
	 * Dropbox Sign template ID. Accepts a workflow variable expression such as
	 * `${case.templates.withCoBuyer}` so the correct template can be chosen
	 * dynamically by an upstream Transform/Decision node.
	 */
	templateId: string;
	/** How the signature request is delivered to signers. */
	flow: SignatureFlow;
	/** Optional title (admite template expressions). */
	title?: string;
	/** Optional email subject sent by Dropbox Sign. */
	subject?: string;
	/** Optional message body in the Dropbox Sign email. */
	message?: string;
	signers: SignatureSignerConfig[];
	customFields: SignatureCustomFieldConfig[];
	/** CC email addresses for the Dropbox Sign request. */
	ccEmailAddresses?: string[];
	/**
	 * When true, forces test_mode on this node regardless of the env variable.
	 * When false, forces production mode. When undefined, uses env default.
	 */
	testMode?: boolean;
	/** When true, adds SMS authentication (OTP) for signers with phone number. */
	smsAuthentication?: boolean;
}

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

	if (challengeType === "signature") {
		const base: SignatureChallengeConfig = {
			challengeType: "signature",
			challengeTimeout: timeout,
			deliveryMethod: "none",
			templateId: "",
			flow: "email_only",
			signers: [],
			customFields: [],
		};
		return base;
	}

	return {
		challengeType,
		challengeTimeout: timeout,
		deliveryMethod: "none",
	};
}

/**
 * Default commission (in currency units) used in the PMT formula when the
 * Promotion node does not override it. Kept as a module-level constant so
 * `cases-svc` and `cases` can reuse the same default when they recompute PMT.
 */
export const DEFAULT_PROMOTION_COMMISSION = 55;

export interface PromotionNodeConfig extends Record<string, unknown> {
	/**
	 * Fixed commission added to the financed principal when computing the
	 * monthly payment (PMT) for the selected promotion. Editable per-node so
	 * business users can adjust it without redeploying code.
	 */
	commission: number;
}

export function createDefaultPromotionConfig(): PromotionNodeConfig {
	return { commission: DEFAULT_PROMOTION_COMMISSION };
}

export const STALE_SUPPORTED_NODE_TYPES: NodeType[] = [
	"Form",
	"Decision",
	"Transform",
	"API",
	"Message",
	"Challenge",
	"Promotion",
	"NLS",
	"ExternalLink",
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
	titleEs?: string;
	description: string;
	descriptionEs?: string;
	roles: Role[];
	visibilityRoles?: Role[];
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

export function isPromotionNode(
	node: WorkflowNode,
): node is WorkflowNode & { type: "Promotion"; config: PromotionNodeConfig } {
	return node.type === "Promotion";
}

export type MessageChannel = "email" | "sms";

export interface MessageMergeVar {
	key: string;
	value: string;
}

export interface MessageNodeConfig extends Record<string, unknown> {
	channel: MessageChannel;
	// Email-specific
	templateName?: string;
	subject?: string;
	mergeVars?: MessageMergeVar[];
	// SMS-specific
	body?: string;
}

export function isMessageNode(
	node: WorkflowNode,
): node is WorkflowNode & { type: "Message"; config: MessageNodeConfig } {
	return node.type === "Message";
}

// ─── ExternalLink Node Config ────────────────────────────────────────────────

export type ExternalLinkMode = "form" | "challenge";
export type ExternalLinkChannel = "email" | "sms";

export interface ExternalRecipientConfig {
	source: "variable" | "literal";
	emailExpression?: string;
	phoneExpression?: string;
	nameExpression?: string;
}

export interface ExternalLinkTtlConfig {
	value: number;
	unit: "hours" | "days";
}

export interface ExternalLinkEmailConfig {
	templateName: string;
	subject: string;
	mergeVars: MessageMergeVar[];
	/**
	 * Name of the Mandrill merge variable that will receive the generated
	 * access link (e.g. *|URL|* in the template). Defaults to "URL".
	 * Set to an empty string to skip automatic URL injection entirely.
	 */
	urlVarName?: string;
}

export interface ExternalLinkSmsConfig {
	body: string;
}

export interface ExternalLinkNodeConfig extends Record<string, unknown> {
	mode: ExternalLinkMode;
	linkTtl: ExternalLinkTtlConfig;
	recipient: ExternalRecipientConfig;
	channels: ExternalLinkChannel[];
	emailConfig?: ExternalLinkEmailConfig;
	smsConfig?: ExternalLinkSmsConfig;
	formConfig?: {
		formId: string;
		formVersion?: number;
		outputSchema?: OutputSchema;
	};
	challengeConfig?: {
		challengeType: "acceptance";
		labels?: ChallengeLabels;
		timeout: ChallengeTimeoutConfig;
	};
}

export function isExternalLinkNode(node: WorkflowNode): node is WorkflowNode & {
	type: "ExternalLink";
	config: ExternalLinkNodeConfig;
} {
	return node.type === "ExternalLink";
}

export function createDefaultExternalLinkConfig(): ExternalLinkNodeConfig {
	return {
		mode: "form",
		linkTtl: { value: 72, unit: "hours" },
		recipient: { source: "variable" },
		channels: ["email"],
		emailConfig: { templateName: "", subject: "", mergeVars: [] },
		formConfig: { formId: "" },
	};
}

export interface WorkflowEdge {
	id: string;
	from: string;
	to: string;
	label: string | null;
	labelEs?: string | null;
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
	nameEs?: string;
	description: string;
	descriptionEs?: string;
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

// Output Schema Types
export type SchemaPropertyType =
	| "string"
	| "number"
	| "boolean"
	| "object"
	| "array"
	| "enum";

export interface OutputSchemaProperty {
	id: string;
	name: string;
	type: SchemaPropertyType;
	description?: string;
	enumValues?: string[]; // only when type === "enum"
	items?: OutputSchemaProperty; // only when type === "array"
	properties?: OutputSchemaProperty[]; // only when type === "object"
	/**
	 * When `true`, the property is system-provided (e.g. fixed case data that
	 * always arrives with the workflow payload) and cannot be edited or removed
	 * from the output schema editor. It is still selectable in VariablePickers.
	 */
	readOnly?: boolean;
}

export interface OutputSchema {
	name: string;
	properties: OutputSchemaProperty[];
}

// ─── NLS Node Config ────────────────────────────────────────────────────────

export type NLSFunctionId =
	| "createLoan"
	| "cancelLoan"
	| "getAmortization"
	| "prequalification"
	| "findPrequalificationMatches"
	// Loan Reads
	| "getLoan"
	| "getLoanDetail1"
	| "getPaymentInfo"
	| "getCollectionFields"
	| "getStatuses"
	| "getPaymentHistory"
	| "getPaymentsDue"
	| "getPayoffAmounts"
	| "getPayoffDetails"
	// Collection Comments
	| "addCollectionComment"
	| "updateCollectionComment"
	// Contacts & Search
	| "getContact"
	| "searchContacts"
	| "searchLoans"
	// Calculations
	| "calculateAmortizedPayment"
	// Nuevas funciones
	| "getContactLoans"
	| "getContactPortfolio"
	| "getContactEmployments"
	| "getLoanTransactions"
	| "getAmortizationSchedule"
	| "advancePeriod"
	| "getLoanStatusCodes";

export interface NLSFieldConfig {
	fieldId: string;
	value: string;
	source: "discovered" | "manual";
}

export interface NLSNodeConfig extends Record<string, unknown> {
	functionId?: NLSFunctionId;
	fields: NLSFieldConfig[];
	failureHandling: APIFailureHandling;
}

export function isNLSNode(
	node: WorkflowNode,
): node is WorkflowNode & { type: "NLS"; config: NLSNodeConfig } {
	return node.type === "NLS";
}

export function createDefaultNLSConfig(): NLSNodeConfig {
	return {
		functionId: undefined,
		fields: [],
		failureHandling: {
			onFailure: "stop",
			maxRetries: 0,
			retryCount: 0,
			cacheStrategy: "always-execute",
			timeout: 30000,
		},
	};
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
