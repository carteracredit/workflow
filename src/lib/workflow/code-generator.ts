import type {
	WorkflowNode,
	WorkflowEdge,
	WorkflowMetadata,
	ChallengeNodeConfig,
	APIFailureHandling,
	MessageNodeConfig,
	OutputSchema,
} from "./types";
import { slugify } from "../slugify";
import {
	validateTransformCode,
	validateConditionExpression,
} from "./validate-code";

/**
 * Configuration for code generation
 */
export interface CodeGeneratorOptions {
	/** Name of the workflow class */
	className?: string;
	/** Include comments in generated code */
	includeComments?: boolean;
	/** Include type imports */
	includeImports?: boolean;
}

/**
 * Result of code generation
 */
export interface GeneratedCode {
	code: string;
	warnings: string[];
}

/**
 * Helper to create a valid step name from node title
 */
function createStepName(node: WorkflowNode): string {
	const base = slugify(node.title || node.type);
	return base || `step-${node.id.slice(-6)}`;
}

/**
 * Helper to create a valid JavaScript variable name in camelCase
 * Converts "Formulario A" to "formularioA", "Decisión 1" to "decision1", etc.
 */
function createVariableName(title: string, fallback: string): string {
	if (!title || title.trim().length === 0) {
		return fallback;
	}

	// Remove quotes and normalize
	const cleaned = title
		.replace(/['"]/g, "")
		.replace(/á/g, "a")
		.replace(/é/g, "e")
		.replace(/í/g, "i")
		.replace(/ó/g, "o")
		.replace(/ú/g, "u")
		.replace(/ñ/g, "n")
		.replace(/Á/g, "A")
		.replace(/É/g, "E")
		.replace(/Í/g, "I")
		.replace(/Ó/g, "O")
		.replace(/Ú/g, "U")
		.replace(/Ñ/g, "N");

	// Split by non-alphanumeric characters
	const words = cleaned.split(/[^a-zA-Z0-9]+/).filter((w) => w.length > 0);

	if (words.length === 0) {
		return fallback;
	}

	// First word lowercase, rest with first letter uppercase (camelCase)
	const camelCased = words
		.map((word, index) => {
			if (index === 0) {
				return word.charAt(0).toLowerCase() + word.slice(1).toLowerCase();
			}
			return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
		})
		.join("");

	// Ensure it starts with a letter or underscore
	if (!/^[a-zA-Z_]/.test(camelCased)) {
		return `${fallback}${camelCased}`;
	}

	return camelCased;
}

/**
 * Helper to escape string for use in generated code (double-quoted strings).
 */
function escapeString(str: string): string {
	return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * Converts a node ID into a valid JavaScript identifier by replacing hyphens
 * with underscores. E.g. "node-1773093521695" → "node_1773093521695".
 */
function nodeIdToVarName(nodeId: string): string {
	return nodeId.replace(/-/g, "_");
}

/**
 * Expands variable-picker references of the form `${nodeId.property}` into
 * valid JavaScript property-access expressions.
 *
 * The picker stores references using template-literal syntax which is NOT valid
 * in a plain JS expression (e.g. inside an `if` condition or a code block).
 * This helper converts them so that, for example,
 * `${node-123.count} > 0` becomes `node_123.count > 0`.
 *
 * Use this for Decision conditions and Transform code bodies (bare expressions).
 * For quoted string values use `emitInterpolatedString` instead.
 */
function expandVariableRefs(expr: string): string {
	return expr.replace(/\$\{([^}]+)\}/g, (_, path: string) =>
		path.replace(/-/g, "_"),
	);
}

/**
 * Returns true when the string contains at least one `${...}` variable reference
 * inserted by the variable picker.
 */
function containsVariableRefs(str: string): boolean {
	return /\$\{[^}]+\}/.test(str);
}

/**
 * Emits a string value for use in generated TypeScript source code.
 *
 * - If the string has no variable references it is wrapped in double quotes
 *   (existing behaviour).
 * - If the string contains `${nodeId.property}` references it is wrapped in
 *   backticks so the references become valid template-literal interpolations.
 *   Node IDs are also dehyphenated (e.g. `node-123` → `node_123`) to produce
 *   valid JavaScript identifiers.
 *
 * Examples:
 *   "https://api.example.com/items"         → `"https://api.example.com/items"`
 *   "${node-123.results[0].url}"            → `` `${node_123.results[0].url}` ``
 *   "https://api.example.com/${node-123.id}" → `` `https://api.example.com/${node_123.id}` ``
 */
function emitInterpolatedString(str: string): string {
	if (!containsVariableRefs(str)) {
		return `"${escapeString(str)}"`;
	}
	// Dehyphenate node IDs inside ${...} so they are valid JS identifiers,
	// then wrap the whole thing in backticks.
	const expanded = str.replace(/\$\{([^}]+)\}/g, (_, path: string) => {
		return `\${${path.replace(/-/g, "_")}}`;
	});
	// Escape any backticks inside the literal part (outside ${...}).
	const escaped = expanded.replace(/`/g, "\\`");
	return `\`${escaped}\``;
}

/**
 * Returns true when the node has an output schema with at least one property,
 * meaning its step result should be captured in a variable.
 */
function nodeHasOutputSchema(node: WorkflowNode): boolean {
	const schema = node.config.outputSchema as OutputSchema | undefined;
	return !!(schema?.properties && schema.properties.length > 0);
}

/**
 * Comparator for deterministic edge ordering.
 * Edges are sorted by (from, to, fromPort, toPort) so that deleting and
 * re-creating an equivalent edge yields the same generated code.
 */
function compareEdges(a: WorkflowEdge, b: WorkflowEdge): number {
	if (a.from !== b.from) return a.from.localeCompare(b.from);
	if (a.to !== b.to) return a.to.localeCompare(b.to);
	const aFromPort = a.fromPort ?? "";
	const bFromPort = b.fromPort ?? "";
	if (aFromPort !== bFromPort) return aFromPort.localeCompare(bFromPort);
	const aToPort = a.toPort ?? "";
	const bToPort = b.toPort ?? "";
	return aToPort.localeCompare(bToPort);
}

/**
 * Build adjacency maps for graph traversal.
 * Edges are sorted deterministically so that re-ordering the input array
 * (e.g. after deleting and re-adding an edge) does not change the output.
 */
function buildAdjacencyMaps(edges: WorkflowEdge[]): {
	outgoingMap: Map<string, WorkflowEdge[]>;
	incomingMap: Map<string, WorkflowEdge[]>;
} {
	const sortedEdges = [...edges].sort(compareEdges);

	const outgoingMap = new Map<string, WorkflowEdge[]>();
	const incomingMap = new Map<string, WorkflowEdge[]>();

	for (const edge of sortedEdges) {
		if (!outgoingMap.has(edge.from)) {
			outgoingMap.set(edge.from, []);
		}
		outgoingMap.get(edge.from)!.push(edge);

		if (!incomingMap.has(edge.to)) {
			incomingMap.set(edge.to, []);
		}
		incomingMap.get(edge.to)!.push(edge);
	}

	return { outgoingMap, incomingMap };
}

// ---------------------------------------------------------------------------
// Retry zone analysis
// ---------------------------------------------------------------------------

/**
 * Describes a "retry zone": the segment of the graph between a Checkpoint and a
 * Reject node that has `config.allowRetry === true`. During code generation, this
 * zone is wrapped in a `for` loop so the workflow re-executes from the checkpoint
 * on each rejection (up to `maxRetries` times).
 *
 * Step names inside the zone are suffixed with `-r${retryVarName}` (when > 0) to
 * satisfy Cloudflare Workflows' requirement that each step name is unique.
 */
export interface RetryZone {
	/** ID of the Checkpoint node that is the retry target */
	checkpointNodeId: string;
	/** ID of the Reject node that triggers the retry */
	rejectNodeId: string;
	/**
	 * Maximum number of retries (from Reject.config.maxRetries).
	 * Ignored when unlimited=true.
	 */
	maxRetries: number;
	/**
	 * When true the retry loop has no upper bound (maxRetries=0 in the editor,
	 * which means "unlimited" per the UI label "0 = ilimitados").
	 */
	unlimited: boolean;
	/** JS variable name used as the loop counter, e.g. "retryCP1" */
	retryVarName: string;
}

/**
 * Scans all Reject nodes with `config.allowRetry === true` and resolves the
 * associated Checkpoint target from their outgoing edge. Returns one RetryZone
 * per qualifying Reject node.
 */
export function detectRetryZones(
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
): RetryZone[] {
	const zones: RetryZone[] = [];
	const cpVarCounters = new Map<string, number>();

	for (const node of nodes) {
		if (node.type !== "Reject") continue;
		if ((node.config.allowRetry as boolean) !== true) continue;

		const outEdge = edges.find((e) => e.from === node.id);
		if (!outEdge) continue;

		const targetNode = nodes.find((n) => n.id === outEdge.to);
		if (!targetNode || targetNode.type !== "Checkpoint") continue;

		const rawMaxRetries = Number(node.config.maxRetries ?? 0);
		// In the editor, maxRetries=0 means "unlimited" ("0 = ilimitados").
		// maxRetries>0 is the explicit cap.
		const unlimited = rawMaxRetries === 0 || Number.isNaN(rawMaxRetries);
		const maxRetries = unlimited ? 0 : Math.max(1, rawMaxRetries);

		// Derive a unique JS variable name from the checkpoint title
		const cpSlug = createVariableName(targetNode.title || targetNode.id, "cp");
		const count = cpVarCounters.get(cpSlug) ?? 0;
		cpVarCounters.set(cpSlug, count + 1);
		const retryVarName =
			count === 0 ? `retry_${cpSlug}` : `retry_${cpSlug}_${count}`;

		zones.push({
			checkpointNodeId: targetNode.id,
			rejectNodeId: node.id,
			maxRetries,
			unlimited,
			retryVarName,
		});
	}

	return zones;
}

/**
 * Generates a step-name expression (TS source code) that:
 *  - On the first attempt (retryVar === 0) returns the plain base name.
 *  - On subsequent retries appends `-r${retryVar}` to guarantee uniqueness.
 *
 * Cloudflare Workflows uses step names as cache keys, so each loop iteration
 * must produce a distinct name for every step inside the retry zone.
 *
 * Example output:  `retry_cp > 0 ? \`my-step-r${retry_cp}\` : "my-step"`
 */
function retryStepNameExpr(baseName: string, retryVarName: string): string {
	return `${retryVarName} > 0 ? \`${baseName}-r\${${retryVarName}}\` : "${baseName}"`;
}

// ---------------------------------------------------------------------------
// Progress tracking helper
// ---------------------------------------------------------------------------

/**
 * Emit a WORKFLOW_SVC.updateInstanceProgress call for step tracking.
 * This is injected before/after each step so the UI can display progress.
 * When inside a retry loop, retryVarName is passed to persist the current count.
 */
function generateProgressCall(
	node: WorkflowNode,
	indent: string,
	status: "in_progress" | "completed" | "waiting_event",
	eventType?: string,
	retryVarName?: string,
): string {
	const stepName = createStepName(node);
	const nodeType = node.type;
	const nodeId = node.id;
	let code = `${indent}await this.env.WORKFLOW_SVC.updateInstanceProgress({\n`;
	code += `${indent}\tworkflowId: this.env.WORKFLOW_ID,\n`;
	code += `${indent}\tinstanceId: event.instanceId,\n`;
	code += `${indent}\tnodeId: "${escapeString(nodeId)}",\n`;
	code += `${indent}\tnodeType: "${escapeString(nodeType)}",\n`;
	code += `${indent}\tstepName: "${escapeString(stepName)}",\n`;
	code += `${indent}\tstatus: "${status}",\n`;
	if (eventType) {
		code += `${indent}\teventType: "${escapeString(eventType)}",\n`;
	}
	if (retryVarName) {
		code += `${indent}\tretryCount: ${retryVarName},\n`;
	}
	code += `${indent}});\n`;
	return code;
}

/**
 * Emit a CASES_SVC.updateCaseObject call to persist node data in the
 * CaseRealtimeDO and broadcast a real-time update to connected WebSocket clients.
 *
 * For nodes that produce output (captureResult=true), the variable name is
 * passed so the actual runtime value is stored.
 * For nodes without output, a status record {_status, _type} is stored so
 * the DO always has a complete execution history.
 *
 * The call is placed after the node's step.do / waitForEvent completes —
 * matching the pattern shown in the workflow code preview.
 */
function generateCaseObjectCall(
	node: WorkflowNode,
	indent: string,
	varName?: string,
): string {
	const stepName = createStepName(node);
	const nodeType = escapeString(node.type);
	let data: string;

	if (varName) {
		// Node produced output — store the variable directly
		data = `{"${escapeString(stepName)}": ${varName}}`;
	} else {
		// Node has no output — store execution status so the DO tracks all nodes
		data = `{"${escapeString(stepName)}": {_status: "completed", _type: "${nodeType}"}}`;
	}

	let code = `${indent}await this.env.CASES_SVC.updateCaseObject(\n`;
	code += `${indent}\tevent.payload.caseId as string,\n`;
	code += `${indent}\t${data},\n`;
	code += `${indent});\n`;
	return code;
}

// ---------------------------------------------------------------------------
// Node code generators
// ---------------------------------------------------------------------------

/**
 * Generate code for a Form node.
 * Uses step.waitForEvent so the workflow pauses until the client sends form data
 * via sendEvent({ type: "form-submission-<stepName>", payload }). No FORMS binding.
 */
function generateFormStep(
	node: WorkflowNode,
	indent: string,
	retryVarName?: string,
): string {
	const stepName = createStepName(node);
	const roles = node.roles.length > 0 ? node.roles.join(", ") : "any";
	const captureResult = nodeHasOutputSchema(node);
	const varName = nodeIdToVarName(node.id);
	const varDecl = captureResult ? `const ${varName} = ` : "";
	const eventType = `form-submission-${stepName}`;
	const stepNameExpr = retryVarName
		? retryStepNameExpr(stepName, retryVarName)
		: `"${stepName}"`;

	let code = `${indent}// Form: ${node.title} (roles: ${roles})\n`;
	code += `${indent}// Waits for sendEvent({ type: "${eventType}", payload }) from cases-svc\n`;
	code += generateProgressCall(
		node,
		indent,
		"waiting_event",
		eventType,
		retryVarName,
	);
	code += `${indent}${varDecl}(await step.waitForEvent<Record<string, unknown>>(\n`;
	code += `${indent}\t${stepNameExpr},\n`;
	code += `${indent}\t{ type: "${escapeString(eventType)}", timeout: "72 hours" },\n`;
	code += `${indent})).payload as Record<string, unknown>;\n`;
	code += generateCaseObjectCall(
		node,
		indent,
		captureResult ? varName : undefined,
	);
	code += generateProgressCall(
		node,
		indent,
		"completed",
		undefined,
		retryVarName,
	);

	return code;
}

/**
 * Generate code for an API node
 */
function generateAPIStep(
	node: WorkflowNode,
	indent: string,
	retryVarName?: string,
): string {
	const stepName = createStepName(node);
	const endpoint =
		(node.config.url as string) ||
		(node.config.endpoint as string) ||
		"/api/endpoint";
	const method = (node.config.method as string) || "GET";
	const failureHandling = node.config.failureHandling as
		| APIFailureHandling
		| undefined;
	const hasBody = ["POST", "PUT", "PATCH"].includes(method);
	const captureResult = nodeHasOutputSchema(node);
	const varName = nodeIdToVarName(node.id);
	const varDecl = captureResult ? `const ${varName} = ` : "";
	const stepNameExpr = retryVarName
		? retryStepNameExpr(stepName, retryVarName)
		: `"${stepName}"`;

	const isReturnToCheckpoint =
		failureHandling?.onFailure === "return-to-checkpoint";

	let code = `${indent}// API Call: ${node.title}\n`;
	code += generateProgressCall(
		node,
		indent,
		"in_progress",
		undefined,
		retryVarName,
	);

	// Wrap in try/catch for return-to-checkpoint failure handling
	if (isReturnToCheckpoint && retryVarName) {
		code += `${indent}try {\n`;
		indent += "\t";
	}

	code += `${indent}${varDecl}await step.do(${stepNameExpr}, async () => {\n`;
	code += `${indent}\tconst response = await fetch(${emitInterpolatedString(endpoint)}, {\n`;
	code += `${indent}\t\tmethod: "${method}",\n`;
	if (hasBody) {
		code += `${indent}\t\theaders: { "Content-Type": "application/json" },\n`;
		code += `${indent}\t\tbody: JSON.stringify(event.payload),\n`;
	}
	code += `${indent}\t});\n`;
	code += `${indent}\tif (!response.ok) {\n`;
	code += `${indent}\t\tthrow new Error(\`API call failed: \${response.status}\`);\n`;
	code += `${indent}\t}\n`;
	code += `${indent}\treturn (await response.json()) as Record<string, unknown>;\n`;
	code += `${indent}}`;

	// Add retry configuration if specified
	if (failureHandling && failureHandling.maxRetries > 0) {
		code += `, {\n`;
		code += `${indent}\tretries: {\n`;
		code += `${indent}\t\tlimit: ${failureHandling.maxRetries},\n`;
		code += `${indent}\t\tdelay: "1 second",\n`;
		code += `${indent}\t\tbackoff: "exponential",\n`;
		code += `${indent}\t},\n`;
		code += `${indent}\ttimeout: "${Math.round(failureHandling.timeout / 1000)} seconds",\n`;
		code += `${indent}}`;
	}

	code += `);\n`;
	code += generateCaseObjectCall(
		node,
		indent,
		captureResult ? varName : undefined,
	);
	code += generateProgressCall(
		node,
		indent,
		"completed",
		undefined,
		retryVarName,
	);

	// Close try/catch for return-to-checkpoint
	if (isReturnToCheckpoint && retryVarName) {
		indent = indent.slice(1);
		const retryVarOrig = retryVarName;
		// We need to get maxRetries from failureHandling; use a fallback
		const maxR = failureHandling?.maxRetries ?? 0;
		code += `${indent}} catch (_apiErr) {\n`;
		code += `${indent}\tif (${retryVarOrig} < ${maxR}) {\n`;
		code += `${indent}\t\tcontinue; // Return to checkpoint and retry\n`;
		code += `${indent}\t}\n`;
		code += `${indent}\tthrow _apiErr; // Max retries exhausted — propagate error\n`;
		code += `${indent}}\n`;
	}

	return code;
}

/**
 * Generate code for a Transform node
 */
function generateTransformStep(node: WorkflowNode, indent: string): string {
	const stepName = createStepName(node);
	const transformCode = (node.config.code as string) || "// Transform logic";
	const captureResult = nodeHasOutputSchema(node);
	const varName = nodeIdToVarName(node.id);
	const varDecl = captureResult ? `const ${varName} = ` : "";
	const resultCast = captureResult ? " as Record<string, unknown>" : "";

	let code = `${indent}// Transform: ${node.title}\n`;
	code += generateProgressCall(node, indent, "in_progress");
	code += `${indent}${varDecl}await step.do("${stepName}", async () => {\n`;
	const expandedCode = expandVariableRefs(transformCode);
	code += `${indent}\t${expandedCode.split("\n").join(`\n${indent}\t`)}\n`;
	code += `${indent}})${resultCast};\n`;
	code += generateCaseObjectCall(
		node,
		indent,
		captureResult ? varName : undefined,
	);
	code += generateProgressCall(node, indent, "completed");

	return code;
}

/**
 * Generate code for a Message node.
 * Uses NOTIFICATIONS_SERVICE RPC binding with sendTemplateEmail (email) or sendSms (SMS).
 *
 * Errors are FATAL: if the notification service is not configured, the recipient is
 * missing, or the send call fails, the step throws and Cloudflare will retry it
 * according to the step retry policy before marking the workflow as errored.
 * This ensures failures are always visible in the CF dashboard and in the cases UI.
 */
function generateMessageStep(node: WorkflowNode, indent: string): string {
	const stepName = createStepName(node);
	const config = node.config as MessageNodeConfig | undefined;
	const channel = config?.channel ?? "email";
	const targetRoles = node.roles ?? [];

	let code = `${indent}// Message: ${node.title} (${channel})\n`;
	if (targetRoles.length > 0) {
		code += `${indent}// Responsible roles: ${targetRoles.join(", ")}\n`;
	}
	code += generateProgressCall(node, indent, "in_progress");
	code += `${indent}await step.do("${stepName}", async () => {\n`;

	// Resolve recipients: try fresh RPC, fall back to payload.roleContacts, then clientEmail/Phone
	if (targetRoles.length > 0) {
		const rolesLiteral = `[${targetRoles.map((r) => `"${escapeString(r)}"`).join(", ")}]`;
		if (channel === "email") {
			code += `${indent}\t// Resolve recipient emails: fresh RPC → payload fallback → clientEmail\n`;
			code += `${indent}\tlet roleContacts: Record<string, { email: string }> = {};\n`;
			code += `${indent}\ttry {\n`;
			code += `${indent}\t\tconst fresh = await this.env.CASES_SVC.getCaseRoleContacts({ caseId: event.payload.caseId as string });\n`;
			code += `${indent}\t\troleContacts = fresh.roleContacts as Record<string, { email: string }>;\n`;
			code += `${indent}\t} catch {\n`;
			code += `${indent}\t\troleContacts = (event.payload.roleContacts ?? {}) as Record<string, { email: string }>;\n`;
			code += `${indent}\t}\n`;
			code += `${indent}\tconst targetRoles = ${rolesLiteral};\n`;
			code += `${indent}\tconst recipientEmails: string[] = targetRoles\n`;
			code += `${indent}\t\t.map((r) => roleContacts[r]?.email)\n`;
			code += `${indent}\t\t.filter((e): e is string => typeof e === "string" && e.length > 0);\n`;
			code += `${indent}\tconst fallbackEmail = (event.payload.clientEmail ?? event.payload.recipientEmail) as string | undefined;\n`;
			code += `${indent}\tconst toList = recipientEmails.length > 0 ? recipientEmails : (fallbackEmail ? [fallbackEmail] : []);\n`;
			code += `${indent}\tif (toList.length === 0) {\n`;
			code += `${indent}\t\tthrow new Error("[Message] No recipient email found for roles: ${escapeString(targetRoles.join(", "))}.");\n`;
			code += `${indent}\t}\n`;
		} else {
			code += `${indent}\t// Resolve recipient phones: fresh RPC → payload fallback → clientPhone\n`;
			code += `${indent}\tlet roleContacts: Record<string, { phone?: string | null }> = {};\n`;
			code += `${indent}\ttry {\n`;
			code += `${indent}\t\tconst fresh = await this.env.CASES_SVC.getCaseRoleContacts({ caseId: event.payload.caseId as string });\n`;
			code += `${indent}\t\troleContacts = fresh.roleContacts as Record<string, { phone?: string | null }>;\n`;
			code += `${indent}\t} catch {\n`;
			code += `${indent}\t\troleContacts = (event.payload.roleContacts ?? {}) as Record<string, { phone?: string | null }>;\n`;
			code += `${indent}\t}\n`;
			code += `${indent}\tconst targetRoles = ${rolesLiteral};\n`;
			code += `${indent}\tconst recipientPhones: string[] = targetRoles\n`;
			code += `${indent}\t\t.map((r) => roleContacts[r]?.phone)\n`;
			code += `${indent}\t\t.filter((p): p is string => typeof p === "string" && p.length > 0);\n`;
			code += `${indent}\tconst fallbackPhone = (event.payload.clientPhone ?? event.payload.recipientPhone) as string | undefined;\n`;
			code += `${indent}\tconst toList = recipientPhones.length > 0 ? recipientPhones : (fallbackPhone ? [fallbackPhone] : []);\n`;
			code += `${indent}\tif (toList.length === 0) {\n`;
			code += `${indent}\t\tthrow new Error("[Message] No recipient phone found for roles: ${escapeString(targetRoles.join(", "))}.");\n`;
			code += `${indent}\t}\n`;
		}
	} else {
		// No roles configured — fall back to direct payload fields
		if (channel === "email") {
			code += `${indent}\tconst fallbackEmail = (event.payload.clientEmail ?? event.payload.recipientEmail) as string | undefined;\n`;
			code += `${indent}\tif (!fallbackEmail) {\n`;
			code += `${indent}\t\tthrow new Error("[Message] No recipient email found in workflow payload. Expected clientEmail or recipientEmail.");\n`;
			code += `${indent}\t}\n`;
			code += `${indent}\tconst toList = [fallbackEmail];\n`;
		} else {
			code += `${indent}\tconst fallbackPhone = (event.payload.clientPhone ?? event.payload.recipientPhone) as string | undefined;\n`;
			code += `${indent}\tif (!fallbackPhone) {\n`;
			code += `${indent}\t\tthrow new Error("[Message] No recipient phone found in workflow payload. Expected clientPhone or recipientPhone.");\n`;
			code += `${indent}\t}\n`;
			code += `${indent}\tconst toList = [fallbackPhone];\n`;
		}
	}

	if (channel === "email") {
		const templateName = config?.templateName ?? "";
		const subject = config?.subject ?? "";
		const mergeVars = config?.mergeVars ?? [];

		code += `${indent}\tconst notifications = this.env.NOTIFICATIONS_SERVICE as {\n`;
		code += `${indent}\t\tsendTemplateEmail: (opts: {\n`;
		code += `${indent}\t\t\tto: string | string[];\n`;
		code += `${indent}\t\t\ttemplateName: string;\n`;
		code += `${indent}\t\t\tsubject?: string;\n`;
		code += `${indent}\t\t\tmergeVars: Record<string, string>;\n`;
		code += `${indent}\t\t}) => Promise<{ queued: number }>;\n`;
		code += `${indent}\t};\n`;
		code += `${indent}\tawait notifications.sendTemplateEmail({\n`;
		code += `${indent}\t\tto: toList.length === 1 ? toList[0] : toList,\n`;
		if (templateName) {
			code += `${indent}\t\ttemplateName: "${escapeString(templateName)}",\n`;
		} else {
			code += `${indent}\t\ttemplateName: "", // TODO: set Mandrill template name\n`;
		}
		if (subject) {
			code += `${indent}\t\tsubject: "${escapeString(subject)}",\n`;
		}
		if (mergeVars.length > 0) {
			code += `${indent}\t\tmergeVars: {\n`;
			for (const mv of mergeVars) {
				const key = escapeString(mv.key.toUpperCase());
				const value = mv.value.trim();
				// If value looks like a JS expression (contains ".", "[", "("), emit it raw; otherwise as string literal
				const isExpression = /[.[\](]/.test(value);
				const valueCode = isExpression
					? `${value} as string`
					: `"${escapeString(value)}"`;
				code += `${indent}\t\t\t${key}: ${valueCode},\n`;
			}
			code += `${indent}\t\t},\n`;
		} else {
			code += `${indent}\t\tmergeVars: {}, // TODO: add template merge variables\n`;
		}
		code += `${indent}\t});\n`;
	} else {
		const body = config?.body ?? "";

		code += `${indent}\tconst notifications = this.env.NOTIFICATIONS_SERVICE as {\n`;
		code += `${indent}\t\tsendSms: (opts: {\n`;
		code += `${indent}\t\t\tto: string | string[];\n`;
		code += `${indent}\t\t\tbody: string;\n`;
		code += `${indent}\t\t}) => Promise<{ queued: number }>;\n`;
		code += `${indent}\t};\n`;
		code += `${indent}\tawait notifications.sendSms({\n`;
		code += `${indent}\t\tto: toList.length === 1 ? toList[0] : toList,\n`;
		if (body) {
			code += `${indent}\t\tbody: "${escapeString(body)}",\n`;
		} else {
			code += `${indent}\t\tbody: "", // TODO: set SMS body\n`;
		}
		code += `${indent}\t});\n`;
	}

	code += `${indent}});\n`;
	code += generateCaseObjectCall(node, indent);
	code += generateProgressCall(node, indent, "completed");

	return code;
}

/**
 * Generate code for a Checkpoint node
 */
function generateCheckpointStep(
	node: WorkflowNode,
	indent: string,
	retryVarName?: string,
): string {
	const stepName = createStepName(node);
	const isSafe = node.checkpointType === "safe";
	const stepNameExpr = retryVarName
		? retryStepNameExpr(stepName, retryVarName)
		: `"${stepName}"`;

	let code = `${indent}// Checkpoint: ${node.title}${isSafe ? " (safe)" : ""}\n`;
	code += generateProgressCall(
		node,
		indent,
		"in_progress",
		undefined,
		retryVarName,
	);
	code += `${indent}await step.do(${stepNameExpr}, async () => {\n`;
	if (isSafe) {
		code += `${indent}\t// Safe checkpoint - workflow can be safely retried from here\n`;
	}
	code += `${indent}\treturn { checkpoint: "${stepName}", timestamp: Date.now() };\n`;
	code += `${indent}});\n`;
	code += generateCaseObjectCall(node, indent);
	code += generateProgressCall(
		node,
		indent,
		"completed",
		undefined,
		retryVarName,
	);

	return code;
}

/**
 * Generate code for a Challenge node (waitForEvent)
 */
function generateChallengeStep(
	node: WorkflowNode,
	indent: string,
	retryVarName?: string,
): string {
	const stepName = createStepName(node);
	const varName = createVariableName(node.title, "challengeResult");
	const config = node.config as ChallengeNodeConfig | undefined;
	const challengeType = config?.challengeType || "acceptance";
	const timeout = config?.challengeTimeout;
	const timeoutStr = timeout ? `${timeout.value} ${timeout.unit}` : "24 hours";
	const eventType = challengeType;

	const inlineRetries = config?.retries;
	const hasInlineRetry = inlineRetries && (inlineRetries.maxRetries ?? 0) > 0;

	let code = `${indent}// Challenge: ${node.title} (${challengeType})\n`;

	if (hasInlineRetry) {
		// Pattern 2: Wrap waitForEvent in a local for loop for inline retries.
		// Step names are suffixed with -chN to stay unique per iteration.
		const chVar = createVariableName(node.title || node.id, "challengeRetry");
		const maxR = inlineRetries!.maxRetries;
		code += `${indent}for (let ${chVar} = 0; ${chVar} <= ${maxR}; ${chVar}++) {\n`;
		const innerIndent = indent + "\t";

		// Compose step name: outer retry suffix + inner challenge retry suffix
		let stepNameExpr: string;
		if (retryVarName) {
			// Combined: zone retry + challenge inline retry
			stepNameExpr =
				`(${retryVarName} > 0 || ${chVar} > 0)` +
				` ? \`${stepName}\${${retryVarName} > 0 ? \`-r\${${retryVarName}}\` : ""}\${${chVar} > 0 ? \`-ch\${${chVar}}\` : ""}\`` +
				` : "${stepName}"`;
		} else {
			stepNameExpr = `${chVar} > 0 ? \`${stepName}-ch\${${chVar}}\` : "${stepName}"`;
		}

		code += generateProgressCall(
			node,
			innerIndent,
			"waiting_event",
			eventType,
			retryVarName,
		);
		code += `${innerIndent}${varName} = await step.waitForEvent<{ accepted: boolean }>(\n`;
		code += `${innerIndent}\t${stepNameExpr},\n`;
		code += `${innerIndent}\t{\n`;
		code += `${innerIndent}\t\ttype: "${challengeType}",\n`;
		code += `${innerIndent}\t\ttimeout: "${timeoutStr}",\n`;
		code += `${innerIndent}\t},\n`;
		code += `${innerIndent});\n`;
		code += generateCaseObjectCall(node, innerIndent, varName);
		code += generateProgressCall(
			node,
			innerIndent,
			"completed",
			undefined,
			retryVarName,
		);
		// If the challenge was accepted, exit the inline retry loop
		code += `${innerIndent}if ((${varName} as { payload: { accepted: boolean } }).payload.accepted) break;\n`;
		code += `${indent}}\n`;
	} else {
		// No inline retry — single waitForEvent
		const stepNameExpr = retryVarName
			? retryStepNameExpr(stepName, retryVarName)
			: `"${stepName}"`;

		code += generateProgressCall(
			node,
			indent,
			"waiting_event",
			eventType,
			retryVarName,
		);
		code += `${indent}${varName} = await step.waitForEvent<{ accepted: boolean }>(\n`;
		code += `${indent}\t${stepNameExpr},\n`;
		code += `${indent}\t{\n`;
		code += `${indent}\t\ttype: "${challengeType}",\n`;
		code += `${indent}\t\ttimeout: "${timeoutStr}",\n`;
		code += `${indent}\t},\n`;
		code += `${indent});\n`;
		code += generateCaseObjectCall(node, indent, varName);
		code += generateProgressCall(
			node,
			indent,
			"completed",
			undefined,
			retryVarName,
		);
	}

	return code;
}

/**
 * Generate code for a FlagChange node
 */
function generateFlagChangeStep(node: WorkflowNode, indent: string): string {
	const stepName = createStepName(node);
	const flagChanges =
		(node.config.flagChanges as Array<{ flagId: string; optionId: string }>) ||
		[];

	let code = `${indent}// Flag Change: ${node.title}\n`;
	code += generateProgressCall(node, indent, "in_progress");
	code += `${indent}await step.do("${stepName}", async () => {\n`;
	if (flagChanges.length > 0) {
		const changes = flagChanges
			.map(
				(change) =>
					`{ flagId: "${escapeString(change.flagId)}", optionId: "${escapeString(change.optionId)}" }`,
			)
			.join(", ");
		code += `${indent}\tawait this.env.WORKFLOW_SVC.batchUpdateFlagState({\n`;
		code += `${indent}\t\tworkflowId: this.env.WORKFLOW_ID,\n`;
		code += `${indent}\t\tchanges: [${changes}],\n`;
		code += `${indent}\t\tinstanceId: event.instanceId,\n`;
		code += `${indent}\t});\n`;
	} else {
		code += `${indent}\t// Configure flag changes in the workflow editor\n`;
	}
	code += `${indent}});\n`;
	code += generateCaseObjectCall(node, indent);
	code += generateProgressCall(node, indent, "completed");

	return code;
}

/**
 * Generate code for a Join node
 */
function generateJoinStep(
	node: WorkflowNode,
	indent: string,
	incomingEdges: WorkflowEdge[],
): string {
	const stepName = createStepName(node);
	const branchCount = incomingEdges.length;

	let code = `${indent}// Join: ${node.title} (merging ${branchCount} branches)\n`;
	code += generateProgressCall(node, indent, "in_progress");
	code += `${indent}await step.do("${stepName}", async () => {\n`;
	code += `${indent}\t// Merge point for ${branchCount} branches\n`;
	code += `${indent}\treturn { merged: true };\n`;
	code += `${indent}});\n`;
	code += generateCaseObjectCall(node, indent);
	code += generateProgressCall(node, indent, "completed");

	return code;
}

/**
 * Removes consecutive blank lines at the end of a generated code block so
 * Prettier doesn't flag a blank line immediately before the closing `}`.
 */
function trimTrailingBlankLines(code: string): string {
	return code.replace(/\n\n+$/, "\n");
}

/**
 * Finds the first node reachable from BOTH topStartId and bottomStartId
 * (the post-dominator / convergence point for a branching node).
 *
 * Algorithm:
 *  1. BFS from topStartId to collect all reachable node IDs.
 *  2. BFS from bottomStartId – return the first node found in the top set.
 *
 * Returns null when the branches never converge (e.g. each ends in its own
 * End/Reject with no shared successor).
 */
function findConvergenceNode(
	topStartId: string,
	bottomStartId: string,
	outgoingMap: Map<string, WorkflowEdge[]>,
): string | null {
	// Collect all nodes reachable from the top branch
	const topReachable = new Set<string>();
	const topQueue: string[] = [topStartId];
	while (topQueue.length > 0) {
		const id = topQueue.shift()!;
		if (topReachable.has(id)) continue;
		topReachable.add(id);
		for (const edge of outgoingMap.get(id) ?? []) {
			if (!topReachable.has(edge.to)) topQueue.push(edge.to);
		}
	}

	// BFS from bottom branch – first hit in topReachable is the convergence node
	const bottomVisited = new Set<string>();
	const bottomQueue: string[] = [bottomStartId];
	while (bottomQueue.length > 0) {
		const id = bottomQueue.shift()!;
		if (bottomVisited.has(id)) continue;
		bottomVisited.add(id);
		if (topReachable.has(id)) return id;
		for (const edge of outgoingMap.get(id) ?? []) {
			if (!bottomVisited.has(edge.to)) bottomQueue.push(edge.to);
		}
	}

	return null;
}

/**
 * Internal traversal context to share state between recursive calls
 */
interface TraversalContext {
	nodeMap: Map<string, WorkflowNode>;
	outgoingMap: Map<string, WorkflowEdge[]>;
	incomingMap: Map<string, WorkflowEdge[]>;
	visited: Set<string>;
	warnings: string[];
	/** All detected retry zones in this workflow */
	retryZones: RetryZone[];
	/** The retry zone currently active during code generation (null = no zone) */
	activeRetryZone: RetryZone | null;
}

/**
 * Generate code for a single node based on its type
 */
function generateNodeCode(
	node: WorkflowNode,
	indent: string,
	ctx: TraversalContext,
): string {
	const retryVar = ctx.activeRetryZone?.retryVarName;

	switch (node.type) {
		case "Start":
			return (
				`${indent}// Workflow started\n` +
				`${indent}await this.env.CASES_SVC.updateCaseObject(\n` +
				`${indent}\tevent.payload.caseId as string,\n` +
				`${indent}\t{"_init": {instanceId: event.instanceId, startedAt: new Date().toISOString()}},\n` +
				`${indent});\n`
			);
		case "Form":
			return generateFormStep(node, indent, retryVar);
		case "API":
			return generateAPIStep(node, indent, retryVar);
		case "Transform":
			return generateTransformStep(node, indent);
		case "Message":
			return generateMessageStep(node, indent);
		case "Checkpoint":
			return generateCheckpointStep(node, indent, retryVar);
		case "Challenge":
			return generateChallengeStep(node, indent, retryVar);
		case "Decision":
			// Decision generates an if/else, code is handled in traversal
			return "";
		case "FlagChange":
			return generateFlagChangeStep(node, indent);
		case "Join":
			return generateJoinStep(node, indent, ctx.incomingMap.get(node.id) || []);
		case "End":
			return (
				`${indent}// Workflow completed successfully\n` +
				generateCaseObjectCall(node, indent) +
				generateProgressCall(node, indent, "completed") +
				`${indent}return { success: true, payload: event.payload };\n`
			);
		case "Reject": {
			const zone = ctx.retryZones.find((z) => z.rejectNodeId === node.id);
			if (zone) {
				// Pattern 1: Reject with retry — generate continue/return logic
				const rv = zone.retryVarName;
				if (zone.unlimited) {
					// Unlimited retries: always continue (the for loop has no upper bound)
					return (
						`${indent}// Workflow rejected — retrying (unlimited)\n` +
						generateCaseObjectCall(node, indent) +
						generateProgressCall(node, indent, "completed", undefined, rv) +
						`${indent}continue; // Unlimited retry from checkpoint\n`
					);
				}
				return (
					`${indent}// Workflow rejected (retry zone)\n` +
					generateCaseObjectCall(node, indent) +
					generateProgressCall(node, indent, "completed", undefined, rv) +
					`${indent}if (${rv} < ${zone.maxRetries}) {\n` +
					`${indent}\tcontinue; // Retry from checkpoint\n` +
					`${indent}}\n` +
					`${indent}return { success: false, reason: "${escapeString(node.title)}" };\n`
				);
			}
			return (
				`${indent}// Workflow rejected\n` +
				generateCaseObjectCall(node, indent) +
				generateProgressCall(node, indent, "completed") +
				`${indent}return { success: false, reason: "${escapeString(node.title)}" };\n`
			);
		}
		default:
			ctx.warnings.push(`Unknown node type: ${node.type}`);
			return `${indent}// Unknown node type: ${node.type}\n`;
	}
}

/**
 * Recursively traverse a branch and generate code.
 *
 * @param nodeId       - Starting node ID for this traversal.
 * @param indent       - Current indentation string.
 * @param ctx          - Shared traversal context (visited set, maps, warnings).
 * @param stopAtNodeId - Optional convergence boundary: when this node ID is
 *                       reached the traversal stops WITHOUT processing it.
 *                       The caller is responsible for continuing from that node.
 */
function traverseBranch(
	nodeId: string,
	indent: string,
	ctx: TraversalContext,
	stopAtNodeId?: string,
): string {
	let code = "";
	let currentNodeId: string | null = nodeId;

	while (currentNodeId) {
		// Stop at the convergence boundary – the outer traversal will process it
		if (stopAtNodeId && currentNodeId === stopAtNodeId) {
			break;
		}

		if (ctx.visited.has(currentNodeId)) {
			break;
		}

		const node = ctx.nodeMap.get(currentNodeId);
		if (!node) {
			ctx.warnings.push(`Node not found: ${currentNodeId}`);
			break;
		}

		// -------------------------------------------------------------------
		// Pattern 1: Checkpoint that is the start of a retry zone.
		// Wrap the whole zone (Checkpoint … Reject) in a for loop.
		// All descendant nodes will see ctx.activeRetryZone during traversal.
		// -------------------------------------------------------------------
		const retryZone = ctx.retryZones.find(
			(z) => z.checkpointNodeId === currentNodeId,
		);

		if (retryZone && !ctx.activeRetryZone) {
			// Open the for loop
			const rv = retryZone.retryVarName;
			if (retryZone.unlimited) {
				// maxRetries=0 in editor means "unlimited" — loop forever until
				// the accepted path returns { success: true }.
				code += `${indent}for (let ${rv} = 0; ; ${rv}++) {\n`;
			} else {
				code += `${indent}for (let ${rv} = 0; ${rv} <= ${retryZone.maxRetries}; ${rv}++) {\n`;
			}

			// Traverse inside the zone with increased indentation and active zone set
			const prevZone = ctx.activeRetryZone;
			ctx.activeRetryZone = retryZone;

			// We must NOT mark this node as visited yet so the inner traversal
			// processes it with the retryVar active.
			code += trimTrailingBlankLines(
				traverseBranch(currentNodeId, indent + "\t", ctx, stopAtNodeId),
			);

			ctx.activeRetryZone = prevZone;
			code += `${indent}}\n\n`;

			// The inner traversal has already processed the rest of the path
			// (including the Reject node which emits `continue` / `return`).
			// After the loop closes there is nothing more to process on this path.
			break;
		}

		// Mark as visited *after* retry-zone check so the inner traversal can
		// see the node and process it with the correct activeRetryZone.
		ctx.visited.add(currentNodeId);

		// Get outgoing edges
		const outgoing: WorkflowEdge[] = ctx.outgoingMap.get(currentNodeId) ?? [];

		// Filter out the retry back-edge for traversal purposes (Reject -> Checkpoint).
		// We keep only the "forward" edges; the retry loop handles re-entry.
		const forwardOutgoing =
			node.type === "Reject"
				? outgoing.filter((e) => {
						const target = ctx.nodeMap.get(e.to);
						return !target || target.type !== "Checkpoint";
					})
				: outgoing;

		// Handle Decision nodes (branching)
		if (node.type === "Decision") {
			const condition = (node.config.condition as string) || "/* condition */";
			const topEdge = forwardOutgoing.find(
				(e: WorkflowEdge) => e.fromPort === "top",
			);
			const bottomEdge = forwardOutgoing.find(
				(e: WorkflowEdge) => e.fromPort === "bottom",
			);

			// Detect convergence point so both branches stop before it and we
			// continue from it after the if/else block.
			const convergenceNodeId =
				topEdge && bottomEdge
					? findConvergenceNode(topEdge.to, bottomEdge.to, ctx.outgoingMap)
					: null;

			// Effective stop boundary for sub-branches: prefer the inner
			// convergence, but never go past the outer stopAtNodeId.
			const innerStop = convergenceNodeId ?? stopAtNodeId;

			code += `${indent}// Decision: ${node.title}\n`;
			code += `${indent}if (${expandVariableRefs(condition)}) {\n`;

			if (topEdge && !ctx.visited.has(topEdge.to)) {
				code += trimTrailingBlankLines(
					traverseBranch(topEdge.to, indent + "\t", ctx, innerStop),
				);
			}

			code += `${indent}} else {\n`;

			if (bottomEdge && !ctx.visited.has(bottomEdge.to)) {
				code += trimTrailingBlankLines(
					traverseBranch(bottomEdge.to, indent + "\t", ctx, innerStop),
				);
			}

			code += `${indent}}\n\n`;

			if (convergenceNodeId) {
				// Continue linear traversal from the convergence node
				currentNodeId = convergenceNodeId;
			} else {
				break;
			}
		}
		// Handle Challenge nodes (branching based on acceptance)
		else if (node.type === "Challenge" && forwardOutgoing.length === 2) {
			const varName = createVariableName(node.title, "challengeResult");
			const topEdge = forwardOutgoing.find(
				(e: WorkflowEdge) => e.fromPort === "top",
			);
			const bottomEdge = forwardOutgoing.find(
				(e: WorkflowEdge) => e.fromPort === "bottom",
			);

			// Detect convergence point
			const convergenceNodeId =
				topEdge && bottomEdge
					? findConvergenceNode(topEdge.to, bottomEdge.to, ctx.outgoingMap)
					: null;

			const innerStop = convergenceNodeId ?? stopAtNodeId;

			// Generate the waitForEvent step first
			code += generateNodeCode(node, indent, ctx);
			code += "\n";

			code += `${indent}if ((${varName} as { payload: { accepted: boolean } }).payload.accepted) {\n`;

			if (topEdge && !ctx.visited.has(topEdge.to)) {
				code += trimTrailingBlankLines(
					traverseBranch(topEdge.to, indent + "\t", ctx, innerStop),
				);
			}

			code += `${indent}} else {\n`;

			if (bottomEdge && !ctx.visited.has(bottomEdge.to)) {
				code += trimTrailingBlankLines(
					traverseBranch(bottomEdge.to, indent + "\t", ctx, innerStop),
				);
			}

			code += `${indent}}\n\n`;

			if (convergenceNodeId) {
				currentNodeId = convergenceNodeId;
			} else {
				break;
			}
		}
		// Linear flow
		else {
			code += generateNodeCode(node, indent, ctx);
			code += "\n";

			if (forwardOutgoing.length > 1) {
				ctx.warnings.push(
					`Node "${node.title}" has multiple outgoing edges but is not a Decision or Challenge node`,
				);
			}

			currentNodeId =
				forwardOutgoing.length >= 1 ? forwardOutgoing[0].to : null;
		}
	}

	return code;
}

/**
 * Traverse workflow and generate code for each node
 */
function traverseAndGenerate(
	startNode: WorkflowNode,
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
	indent: string,
): { code: string; warnings: string[] } {
	const { outgoingMap, incomingMap } = buildAdjacencyMaps(edges);
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));
	const retryZones = detectRetryZones(nodes, edges);

	const ctx: TraversalContext = {
		nodeMap,
		outgoingMap,
		incomingMap,
		visited: new Set<string>(),
		warnings: [],
		retryZones,
		activeRetryZone: null,
	};

	// Start traversal from the start node
	const code = traverseBranch(startNode.id, indent, ctx);

	// Check for unvisited nodes (only at top level)
	const unvisitedNodes = nodes.filter(
		(n) => !ctx.visited.has(n.id) && n.type !== "Start",
	);
	if (unvisitedNodes.length > 0) {
		ctx.warnings.push(
			`${unvisitedNodes.length} node(s) not reachable from Start: ${unvisitedNodes.map((n) => n.title).join(", ")}`,
		);
	}

	return { code, warnings: ctx.warnings };
}

/**
 * Generate TypeScript Cloudflare Workflow code from visual workflow
 */
export function generateWorkflowCode(
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
	metadata?: WorkflowMetadata,
	options: CodeGeneratorOptions = {},
): GeneratedCode {
	const {
		className = "GeneratedWorkflow",
		includeComments = true,
		includeImports = true,
	} = options;

	const warnings: string[] = [];
	let code = "";

	// Find start node
	const startNode = nodes.find((n) => n.type === "Start");
	if (!startNode) {
		return {
			code: "// Error: No Start node found in workflow",
			warnings: ["No Start node found in workflow"],
		};
	}

	// Generate imports
	if (includeImports) {
		code += `import {\n\tWorkflowEntrypoint,\n\tWorkflowEvent,\n\tWorkflowStep,\n} from "cloudflare:workers";\n\n`;
	}

	// Generate environment interface
	// Use WorkflowEnv (not Env) to avoid clashing with the global Env type
	// generated by `wrangler types` (worker-configuration.d.ts).
	const hasMessageNodes = nodes.some((n) => n.type === "Message");
	code += `interface WorkflowEnv {\n`;
	code += `\tWORKFLOW_SVC: {\n`;
	code += `\t\tbatchUpdateFlagState: (input: {\n`;
	code += `\t\t\tworkflowId: string;\n`;
	code += `\t\t\tchanges: Array<{ flagId: string; optionId: string }>;\n`;
	code += `\t\t\tinstanceId?: string;\n`;
	code += `\t\t}) => Promise<{ changes: Array<{ flagId: string; optionId: string; updated: boolean }> }>;\n`;
	code += `\t\tupdateInstanceProgress: (input: {\n`;
	code += `\t\t\tworkflowId: string;\n`;
	code += `\t\t\tinstanceId: string;\n`;
	code += `\t\t\tnodeId: string;\n`;
	code += `\t\t\tnodeType: string;\n`;
	code += `\t\t\tstepName: string;\n`;
	code += `\t\t\tstatus: "in_progress" | "completed" | "waiting_event";\n`;
	code += `\t\t\teventType?: string;\n`;
	code += `\t\t\tretryCount?: number;\n`;
	code += `\t\t}) => Promise<{ ok: boolean }>;\n`;
	code += `\t};\n`;
	code += `\tWORKFLOW_ID: string;\n`;
	if (hasMessageNodes) {
		code += `\tNOTIFICATIONS_SERVICE: {\n`;
		code += `\t\tsendTemplateEmail: (opts: unknown) => Promise<{ queued: number }>;\n`;
		code += `\t\tsendSms: (opts: unknown) => Promise<{ queued: number }>;\n`;
		code += `\t};\n`;
	}
	// CASES_SVC is always included: updateCaseObject is emitted for every node,
	// and getCaseRoleContacts is needed for Message nodes.
	code += `\tCASES_SVC: {\n`;
	code += `\t\tgetCaseRoleContacts: (input: { caseId: string }) => Promise<{\n`;
	code += `\t\t\troleContacts: Record<string, { email: string; name: string | null; phone?: string | null }>;\n`;
	code += `\t\t}>;\n`;
	code += `\t\tupdateCaseObject: (caseId: string, data: Record<string, unknown>) => Promise<void>;\n`;
	code += `\t};\n`;
	code += `}\n\n`;

	// Generate workflow params interface
	code += `interface WorkflowParams {\n`;
	code += `\t[key: string]: unknown;\n`;
	code += `}\n\n`;

	// Add metadata as comments
	if (includeComments && metadata) {
		code += `/**\n`;
		code += ` * ${metadata.name || "Generated Workflow"}\n`;
		if (metadata.description) {
			code += ` *\n`;
			code += ` * ${metadata.description}\n`;
		}
		code += ` *\n`;
		code += ` * Version: ${metadata.version || "1.0.0"}\n`;
		if (metadata.author) {
			code += ` * Author: ${metadata.author}\n`;
		}
		code += ` * Generated: ${new Date().toISOString()}\n`;
		code += ` */\n`;
	}

	// Generate class - use multi-line generic only when line would exceed 80 chars
	// Single-line: "export class X extends WorkflowEntrypoint<WorkflowEnv, WorkflowParams> {"
	// That's 71 chars + className.length. If > 80, use multi-line.
	const singleLineClassDecl = `export class ${className} extends WorkflowEntrypoint<WorkflowEnv, WorkflowParams> {\n`;
	if (singleLineClassDecl.length - 1 <= 80) {
		code += singleLineClassDecl;
	} else {
		code += `export class ${className} extends WorkflowEntrypoint<\n`;
		code += `\tWorkflowEnv,\n`;
		code += `\tWorkflowParams\n`;
		code += `> {\n`;
	}
	code += `\tasync run(\n\t\tevent: WorkflowEvent<WorkflowParams>,\n\t\tstep: WorkflowStep,\n\t): Promise<unknown> {\n`;

	// Declare let variables only for Challenge nodes whose result is used in the
	// generated if/else branch (varName.payload.accepted).
	// Other output nodes (API, Form, Transform, Checkpoint) use inline const
	// assignment inside their step.do() callback, so no hoisted let is needed.
	const challengeNodes = nodes.filter((n) => n.type === "Challenge");
	if (challengeNodes.length > 0) {
		for (const node of challengeNodes) {
			const varName = createVariableName(node.title, "challengeResult");
			code += `\t\tlet ${varName}: unknown = null;\n`;
		}
		code += `\n`;
	}

	// Traverse and generate step code (2 tabs = class body + method body)
	const { code: stepsCode, warnings: traverseWarnings } = traverseAndGenerate(
		startNode,
		nodes,
		edges,
		"\t\t",
	);
	// Trim trailing blank lines so Prettier doesn't flag a blank line before `}`
	code += trimTrailingBlankLines(stepsCode);
	warnings.push(...traverseWarnings);

	// Close class
	code += `\t}\n`;
	code += `}\n`;

	return { code, warnings };
}

/**
 * Validate if workflow can be converted to code
 */
export function validateForCodeGeneration(
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Check for start node
	const startNodes = nodes.filter((n) => n.type === "Start");
	if (startNodes.length === 0) {
		errors.push("Workflow must have a Start node");
	} else if (startNodes.length > 1) {
		errors.push("Workflow can only have one Start node");
	}

	// Check for end nodes
	const endNodes = nodes.filter((n) => n.type === "End" || n.type === "Reject");
	if (endNodes.length === 0) {
		errors.push("Workflow must have at least one End or Reject node");
	}

	// Check for disconnected nodes
	const { outgoingMap, incomingMap } = buildAdjacencyMaps(edges);
	const nodesWithoutOutgoing = nodes.filter(
		(n) => n.type !== "End" && n.type !== "Reject" && !outgoingMap.has(n.id),
	);
	if (nodesWithoutOutgoing.length > 0) {
		errors.push(
			`Nodes without outgoing connections: ${nodesWithoutOutgoing.map((n) => n.title).join(", ")}`,
		);
	}

	const nodesWithoutIncoming = nodes.filter(
		(n) => n.type !== "Start" && !incomingMap.has(n.id),
	);
	if (nodesWithoutIncoming.length > 0) {
		errors.push(
			`Nodes without incoming connections: ${nodesWithoutIncoming.map((n) => n.title).join(", ")}`,
		);
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Validate TypeScript syntax of Transform and Decision nodes.
 * This is intentionally separate from validateForCodeGeneration (which is
 * synchronous) because Prettier's parser loads dynamically.
 */
export async function validateNodeCodeSyntax(
	nodes: WorkflowNode[],
): Promise<{ valid: boolean; errors: string[] }> {
	const errors: string[] = [];

	const checks = nodes
		.filter(
			(n) =>
				(n.type === "Transform" && (n.config.code as string)?.trim()) ||
				(n.type === "Decision" && (n.config.condition as string)?.trim()),
		)
		.map(async (node) => {
			if (node.type === "Transform") {
				const result = await validateTransformCode(node.config.code as string);
				if (!result.valid) {
					errors.push(
						`"${node.title}": código TypeScript inválido — ${result.error}`,
					);
				}
			} else if (node.type === "Decision") {
				const result = await validateConditionExpression(
					node.config.condition as string,
				);
				if (!result.valid) {
					errors.push(`"${node.title}": condición inválida — ${result.error}`);
				}
			}
		});

	await Promise.all(checks);
	return { valid: errors.length === 0, errors };
}

/**
 * Phase status and logs for progress tracking
 */
export interface TranspilationPhase {
	id: string;
	label: string;
	status: "pending" | "running" | "done" | "error";
	logs: string[];
	durationMs?: number;
}

/**
 * Result of code generation with progress tracking
 */
export interface TranspilationResult {
	code: string;
	warnings: string[];
	phases: TranspilationPhase[];
	totalDurationMs: number;
	valid: boolean;
	errors: string[];
}

/**
 * Generate workflow code with progress tracking and detailed logs
 */
export async function generateWorkflowCodeWithProgress(
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
	metadata?: WorkflowMetadata,
	options: CodeGeneratorOptions = {},
	onPhaseUpdate?: (phases: TranspilationPhase[]) => void,
): Promise<TranspilationResult> {
	const startTime = Date.now();
	const phases: TranspilationPhase[] = [
		{
			id: "validate",
			label: "Validando workflow",
			status: "pending",
			logs: [],
		},
		{
			id: "slugs",
			label: "Generando slugs únicos",
			status: "pending",
			logs: [],
		},
		{
			id: "analyze",
			label: "Analizando estructura del grafo",
			status: "pending",
			logs: [],
		},
		{
			id: "transpile",
			label: "Transpilando a TypeScript",
			status: "pending",
			logs: [],
		},
		{
			id: "complete",
			label: "Completado",
			status: "pending",
			logs: [],
		},
	];

	const updatePhase = (
		phaseId: string,
		status: TranspilationPhase["status"],
		logs: string[] = [],
		durationMs?: number,
	) => {
		const phase = phases.find((p) => p.id === phaseId);
		if (phase) {
			phase.status = status;
			phase.logs.push(...logs);
			if (durationMs !== undefined) {
				phase.durationMs = durationMs;
			}
		}
		if (onPhaseUpdate) {
			onPhaseUpdate([...phases]);
		}
	};

	// Phase 1: Validate
	updatePhase("validate", "running");
	const phaseStart = Date.now();
	const validation = validateForCodeGeneration(nodes, edges);

	if (!validation.valid) {
		const validationDuration = Date.now() - phaseStart;
		updatePhase("validate", "error", [
			`❌ Validación fallida con ${validation.errors.length} error(es):`,
			...validation.errors.map((e) => `  • ${e}`),
		]);
		return {
			code: "",
			warnings: [],
			phases,
			totalDurationMs: Date.now() - startTime,
			valid: false,
			errors: validation.errors,
		};
	}

	// Also validate TypeScript syntax of Transform and Decision nodes
	const syntaxValidation = await validateNodeCodeSyntax(nodes);
	const validationDuration = Date.now() - phaseStart;

	if (!syntaxValidation.valid) {
		updatePhase("validate", "error", [
			`❌ Validación de sintaxis fallida con ${syntaxValidation.errors.length} error(es):`,
			...syntaxValidation.errors.map((e) => `  • ${e}`),
		]);
		return {
			code: "",
			warnings: [],
			phases,
			totalDurationMs: Date.now() - startTime,
			valid: false,
			errors: syntaxValidation.errors,
		};
	}

	updatePhase(
		"validate",
		"done",
		[
			`✅ Validación exitosa`,
			`  • ${nodes.length} nodos encontrados`,
			`  • ${edges.length} conexiones encontradas`,
			`  • Tiempo: ${validationDuration}ms`,
		],
		validationDuration,
	);

	// Small delay to allow UI update
	await new Promise((resolve) => setTimeout(resolve, 100));

	// Phase 2: Generate slugs
	updatePhase("slugs", "running");
	const slugsStart = Date.now();
	const nodesByType = new Map<string, number>();
	const slugMap = new Map<string, string>();

	for (const node of nodes) {
		const slug = createStepName(node);
		slugMap.set(node.id, slug);
		const count = nodesByType.get(node.type) || 0;
		nodesByType.set(node.type, count + 1);
	}

	const slugsDuration = Date.now() - slugsStart;
	const typesSummary = Array.from(nodesByType.entries())
		.map(([type, count]) => `  • ${type}: ${count}`)
		.join("\n");

	updatePhase(
		"slugs",
		"done",
		[
			`✅ Slugs generados para ${nodes.length} nodos`,
			`Distribución por tipo:`,
			typesSummary,
			`  • Tiempo: ${slugsDuration}ms`,
		],
		slugsDuration,
	);

	await new Promise((resolve) => setTimeout(resolve, 100));

	// Phase 3: Analyze graph structure
	updatePhase("analyze", "running");
	const analyzeStart = Date.now();
	const { outgoingMap, incomingMap } = buildAdjacencyMaps(edges);

	const startNodes = nodes.filter((n) => n.type === "Start");
	const endNodes = nodes.filter((n) => n.type === "End" || n.type === "Reject");
	const checkpointNodes = nodes.filter((n) => n.type === "Checkpoint");
	const decisionNodes = nodes.filter((n) => n.type === "Decision");
	const joinNodes = nodes.filter((n) => n.type === "Join");

	const analyzeDuration = Date.now() - analyzeStart;

	updatePhase(
		"analyze",
		"done",
		[
			`✅ Análisis de estructura completado`,
			`  • Nodos Start: ${startNodes.length}`,
			`  • Nodos End/Reject: ${endNodes.length}`,
			`  • Checkpoints: ${checkpointNodes.length}`,
			`  • Decisiones: ${decisionNodes.length}`,
			`  • Joins: ${joinNodes.length}`,
			`  • Tiempo: ${analyzeDuration}ms`,
		],
		analyzeDuration,
	);

	await new Promise((resolve) => setTimeout(resolve, 100));

	// Phase 4: Transpile
	updatePhase("transpile", "running");
	const transpileStart = Date.now();

	const generated = generateWorkflowCode(nodes, edges, metadata, options);

	const transpileDuration = Date.now() - transpileStart;
	const linesOfCode = generated.code.split("\n").length;

	const transpileLogs = [
		`✅ Código generado exitosamente`,
		`  • ${linesOfCode} líneas de código`,
		`  • ${generated.warnings.length} advertencias`,
	];

	if (generated.warnings.length > 0) {
		transpileLogs.push(`Advertencias:`);
		transpileLogs.push(...generated.warnings.map((w) => `  ⚠️  ${w}`));
	}

	transpileLogs.push(`  • Tiempo: ${transpileDuration}ms`);

	updatePhase("transpile", "done", transpileLogs, transpileDuration);

	await new Promise((resolve) => setTimeout(resolve, 100));

	// Phase 5: Complete
	const totalDuration = Date.now() - startTime;
	updatePhase(
		"complete",
		"done",
		[
			`✅ Transpilación completada exitosamente`,
			`  • Tiempo total: ${totalDuration}ms`,
			`  • Archivo listo para descargar`,
		],
		totalDuration,
	);

	return {
		code: generated.code,
		warnings: generated.warnings,
		phases,
		totalDurationMs: totalDuration,
		valid: true,
		errors: [],
	};
}
