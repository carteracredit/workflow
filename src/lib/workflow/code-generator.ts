import type {
	WorkflowNode,
	WorkflowEdge,
	WorkflowMetadata,
	ChallengeNodeConfig,
	SignatureChallengeConfig,
	PromotionNodeConfig,
	APIFailureHandling,
	APIAuthConfig,
	APIHeaderEntry,
	APIBodyConfig,
	APIResponseConfig,
	MessageNodeConfig,
	OutputSchema,
	NLSNodeConfig,
	NLSFunctionId,
} from "./types";
import { DEFAULT_PROMOTION_COMMISSION } from "./types";
import { slugify } from "../slugify";
import {
	validateTransformCode,
	validateConditionExpression,
} from "./validate-code";
import { buildAliasMap, isLegacyNodeId } from "./node-alias";
import { isValidJson, isWellFormedXml } from "./xml-validation";

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
 * Whether a template string contains `${...}` variable interpolation markers
 * produced by `VariableTemplateInput`.
 */
function hasTemplateVars(str: string): boolean {
	return /\$\{[^}]+\}/.test(str);
}

/**
 * Convert a template string like `"Hello ${event.payload.x}"` into a JS
 * template literal like `` `Hello ${event.payload.x}` ``.
 * Backticks and backslashes inside literal text sections are escaped.
 */
function toJsTemplateLiteral(str: string): string {
	// Escape backtick and backslash in the raw string, but preserve ${...} intact
	const escaped = str.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
	return `\`${escaped}\``;
}

/**
 * Module-level alias map populated at the start of `generateWorkflowCode` so
 * that all internal step-generator helpers can resolve camelCase aliases from
 * node IDs without threading the map through every function signature.
 *
 * JavaScript is single-threaded; this is safe for synchronous generation.
 */
let _activeAliasMap: Map<string, string> = new Map();

/**
 * The camelCase alias of the Start node for the current code-generation run.
 *
 * When `expandVariablePath` sees this alias as the first segment of a variable
 * reference (e.g. `${inicio.clientName}` or `${start.clientAddress.zipCode}`),
 * it rewrites the expression to `event.payload.<trail>` because the Start
 * node's case variables are injected by cases-svc directly into the workflow
 * event payload — no runtime binding is declared for the Start node itself.
 *
 * Reset to `""` after each generation run.
 */
let _startNodeAlias: string = "";

/**
 * Set of node IDs (Form / API / Transform) that are inside a Decision or
 * Challenge branch AND whose alias is referenced by a node outside that branch
 * (i.e., post-merge). These need a hoisted `let` declaration at the start of
 * `run()` so the reference is visible after the if/else block closes.
 *
 * Populated by `computeHoistedNodeIds` at the start of `generateWorkflowCode`.
 * Challenge and Promotion nodes are NOT included here — they have their own
 * dedicated hoisting block.
 */
let _hoistedNodeIds: Set<string> = new Set();

/**
 * Returns the camelCase alias for a node ID, falling back to the legacy
 * hyphen→underscore transform when no alias is available.
 *
 * This replaces the old `nodeIdToVarName` helper and ensures that generated
 * variable names match the aliases used in the variable picker tokens.
 */
function getVarName(nodeId: string): string {
	return _activeAliasMap.get(nodeId) ?? nodeId.replace(/-/g, "_");
}

/**
 * Expands a property access trail (everything after the first `.` in a
 * variable path) into safe JS property access expressions.
 *
 * Each dot-separated segment:
 *  - If it is a valid identifier (`/^[a-zA-Z_$][a-zA-Z0-9_$]*$/`): use dot
 *    notation → `.name` (or just `name` for the first segment).
 *  - Otherwise (e.g. contains hyphens): use bracket notation → `["name"]`.
 *  Array accessors like `[0]` are preserved intact and appended to the
 *  preceding segment.
 *
 * Examples:
 *   "phone"                  → "phone"
 *   "results[0].url"         → "results[0].url"
 *   "my-field"               → `["my-field"]`
 *   "data.my-key.value"      → `data["my-key"].value`
 */
function expandPropertyTrail(trail: string): string {
	const parts: string[] = [];
	let buf = "";
	let depth = 0;
	for (const ch of trail) {
		if (ch === "[") {
			depth++;
			buf += ch;
		} else if (ch === "]") {
			depth--;
			buf += ch;
		} else if (ch === "." && depth === 0) {
			parts.push(buf);
			buf = "";
		} else {
			buf += ch;
		}
	}
	if (buf || trail.length === 0) parts.push(buf);

	return parts
		.map((part, i) => {
			const bracketIdx = part.indexOf("[");
			const name = bracketIdx >= 0 ? part.slice(0, bracketIdx) : part;
			const suffix = bracketIdx >= 0 ? part.slice(bracketIdx) : "";

			if (!name) return suffix;

			if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
				return (i === 0 ? name : `.${name}`) + suffix;
			}
			const escaped = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
			return `["${escaped}"]${suffix}`;
		})
		.join("");
}

/**
 * Expands a single variable-picker path into a runtime JavaScript expression.
 *
 *  - `secret.NAME`          → `this.env.NAME` (workflow-level variable/secret;
 *                             preserves UPPER_SNAKE case).
 *  - `<alias.prop…>`        → The first segment is kept as-is when it is
 *                             already a valid camelCase alias (new format), or
 *                             dehyphenated when it is a legacy `node-<id>`.
 *                             The property trail uses dot notation for valid
 *                             identifiers or bracket notation (`["key"]`) for
 *                             segments that contain hyphens or other special
 *                             characters.
 *
 * Centralizing this mapping keeps the `${secret.X}` → `this.env.X` contract in
 * one place, regardless of whether the reference lives inside an auth field,
 * a URL, a header value, a request body, a Decision condition, or a Transform
 * code block.
 */
function expandVariablePath(path: string): string {
	const trimmed = path.trim();
	if (/^secret\./.test(trimmed)) {
		return `this.env.${trimmed.slice("secret.".length)}`;
	}

	const dotIdx = trimmed.indexOf(".");
	const firstSeg = dotIdx >= 0 ? trimmed.slice(0, dotIdx) : trimmed;
	const propertyTrail = dotIdx >= 0 ? trimmed.slice(dotIdx + 1) : null;

	// Start-node alias → rewrite to event.payload.<trail> because the Start
	// node's case variables live in the workflow event payload at runtime; no
	// JS binding is ever declared for the Start node in the generated code.
	if (_startNodeAlias && firstSeg === _startNodeAlias) {
		if (propertyTrail === null) {
			return "event.payload";
		}
		return `event.payload.${expandPropertyTrail(propertyTrail)}`;
	}

	// For legacy node-IDs (`node-<timestamp>`), look up the camelCase alias
	// from the active alias map (populated during code generation), or fall
	// back to simple hyphen→underscore replacement.
	let safeFirst: string;
	if (isLegacyNodeId(firstSeg) && _activeAliasMap.size > 0) {
		safeFirst = _activeAliasMap.get(firstSeg) ?? firstSeg.replace(/-/g, "_");
	} else {
		// Already a camelCase alias or any other form – dehyphenate as safety net.
		safeFirst = firstSeg.replace(/-/g, "_");
	}

	if (propertyTrail === null) {
		return safeFirst;
	}

	return `${safeFirst}.${expandPropertyTrail(propertyTrail)}`;
}

/**
 * Expands variable-picker references of the form `${nodeId.property}` or
 * `${secret.NAME}` into valid JavaScript expressions (bare, NOT wrapped in a
 * template literal).
 *
 * The picker stores references using template-literal syntax which is NOT valid
 * in a plain JS expression (e.g. inside an `if` condition or a code block).
 * This helper converts them so that, for example,
 * `${node-123.count} > 0` becomes `node_123.count > 0` and
 * `${secret.NLS_TOKEN}` becomes `this.env.NLS_TOKEN`.
 *
 * Use this for Decision conditions and Transform code bodies (bare expressions).
 * For quoted string values use `emitInterpolatedString` instead.
 */
function expandVariableRefs(expr: string): string {
	return expr.replace(/\$\{([^}]+)\}/g, (_, path: string) =>
		expandVariablePath(path),
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
 * - If the string contains `${alias.property}` references it is wrapped in
 *   backticks so the references become valid template-literal interpolations.
 *   Each `${...}` token is expanded via `expandVariablePath` which handles
 *   both new-format camelCase aliases and legacy node-ID paths.
 *
 * Examples:
 *   "https://api.example.com/items"             → `"https://api.example.com/items"`
 *   "${coapplicantForm.results[0].url}"          → `` `${coapplicantForm.results[0].url}` ``
 *   "https://api.example.com/${myNode.id}"       → `` `https://api.example.com/${myNode.id}` ``
 */
function emitInterpolatedString(str: string): string {
	if (!containsVariableRefs(str)) {
		return `"${escapeString(str)}"`;
	}
	// Rewrite each ${...} token to a valid JS expression (node-id dehyphen or
	// `this.env.X` for `secret.X`), then wrap the whole thing in backticks.
	const expanded = str.replace(/\$\{([^}]+)\}/g, (_, path: string) => {
		return `\${${expandVariablePath(path)}}`;
	});
	// Escape any backticks inside the literal part (outside ${...}).
	const escaped = expanded.replace(/`/g, "\\`");
	return `\`${escaped}\``;
}

/**
 * Emits a value for use in generated TypeScript source code.
 *
 * Supported inputs, in priority order:
 *   - "env:VAR_NAME"          → this.env.VAR_NAME  (explicit env reference,
 *                                                   original convention).
 *   - "${secret.NAME}"        → this.env.NAME      (new variable-picker token,
 *                                                   single pure secret reference).
 *   - "TOKEN_TEST" (all-caps) → this.env.TOKEN_TEST (legacy auto-detected env
 *                                                    var; kept for
 *                                                    backwards compatibility
 *                                                    with workflows saved
 *                                                    before "env:" was added).
 *   - any text containing other `${...}` tokens
 *                             → backtick template string with each token
 *                               expanded via `expandVariablePath`.
 *   - any other text          → "literal string"   (used as-is).
 *
 * The three env/secret shortcuts each produce a bare `this.env.X` expression so
 * the caller can embed the result either as a standalone value or inside a
 * template literal like `` `Bearer ${…}` ``.
 */
const ENV_VAR_NAME_RE = /^[A-Z][A-Z0-9_]*$/;
const PURE_SECRET_RE = /^\s*\$\{\s*secret\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\s*$/;

function emitAuthValue(raw: string): string {
	if (raw.startsWith("env:")) {
		return emitEnvRef(raw.slice(4).trim());
	}
	const pureSecret = raw.match(PURE_SECRET_RE);
	if (pureSecret) {
		return emitEnvRef(pureSecret[1]);
	}
	if (ENV_VAR_NAME_RE.test(raw)) {
		return emitEnvRef(raw);
	}
	if (containsVariableRefs(raw)) {
		return emitInterpolatedString(raw);
	}
	return JSON.stringify(raw);
}

/**
 * Emits a reference to a Cloudflare Worker environment variable.
 * Used for credentials and API keys defined in the Variables panel.
 *
 * Example: emitEnvRef("NLS_TOKEN") → `this.env.NLS_TOKEN`
 */
function emitEnvRef(varName: string): string {
	return `this.env.${varName}`;
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
 * Emit a `step.do`-wrapped WORKFLOW_SVC.updateInstanceProgress call.
 *
 * Wrapping in `step.do` makes the call durable: on replay Cloudflare returns
 * the cached void result without re-executing the RPC, which means:
 *  - No redundant network calls to workflow-svc during replay
 *  - Transient RPC failures are auto-retried by the platform instead of
 *    crashing the whole workflow run
 *
 * The step name is unique per (node, status) tuple and per retry iteration so
 * Cloudflare's cache key never collides across loop iterations.
 *
 * When inside a retry loop, `retryVarName` is passed to record the count.
 * When inside a nested Challenge inline-retry loop, `innerRetryVarName` is
 * additionally passed to keep names unique per (outer, inner) combination.
 */
function generateProgressCall(
	node: WorkflowNode,
	indent: string,
	status: "in_progress" | "completed" | "waiting_event",
	eventType?: string,
	retryVarName?: string,
	innerRetryVarName?: string,
	/**
	 * Optional suffix appended to the step.do cache key to disambiguate
	 * multiple waiting_event calls for the same node (e.g. "-accept" vs "-sig"
	 * in a signature challenge that has both an acceptance and a signing phase).
	 */
	stepNameSuffix?: string,
): string {
	const stepName = createStepName(node);
	const nodeType = node.type;
	const nodeId = node.id;

	// Build a unique step.do cache key: _prog-<nodeId>-<status>[suffix][retry suffix]
	const baseProgName = `_prog-${nodeId}-${status}${stepNameSuffix ? `-${stepNameSuffix}` : ""}`;
	let stepDoNameExpr: string;
	if (retryVarName && innerRetryVarName) {
		stepDoNameExpr =
			`(${retryVarName} > 0 || ${innerRetryVarName} > 0)` +
			` ? \`${baseProgName}\${${retryVarName} > 0 ? \`-r\${${retryVarName}}\` : ""}\${${innerRetryVarName} > 0 ? \`-ch\${${innerRetryVarName}}\` : ""}\`` +
			` : "${baseProgName}"`;
	} else if (retryVarName) {
		stepDoNameExpr = `${retryVarName} > 0 ? \`${baseProgName}-r\${${retryVarName}}\` : "${baseProgName}"`;
	} else {
		stepDoNameExpr = `"${baseProgName}"`;
	}

	const i2 = indent + "\t";
	const i3 = indent + "\t\t";
	let code = `${indent}await step.do(${stepDoNameExpr}, async () => {\n`;
	code += `${i2}await this.env.WORKFLOW_SVC.updateInstanceProgress({\n`;
	code += `${i3}workflowId: this.env.WORKFLOW_ID,\n`;
	code += `${i3}instanceId: event.instanceId,\n`;
	code += `${i3}nodeId: "${escapeString(nodeId)}",\n`;
	code += `${i3}nodeType: "${escapeString(nodeType)}",\n`;
	code += `${i3}stepName: "${escapeString(stepName)}",\n`;
	code += `${i3}status: "${status}",\n`;
	if (eventType) {
		code += `${i3}eventType: "${escapeString(eventType)}",\n`;
	}
	if (retryVarName) {
		code += `${i3}retryCount: ${retryVarName},\n`;
	}
	code += `${i2}});\n`;
	code += `${indent}});\n`;
	return code;
}

/**
 * Emit a `step.do`-wrapped CASES_SVC.updateCaseObject call.
 *
 * Same durability rationale as generateProgressCall: wrapping prevents
 * redundant RPC calls on replay and enables platform-level retry on failure.
 *
 * The step.do cache key is unique per node (and per retry iteration when
 * inside a retry zone) so different loop iterations don't share a cached entry.
 */
function generateCaseObjectCall(
	node: WorkflowNode,
	indent: string,
	varName?: string,
	retryVarName?: string,
	innerRetryVarName?: string,
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

	// Build a unique step.do cache key: _case-<nodeId>[retry suffix]
	const baseCaseName = `_case-${node.id}`;
	let stepDoNameExpr: string;
	if (retryVarName && innerRetryVarName) {
		stepDoNameExpr =
			`(${retryVarName} > 0 || ${innerRetryVarName} > 0)` +
			` ? \`${baseCaseName}\${${retryVarName} > 0 ? \`-r\${${retryVarName}}\` : ""}\${${innerRetryVarName} > 0 ? \`-ch\${${innerRetryVarName}}\` : ""}\`` +
			` : "${baseCaseName}"`;
	} else if (retryVarName) {
		stepDoNameExpr = `${retryVarName} > 0 ? \`${baseCaseName}-r\${${retryVarName}}\` : "${baseCaseName}"`;
	} else {
		stepDoNameExpr = `"${baseCaseName}"`;
	}

	const i2 = indent + "\t";
	let code = `${indent}await step.do(${stepDoNameExpr}, async () => {\n`;
	code += `${i2}await this.env.CASES_SVC.updateCaseObject(\n`;
	code += `${i2}\tevent.payload.caseId as string,\n`;
	code += `${i2}\t${data},\n`;
	code += `${i2});\n`;
	code += `${indent}});\n`;
	return code;
}

/**
 * Emit a `step.do`-wrapped CASES_SVC.updateCaseLoanData call for NLS nodes
 * that create or fetch loan/amortization data.
 */
function generateCaseLoanDataCall(
	node: WorkflowNode,
	indent: string,
	varName: string,
	functionId: NLSFunctionId,
	retryVarName?: string,
): string {
	const baseName = `_loan-${node.id}`;
	let stepDoNameExpr: string;
	if (retryVarName) {
		stepDoNameExpr = `${retryVarName} > 0 ? \`${baseName}-r\${${retryVarName}}\` : "${baseName}"`;
	} else {
		stepDoNameExpr = `"${baseName}"`;
	}

	const i2 = indent + "\t";
	let code = `${indent}await step.do(${stepDoNameExpr}, async () => {\n`;

	if (functionId === "cancelLoan") {
		code += `${i2}await this.env.CASES_SVC.clearCaseLoanData(\n`;
		code += `${i2}\tevent.payload.caseId as string,\n`;
		code += `${i2});\n`;
	} else {
		code += `${i2}await this.env.CASES_SVC.updateCaseLoanData(\n`;
		code += `${i2}\tevent.payload.caseId as string,\n`;
		code += `${i2}\t${varName},\n`;
		code += `${i2});\n`;
	}

	code += `${indent}});\n`;
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
	const varName = getVarName(node.id);
	const isHoisted = _hoistedNodeIds.has(node.id);
	const varDecl = captureResult
		? isHoisted
			? `${varName} = `
			: `const ${varName} = `
		: "";
	const eventType = `form-submission-${stepName}`;
	const stepNameExpr = retryVarName
		? retryStepNameExpr(stepName, retryVarName)
		: `"${stepName}"`;

	const formId = node.config.formId as string | undefined;
	const formVersion = node.config.formVersion as number | undefined;
	const formMeta =
		formId !== undefined
			? ` | form: ${formId}${formVersion !== undefined ? ` v${formVersion}` : ""}`
			: "";

	let code = `${indent}// Form: ${node.title} (roles: ${roles}${formMeta})\n`;
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
	const authConfig = node.config.authConfig as APIAuthConfig | undefined;
	const customHeaders = (node.config.customHeaders as APIHeaderEntry[]) ?? [];
	const bodyConfig = node.config.bodyConfig as APIBodyConfig | undefined;
	const responseConfig = node.config.responseConfig as
		| APIResponseConfig
		| undefined;
	const hasBody = ["POST", "PUT", "PATCH"].includes(method);
	// API nodes always capture the response so the cases UI can display it,
	// regardless of whether an explicit outputSchema is configured.
	const varName = getVarName(node.id);
	const isHoisted = _hoistedNodeIds.has(node.id);
	const varDecl = isHoisted ? `${varName} = ` : `const ${varName} = `;
	const stepNameExpr = retryVarName
		? retryStepNameExpr(stepName, retryVarName)
		: `"${stepName}"`;
	const isOAuth2 =
		authConfig?.type === "oauth2-client-credentials" &&
		authConfig.oauth2TokenUrl &&
		authConfig.oauth2ClientId &&
		authConfig.oauth2ClientSecret;
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

	// Emit OAuth2 token fetch step before the main API step
	if (isOAuth2 && authConfig) {
		code += generateOAuth2TokenFetch(authConfig, stepName, indent);
	}

	// Wrap in try/catch for return-to-checkpoint failure handling
	if (isReturnToCheckpoint && retryVarName) {
		code += `${indent}try {\n`;
		indent += "\t";
	}

	code += `${indent}${varDecl}await step.do(${stepNameExpr}, async () => {\n`;

	// Validate body content at code-generation time (build-time check)
	if (hasBody && bodyConfig) {
		const bodyMode = bodyConfig.mode ?? "none";
		if (bodyMode === "raw-json" && bodyConfig.rawJson) {
			if (!isValidJson(bodyConfig.rawJson)) {
				throw new Error(
					`API node "${node.config.label ?? node.id}": invalid JSON in request body`,
				);
			}
		}
		if (bodyMode === "raw-xml" && bodyConfig.rawXml) {
			if (!isWellFormedXml(bodyConfig.rawXml)) {
				throw new Error(
					`API node "${node.config.label ?? node.id}": malformed XML in request body`,
				);
			}
		}
	}

	// Build headers
	const hasCustomHeaders = customHeaders.length > 0;
	const hasAuthHeader =
		authConfig && authConfig.type !== "none" && authConfig.type !== undefined;
	if (hasAuthHeader || hasCustomHeaders || hasBody) {
		code += `${indent}\tconst headers: Record<string, string> = {};\n`;
		if (hasBody) {
			const bodyMode = bodyConfig?.mode ?? "none";
			const contentType =
				bodyMode === "raw-xml" ? "application/xml" : "application/json";
			code += `${indent}\theaders["Content-Type"] = "${contentType}";\n`;
		}
		// Auth header
		if (authConfig?.type === "bearer" && authConfig.bearerToken) {
			code += `${indent}\theaders["Authorization"] = \`Bearer \${${emitAuthValue(authConfig.bearerToken)}}\`;\n`;
		} else if (
			authConfig?.type === "api-key" &&
			authConfig.apiKeyHeader &&
			authConfig.apiKeyValue
		) {
			code += `${indent}\theaders[${JSON.stringify(authConfig.apiKeyHeader)}] = ${emitAuthValue(authConfig.apiKeyValue)};\n`;
		} else if (isOAuth2) {
			code += `${indent}\theaders["Authorization"] = \`Bearer \${_oauth2Token_${getVarName(node.id)}.access_token}\`;\n`;
		}
		// Custom headers. Supports, in order:
		//   - "env:VAR"             → this.env.VAR        (legacy prefix)
		//   - "${secret.VAR}"       → this.env.VAR        (new picker token)
		//   - any text with `${…}`  → interpolated template literal
		//   - plain literal         → "quoted string"
		for (const h of customHeaders) {
			let val: string;
			if (h.value.startsWith("env:")) {
				val = emitEnvRef(h.value.slice(4).trim());
			} else {
				const pureSecret = h.value.match(PURE_SECRET_RE);
				val = pureSecret
					? emitEnvRef(pureSecret[1])
					: emitInterpolatedString(h.value);
			}
			code += `${indent}\theaders[${JSON.stringify(h.key)}] = ${val};\n`;
		}
	}

	// Build fetch call
	code += `${indent}\tconst response = await fetch(${emitInterpolatedString(endpoint)}, {\n`;
	code += `${indent}\t\tmethod: "${method}",\n`;

	if (hasAuthHeader || hasCustomHeaders || hasBody) {
		code += `${indent}\t\theaders,\n`;
	}

	// Body
	if (hasBody) {
		const mode = bodyConfig?.mode ?? "none";
		if (mode === "raw-json" && bodyConfig?.rawJson) {
			// Always use backticks: preserves inner JSON quotes and allows
			// ${nodeId.prop} and ${secret.VAR} refs (both mapped via
			// expandVariablePath so secrets resolve to this.env.VAR).
			const dehyphenated = bodyConfig.rawJson.replace(
				/\$\{([^}]+)\}/g,
				(_, path: string) => `\${${expandVariablePath(path)}}`,
			);
			const escaped = dehyphenated.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
			code += `${indent}\t\tbody: \`${escaped}\`,\n`;
		} else if (mode === "raw-xml" && bodyConfig?.rawXml) {
			// Same backtick strategy as raw-json: preserves XML angle brackets and
			// allows ${nodeId.prop} / ${secret.VAR} interpolation.
			const dehyphenated = bodyConfig.rawXml.replace(
				/\$\{([^}]+)\}/g,
				(_, path: string) => `\${${expandVariablePath(path)}}`,
			);
			const escaped = dehyphenated.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
			code += `${indent}\t\tbody: \`${escaped}\`,\n`;
		} else if (mode === "field-mapping" && bodyConfig?.fieldMappings?.length) {
			const mappingsCode = bodyConfig.fieldMappings
				.map(
					(m) =>
						`${JSON.stringify(m.targetKey)}: ${expandVariableRefs(m.sourceExpression)}`,
				)
				.join(`, `);
			code += `${indent}\t\tbody: JSON.stringify({ ${mappingsCode} }),\n`;
		} else {
			code += `${indent}\t\tbody: JSON.stringify(event.payload),\n`;
		}
	}

	code += `${indent}\t});\n`;
	code += `${indent}\tif (!response.ok) {\n`;
	code += `${indent}\t\tthrow new Error(\`API call failed: \${response.status}\`);\n`;
	code += `${indent}\t}\n`;

	// Response extraction
	const extractPath = responseConfig?.extractPath?.trim();
	if (extractPath) {
		code += `${indent}\tconst _responseData = (await response.json()) as Record<string, unknown>;\n`;
		const accessExpr = extractPath
			.split(".")
			.reduce(
				(acc, key) => `(${acc} as Record<string, unknown>)["${key}"]`,
				"_responseData",
			);
		code += `${indent}\treturn ${accessExpr} as Record<string, unknown>;\n`;
	} else {
		code += `${indent}\treturn (await response.json()) as Record<string, unknown>;\n`;
	}

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
	code += generateCaseObjectCall(node, indent, varName, retryVarName);
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

const NLS_RPC_METHOD: Record<string, string> = {
	createLoan: "nlsCreateLoan",
	cancelLoan: "nlsCancelLoan",
	getAmortization: "nlsGetAmortization",
};

/**
 * Generate code for the prequalification RPC call to CASES_SVC.
 * Handles both applicant and coapplicant actor types.
 */
function generatePrequalificationCall(
	node: WorkflowNode,
	indent: string,
	fields: Array<{ fieldId: string; value: string }>,
): string {
	const i2 = indent + "\t";

	const fieldMap: Record<string, string> = {};
	for (const field of fields) {
		if (field.value) {
			fieldMap[field.fieldId] = field.value;
		}
	}

	let code = "";

	const actorTypeValue = fieldMap["actorType"]
		? emitInterpolatedString(fieldMap["actorType"])
		: '"applicant"';

	code += `${i2}const _actorType = ${actorTypeValue} as "applicant" | "coapplicant";\n`;

	const coapplicantFields = [
		"firstName",
		"middleName",
		"lastName",
		"email",
		"birthDate",
		"phoneNumber",
		"taxIdType",
		"taxIdNumber",
		"addressStreetNumber",
		"addressStreetName",
		"addressApt",
		"addressCity",
		"addressState",
		"addressZipCode",
	];

	code += `${i2}const _data = _actorType === "coapplicant" ? {\n`;
	for (const field of coapplicantFields) {
		if (fieldMap[field]) {
			code += `${i2}\t${field}: ${emitInterpolatedString(fieldMap[field])},\n`;
		}
	}
	code += `${i2}} : null;\n`;

	const pullTypeValue = fieldMap["pullType"]
		? emitInterpolatedString(fieldMap["pullType"])
		: "undefined";

	const userIdValue = fieldMap["userId"]
		? emitInterpolatedString(fieldMap["userId"])
		: "event.payload.clientUserId as string";

	code += `${i2}const _prequal = await this.env.CASES_SVC.runPrequalification({\n`;
	code += `${i2}\tuserJwt: event.payload._jwt as string,\n`;
	code += `${i2}\tactorType: _actorType,\n`;
	code += `${i2}\tuserId: _actorType === "applicant" ? ${userIdValue} : undefined,\n`;
	code += `${i2}\tdata: _data,\n`;
	code += `${i2}\tcaseId: event.payload.caseId as string,\n`;
	code += `${i2}\torgId: event.payload.orgId as string | undefined,\n`;
	code += `${i2}\tpullType: ${pullTypeValue} as "soft" | "hard" | "new" | undefined,\n`;
	code += `${i2}});\n`;
	code += `${i2}return _prequal as Record<string, unknown>;\n`;

	return code;
}

/**
 * Generate code for the findPrequalificationMatches RPC call to CASES_SVC.
 */
function generateFindMatchesCall(
	node: WorkflowNode,
	indent: string,
	fields: Array<{ fieldId: string; value: string }>,
): string {
	const i2 = indent + "\t";

	const fieldMap: Record<string, string> = {};
	for (const field of fields) {
		if (field.value) {
			fieldMap[field.fieldId] = field.value;
		}
	}

	let code = "";

	const matchFields = ["taxIdNumber", "phone", "email", "userId"];
	code += `${i2}const _matchData: Record<string, string | undefined> = {};\n`;
	for (const f of matchFields) {
		if (fieldMap[f]) {
			code += `${i2}_matchData[${JSON.stringify(f)}] = ${emitInterpolatedString(fieldMap[f])};\n`;
		}
	}

	code += `${i2}const _matches = await this.env.CASES_SVC.findPrequalificationMatches(_matchData);\n`;
	code += `${i2}return _matches as Record<string, unknown>;\n`;

	return code;
}

function generateNLSStep(
	node: WorkflowNode,
	indent: string,
	retryVarName?: string,
): string {
	const cfg = node.config as NLSNodeConfig | undefined;
	const functionId = (cfg?.functionId ?? "createLoan") as NLSFunctionId;
	const failureHandling = cfg?.failureHandling as
		| APIFailureHandling
		| undefined;
	const fields = cfg?.fields ?? [];
	const stepName = createStepName(node);
	const varName = getVarName(node.id);
	const isHoisted = _hoistedNodeIds.has(node.id);
	const varDecl = isHoisted ? `${varName} = ` : `const ${varName} = `;
	const stepNameExpr = retryVarName
		? retryStepNameExpr(stepName, retryVarName)
		: `"${stepName}"`;
	const isReturnToCheckpoint =
		failureHandling?.onFailure === "return-to-checkpoint";

	let code = `${indent}// NLS ${functionId}: ${node.title}\n`;
	code += generateProgressCall(
		node,
		indent,
		"in_progress",
		undefined,
		retryVarName,
	);

	if (isReturnToCheckpoint && retryVarName) {
		code += `${indent}try {\n`;
		indent += "\t";
	}

	code += `${indent}${varDecl}await step.do(${stepNameExpr}, async () => {\n`;

	// Special handling for prequalification — dispatches to CASES_SVC
	if (functionId === "prequalification") {
		code += generatePrequalificationCall(node, indent, fields);
	} else if (functionId === "findPrequalificationMatches") {
		code += generateFindMatchesCall(node, indent, fields);
	} else {
		const rpcMethod = NLS_RPC_METHOD[functionId] ?? `nls${functionId}`;
		// Build body object from configured fields
		code += `${indent}\tconst _nlsBody: Record<string, unknown> = {};\n`;
		for (const field of fields) {
			if (!field.value) continue;
			const valueExpr = emitInterpolatedString(field.value);
			code += `${indent}\t_nlsBody[${JSON.stringify(field.fieldId)}] = ${valueExpr};\n`;
		}

		code += `${indent}\tconst _nlsResult = await this.env.PROXY_SVC.${rpcMethod}({\n`;
		code += `${indent}\t\tbearerToken: event.payload._jwt as string,\n`;
		code += `${indent}\t\tbody: _nlsBody,\n`;
		code += `${indent}\t});\n`;
		code += `${indent}\treturn _nlsResult as Record<string, unknown>;\n`;
	}
	code += `${indent}}`;

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
	code += generateCaseObjectCall(node, indent, varName, retryVarName);
	code += generateCaseLoanDataCall(
		node,
		indent,
		varName,
		functionId,
		retryVarName,
	);
	code += generateProgressCall(
		node,
		indent,
		"completed",
		undefined,
		retryVarName,
	);

	if (isReturnToCheckpoint && retryVarName) {
		indent = indent.slice(1);
		const maxR = failureHandling?.maxRetries ?? 0;
		code += `${indent}} catch (_nlsErr) {\n`;
		code += `${indent}\tif (${retryVarName} < ${maxR}) {\n`;
		code += `${indent}\t\tcontinue; // Return to checkpoint and retry\n`;
		code += `${indent}\t}\n`;
		code += `${indent}\tthrow _nlsErr; // Max retries exhausted — propagate error\n`;
		code += `${indent}}\n`;
	}

	return code;
}

/**
 * Generate a step.do that fetches an OAuth2 access token using client_credentials
 * (or password grant if oauth2Username/oauth2Password are set).
 * The token is stored in a local const for use in the subsequent API step.
 */
function generateOAuth2TokenFetch(
	auth: APIAuthConfig,
	stepName: string,
	indent: string,
): string {
	const tokenVarSuffix = stepName.replace(/-/g, "_");
	const grantType =
		auth.oauth2Username && auth.oauth2Password
			? "password"
			: "client_credentials";

	let code = `${indent}const _oauth2Token_${tokenVarSuffix} = await step.do("get-token-${stepName}", async () => {\n`;
	code += `${indent}\tconst _tokenRes = await fetch(${auth.oauth2TokenUrl ? emitAuthValue(auth.oauth2TokenUrl) : '"<TOKEN_URL>"'}, {\n`;
	code += `${indent}\t\tmethod: "POST",\n`;
	code += `${indent}\t\theaders: { "Content-Type": "application/x-www-form-urlencoded" },\n`;
	code += `${indent}\t\tbody: new URLSearchParams({\n`;
	code += `${indent}\t\t\tgrant_type: "${grantType}",\n`;
	if (auth.oauth2ClientId) {
		code += `${indent}\t\t\tclient_id: ${emitAuthValue(auth.oauth2ClientId)},\n`;
	}
	if (auth.oauth2ClientSecret) {
		code += `${indent}\t\t\tclient_secret: ${emitAuthValue(auth.oauth2ClientSecret)},\n`;
	}
	if (auth.oauth2Scope) {
		code += `${indent}\t\t\tscope: ${emitAuthValue(auth.oauth2Scope)},\n`;
	}
	if (grantType === "password" && auth.oauth2Username && auth.oauth2Password) {
		code += `${indent}\t\t\tusername: ${emitAuthValue(auth.oauth2Username)},\n`;
		code += `${indent}\t\t\tpassword: ${emitAuthValue(auth.oauth2Password)},\n`;
	}
	code += `${indent}\t\t}),\n`;
	code += `${indent}\t});\n`;
	code += `${indent}\tif (!_tokenRes.ok) throw new Error(\`OAuth2 token request failed: \${_tokenRes.status}\`);\n`;
	code += `${indent}\tconst _tokenData = await _tokenRes.json() as Record<string, unknown>;\n`;
	code += `${indent}\treturn { access_token: _tokenData.access_token as string };\n`;
	code += `${indent}});\n`;
	return code;
}

/**
 * Generate code for a Transform node
 */
function generateTransformStep(
	node: WorkflowNode,
	indent: string,
	retryVarName?: string,
): string {
	const stepName = createStepName(node);
	const transformCode = (node.config.code as string) || "// Transform logic";
	const captureResult = nodeHasOutputSchema(node);
	const varName = getVarName(node.id);
	const isHoisted = _hoistedNodeIds.has(node.id);
	const varDecl = captureResult
		? isHoisted
			? `${varName} = `
			: `const ${varName} = `
		: "";
	const resultCast = captureResult ? " as Record<string, unknown>" : "";
	const stepNameExpr = retryVarName
		? retryStepNameExpr(stepName, retryVarName)
		: `"${stepName}"`;

	let code = `${indent}// Transform: ${node.title}\n`;
	code += generateProgressCall(
		node,
		indent,
		"in_progress",
		undefined,
		retryVarName,
	);
	code += `${indent}${varDecl}await step.do(${stepNameExpr}, async () => {\n`;
	const expandedCode = expandVariableRefs(transformCode);
	code += `${indent}\t${expandedCode.split("\n").join(`\n${indent}\t`)}\n`;
	code += `${indent}})${resultCast};\n`;
	code += generateCaseObjectCall(
		node,
		indent,
		captureResult ? varName : undefined,
		retryVarName,
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
			code += `${indent}\t\tsubject: ${emitInterpolatedString(subject)},\n`;
		}
		if (mergeVars.length > 0) {
			code += `${indent}\t\tmergeVars: {\n`;
			for (const mv of mergeVars) {
				const key = escapeString(mv.key.toUpperCase());
				const value = mv.value.trim();
				let valueCode: string;
				if (hasTemplateVars(value)) {
					// Template string with variable interpolation → JS template literal
					// with each ${alias.x} token expanded via expandVariablePath so that
					// start-node vars resolve to event.payload.x at runtime.
					valueCode = emitInterpolatedString(value);
				} else if (/[.[\](]/.test(value)) {
					// Plain JS expression (path access) → emit raw with type cast
					valueCode = `${value} as string`;
				} else {
					// Plain string literal
					valueCode = `"${escapeString(value)}"`;
				}
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
			code += `${indent}\t\tbody: ${emitInterpolatedString(body)},\n`;
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
	code += generateCaseObjectCall(node, indent, undefined, retryVarName);
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
 * Generate code for a Challenge node with challengeType === "signature".
 *
 * The generated workflow step:
 * 1. Waits for operator acceptance (`signature_acceptance` event). If rejected
 *    or timed-out the node resolves with `signed: false, rejected: true`.
 * 2. Only if accepted: calls `CASES_SVC.createSignatureRequest(...)` — this
 *    triggers the Dropbox Sign API call.
 * 3. Waits for the "signature_signed" event forwarded by the webhook handler
 *    (webhook → cases-svc → WORKFLOW_SVC.sendEvent).
 *
 * Template expressions in templateId, signers.email/name, and customField.value
 * are resolved using `escapeStringTemplate` so they evaluate against runtime
 * workflow variables (same pattern as Message node mergeVars).
 */
function generateSignatureChallengeStep(
	node: WorkflowNode,
	config: SignatureChallengeConfig | undefined,
	indent: string,
	retryVarName?: string,
): string {
	const stepName = createStepName(node);
	const outputVar = getVarName(node.id);
	const rawVar = `_${outputVar}Evt`;
	const acceptVar = `_${outputVar}AcceptEvt`;
	const roles = node.roles.length > 0 ? node.roles.join(", ") : "any";
	const timeout = config?.challengeTimeout;
	const timeoutStr = timeout ? `${timeout.value} ${timeout.unit}` : "72 hours";

	const acceptStepName = `${stepName}-accept`;
	const acceptStepNameExpr = retryVarName
		? retryStepNameExpr(acceptStepName, retryVarName)
		: `"${acceptStepName}"`;

	const stepNameExpr = retryVarName
		? retryStepNameExpr(stepName, retryVarName)
		: `"${stepName}"`;

	const i1 = indent + "\t";
	const i2 = indent + "\t\t";

	// Build signers JSON
	const signersLines: string[] = [];
	for (const signer of config?.signers ?? []) {
		const emailExpr =
			signer.source === "variable" && signer.email
				? emitInterpolatedString(signer.email)
				: `""`;
		const nameExpr =
			signer.source === "variable" && signer.name
				? emitInterpolatedString(signer.name)
				: `""`;
		const phoneExpr = signer.smsPhoneNumber
			? emitInterpolatedString(signer.smsPhoneNumber)
			: "undefined";
		signersLines.push(
			`{ role: ${JSON.stringify(signer.role)}, source: ${JSON.stringify(signer.source)}` +
				(signer.caseRole
					? `, caseRole: ${JSON.stringify(signer.caseRole)}`
					: "") +
				(signer.source === "variable"
					? `, email: ${emailExpr}, name: ${nameExpr}`
					: "") +
				(signer.smsPhoneNumber ? `, smsPhoneNumber: ${phoneExpr}` : "") +
				" }",
		);
	}

	// Build customFields JSON
	const cfLines: string[] = [];
	for (const cf of config?.customFields ?? []) {
		const valueExpr = cf.value ? emitInterpolatedString(cf.value) : '""';
		cfLines.push(
			`{ apiId: ${JSON.stringify(cf.apiId)}, name: ${JSON.stringify(cf.name)}, value: ${valueExpr} }`,
		);
	}

	const templateIdExpr = config?.templateId
		? emitInterpolatedString(config.templateId)
		: '""';

	let code = `${indent}// Signature Challenge: ${node.title} (flow: ${config?.flow ?? "email_only"} | roles: ${roles})\n`;

	// Phase 1: wait for operator acceptance before creating the contract.
	// Uses suffix "accept" in the progress step.do name to avoid collision with
	// the subsequent "waiting_event" for the signature itself (suffix "sig").
	code += generateProgressCall(
		node,
		indent,
		"waiting_event",
		"signature_acceptance",
		retryVarName,
		undefined,
		"accept",
	);
	code += `${indent}${acceptVar} = await step.waitForEvent<{ accepted: boolean }>(\n`;
	code += `${indent}\t${acceptStepNameExpr},\n`;
	code += `${indent}\t{\n`;
	code += `${indent}\t\ttype: "signature_acceptance",\n`;
	code += `${indent}\t\ttimeout: "${timeoutStr}",\n`;
	code += `${indent}\t},\n`;
	code += `${indent});\n`;

	// Determine if the operator accepted
	code += `${indent}const _${outputVar}Accepted = ${acceptVar} !== null && !!(${acceptVar} as { payload: { accepted?: boolean } }).payload?.accepted;\n`;

	// Phase 2 (only if accepted): create signature request and wait for signatures.
	code += `${indent}if (_${outputVar}Accepted) {\n`;

	// Step: create the signature request via cases-svc RPC
	code += `${i1}await step.do(\`${stepName}-create\`, async () => {\n`;
	code += `${i2}const _sigTemplateId = ${templateIdExpr};\n`;
	code += `${i2}const _sigSigners = [\n`;
	for (const line of signersLines) {
		code += `${i2}\t${line},\n`;
	}
	code += `${i2}];\n`;
	code += `${i2}const _sigCustomFields = [\n`;
	for (const line of cfLines) {
		code += `${i2}\t${line},\n`;
	}
	code += `${i2}];\n`;
	code += `${i2}await this.env.CASES_SVC.createSignatureRequest({\n`;
	code += `${i2}\tcaseId: event.payload.caseId as string,\n`;
	code += `${i2}\tworkflowInstanceId: event.instanceId,\n`;
	code += `${i2}\tworkflowNodeId: ${JSON.stringify(node.id)},\n`;
	code += `${i2}\tnodeConfig: {\n`;
	code += `${i2}\t\ttemplateId: _sigTemplateId,\n`;
	code += `${i2}\t\tflow: ${JSON.stringify(config?.flow ?? "email_only")},\n`;
	if (config?.title) {
		code += `${i2}\t\ttitle: ${emitInterpolatedString(config.title)},\n`;
	}
	if (config?.subject) {
		code += `${i2}\t\tsubject: ${emitInterpolatedString(config.subject)},\n`;
	}
	if (config?.message) {
		code += `${i2}\t\tmessage: ${emitInterpolatedString(config.message)},\n`;
	}
	if (config?.testMode !== undefined) {
		code += `${i2}\t\ttestMode: ${config.testMode},\n`;
	}
	if (config?.smsAuthentication) {
		code += `${i2}\t\tsmsAuthentication: true,\n`;
	}
	if ((config?.ccEmailAddresses ?? []).length > 0) {
		code += `${i2}\t\tccEmailAddresses: ${JSON.stringify(config!.ccEmailAddresses)},\n`;
	}
	code += `${i2}\t\tsigners: _sigSigners,\n`;
	code += `${i2}\t\tcustomFields: _sigCustomFields,\n`;
	code += `${i2}\t},\n`;
	code += `${i2}});\n`;
	code += `${i1}});\n`;

	// Wait for "signature_signed" event sent by webhook handler.
	// Uses suffix "sig" to give this progress step a unique step.do name,
	// since the acceptance phase already claimed "_prog-{nodeId}-waiting_event-accept".
	code += generateProgressCall(
		node,
		i1,
		"waiting_event",
		"signature_signed",
		retryVarName,
		undefined,
		"sig",
	);
	code += `${i1}${rawVar} = await step.waitForEvent<{ signed?: boolean; reason?: string; signatureRequestId: string; documentId?: string }>(\n`;
	code += `${i1}\t${stepNameExpr},\n`;
	code += `${i1}\t{\n`;
	code += `${i1}\t\ttype: "signature_signed",\n`;
	code += `${i1}\t\ttimeout: "${timeoutStr}",\n`;
	code += `${i1}\t},\n`;
	code += `${i1});\n`;
	code += generateCaseObjectCall(node, i1, rawVar, retryVarName);

	// Normalize output inside the accepted branch.
	// rawVar === null  → timed out waiting for signatures.
	// payload.signed === false → negative outcome (declined / canceled / errored).
	// anything else   → positive outcome (all_signed).
	code += `${i1}{\n`;
	code += `${i1}\tconst _sigEvtPayload = (${rawVar} as { payload?: { signed?: boolean; reason?: string; signatureRequestId?: string; documentId?: string } } | null)?.payload;\n`;
	code += `${i1}\tconst _sigFailed = _sigEvtPayload?.signed === false;\n`;
	code += `${i1}\t${outputVar} = (${rawVar} === null)\n`;
	code += `${i1}\t\t? { signed: false, timedOut: true, rejected: false, declined: false, canceled: false, errored: false, reason: "timedOut", signatureRequestId: null, documentId: null }\n`;
	code += `${i1}\t\t: _sigFailed\n`;
	code += `${i1}\t\t\t? {\n`;
	code += `${i1}\t\t\t\tsigned: false,\n`;
	code += `${i1}\t\t\t\ttimedOut: false,\n`;
	code += `${i1}\t\t\t\trejected: false,\n`;
	code += `${i1}\t\t\t\tdeclined: _sigEvtPayload?.reason === "declined",\n`;
	code += `${i1}\t\t\t\tcanceled: _sigEvtPayload?.reason === "canceled",\n`;
	code += `${i1}\t\t\t\terrored: _sigEvtPayload?.reason === "errored",\n`;
	code += `${i1}\t\t\t\treason: _sigEvtPayload?.reason ?? null,\n`;
	code += `${i1}\t\t\t\tsignatureRequestId: _sigEvtPayload?.signatureRequestId ?? null,\n`;
	code += `${i1}\t\t\t\tdocumentId: null,\n`;
	code += `${i1}\t\t\t}\n`;
	code += `${i1}\t\t\t: {\n`;
	code += `${i1}\t\t\t\tsigned: true,\n`;
	code += `${i1}\t\t\t\ttimedOut: false,\n`;
	code += `${i1}\t\t\t\trejected: false,\n`;
	code += `${i1}\t\t\t\tdeclined: false,\n`;
	code += `${i1}\t\t\t\tcanceled: false,\n`;
	code += `${i1}\t\t\t\terrored: false,\n`;
	code += `${i1}\t\t\t\treason: null,\n`;
	code += `${i1}\t\t\t\tsignatureRequestId: _sigEvtPayload?.signatureRequestId ?? null,\n`;
	code += `${i1}\t\t\t\tdocumentId: _sigEvtPayload?.documentId ?? null,\n`;
	code += `${i1}\t\t\t};\n`;
	code += `${i1}}\n`;

	// Else branch: operator rejected or timed-out at the acceptance phase.
	code += `${indent}} else {\n`;
	code += generateCaseObjectCall(node, i1, acceptVar, retryVarName);
	code += `${i1}${outputVar} = (${acceptVar} === null)\n`;
	code += `${i1}\t? { signed: false, timedOut: true, rejected: false, declined: false, canceled: false, errored: false, reason: "timedOut", signatureRequestId: null, documentId: null }\n`;
	code += `${i1}\t: { signed: false, timedOut: false, rejected: true, declined: false, canceled: false, errored: false, reason: "rejected", signatureRequestId: null, documentId: null };\n`;
	code += `${indent}}\n`;

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
	const config = node.config as ChallengeNodeConfig | undefined;
	const challengeType = config?.challengeType || "acceptance";

	// Signature challenges have a completely different execution pattern:
	// 1. Create the Dropbox Sign request via cases-svc RPC
	// 2. Wait for the "signature_signed" event sent by the webhook handler
	if (challengeType === "signature") {
		return generateSignatureChallengeStep(
			node,
			config as SignatureChallengeConfig,
			indent,
			retryVarName,
		);
	}
	const stepName = createStepName(node);
	// `outputVar` is the public-facing alias used by downstream tokens (e.g. `approval.accepted`).
	// `rawVar` is the internal waitForEvent result; suffixed to avoid collision with outputVar.
	const outputVar = getVarName(node.id);
	const rawVar = `_${outputVar}Evt`;
	const timeout = config?.challengeTimeout;
	const timeoutStr = timeout ? `${timeout.value} ${timeout.unit}` : "24 hours";
	const eventType = challengeType;

	const inlineRetries = config?.retries;
	const hasInlineRetry = inlineRetries && (inlineRetries.maxRetries ?? 0) > 0;

	const roles = node.roles.length > 0 ? node.roles.join(", ") : "any";
	const retryRoles =
		inlineRetries?.roles && inlineRetries.roles.length > 0
			? inlineRetries.roles.join(", ")
			: null;

	let code = `${indent}// Challenge: ${node.title} (${challengeType} | roles: ${roles}${retryRoles ? ` | retry-roles: ${retryRoles}` : ""})\n`;

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
			chVar,
		);
		code += `${innerIndent}${rawVar} = await step.waitForEvent<{ accepted: boolean }>(\n`;
		code += `${innerIndent}\t${stepNameExpr},\n`;
		code += `${innerIndent}\t{\n`;
		code += `${innerIndent}\t\ttype: "${challengeType}",\n`;
		code += `${innerIndent}\t\ttimeout: "${timeoutStr}",\n`;
		code += `${innerIndent}\t},\n`;
		code += `${innerIndent});\n`;
		code += generateCaseObjectCall(
			node,
			innerIndent,
			rawVar,
			retryVarName,
			chVar,
		);
		code += emitChallengeOutputAssignment(innerIndent, rawVar, outputVar);
		code += generateProgressCall(
			node,
			innerIndent,
			"completed",
			undefined,
			retryVarName,
			chVar,
		);
		// If the challenge was accepted, exit the inline retry loop
		code += `${innerIndent}if (${outputVar}.accepted) break;\n`;
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
		code += `${indent}${rawVar} = await step.waitForEvent<{ accepted: boolean }>(\n`;
		code += `${indent}\t${stepNameExpr},\n`;
		code += `${indent}\t{\n`;
		code += `${indent}\t\ttype: "${challengeType}",\n`;
		code += `${indent}\t\ttimeout: "${timeoutStr}",\n`;
		code += `${indent}\t},\n`;
		code += `${indent});\n`;
		code += generateCaseObjectCall(node, indent, rawVar, retryVarName);
		code += emitChallengeOutputAssignment(indent, rawVar, outputVar);
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
 * Emits the assignment that normalizes the raw `waitForEvent` result into the
 * fixed Challenge output shape exposed via the VariablePicker
 * (CHALLENGE_OUTPUT_SCHEMA):
 *
 *   { accepted, timedOut, respondedBy, respondedAt }
 *
 * `waitForEvent` returns `null` on timeout and an object `{ payload: ... }`
 * otherwise, so we map the two cases explicitly here.
 */
function emitChallengeOutputAssignment(
	indent: string,
	rawVar: string,
	outputVar: string,
): string {
	let code = "";
	code += `${indent}${outputVar} = (${rawVar} === null)\n`;
	code += `${indent}\t? { accepted: false, timedOut: true, respondedBy: null, respondedAt: null }\n`;
	code += `${indent}\t: {\n`;
	code += `${indent}\t\taccepted: !!(${rawVar} as { payload: { accepted?: boolean } }).payload?.accepted,\n`;
	code += `${indent}\t\ttimedOut: false,\n`;
	code += `${indent}\t\trespondedBy:\n`;
	code += `${indent}\t\t\t(${rawVar} as { payload: { respondedBy?: string | null } }).payload\n`;
	code += `${indent}\t\t\t\t?.respondedBy ?? null,\n`;
	code += `${indent}\t\trespondedAt: new Date().toISOString(),\n`;
	code += `${indent}\t};\n`;
	return code;
}

/**
 * Generate code for a Promotion node.
 *
 * Promotion nodes wait (without timeout) for a `promotion_selection` event
 * emitted by `cases-svc` once the user confirms their selection in the UI.
 * The event payload carries the full snapshot (promotionId, selectedTerm,
 * monthlyPayment, etc.) which we normalize into the fixed output shape so
 * downstream nodes can reference it via `${nodeId.monthlyPayment}` etc.
 */
function generatePromotionStep(
	node: WorkflowNode,
	indent: string,
	retryVarName?: string,
): string {
	const stepName = createStepName(node);
	// `outputVar` is the public alias; `rawVar` is the internal event result variable.
	const outputVar = getVarName(node.id);
	const rawVar = `_${outputVar}Evt`;
	const config = node.config as PromotionNodeConfig | undefined;
	const commission =
		typeof config?.commission === "number"
			? config.commission
			: DEFAULT_PROMOTION_COMMISSION;
	const eventType = "promotion_selection";

	const roles = node.roles.length > 0 ? node.roles.join(", ") : "any";

	const stepNameExpr = retryVarName
		? retryStepNameExpr(stepName, retryVarName)
		: `"${stepName}"`;

	let code = `${indent}// Promotion: ${node.title} (commission: ${commission} | roles: ${roles})\n`;
	code += generateProgressCall(
		node,
		indent,
		"waiting_event",
		eventType,
		retryVarName,
	);
	code += `${indent}${rawVar} = await step.waitForEvent<PromotionSelectionPayload>(\n`;
	code += `${indent}\t${stepNameExpr},\n`;
	code += `${indent}\t{\n`;
	code += `${indent}\t\ttype: "${eventType}",\n`;
	// No timeout on purpose: the workflow waits indefinitely until cases-svc
	// forwards the user's selection. Wrap with a Checkpoint upstream if the
	// business wants to guard against this.
	code += `${indent}\t\ttimeout: "365 days",\n`;
	code += `${indent}\t},\n`;
	code += `${indent});\n`;
	code += generateCaseObjectCall(node, indent, rawVar, retryVarName);
	code += emitPromotionOutputAssignment(indent, rawVar, outputVar);
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
 * Emits the assignment that normalizes the raw `waitForEvent` result into the
 * fixed Promotion output shape exposed via the VariablePicker
 * (PROMOTION_OUTPUT_SCHEMA).
 *
 * `waitForEvent` on Promotion is expected to resolve with a non-null object
 * (we use a very long timeout); if by accident it returns `null` we fall back
 * to safe zeros so downstream nodes do not crash.
 */
function emitPromotionOutputAssignment(
	indent: string,
	rawVar: string,
	outputVar: string,
): string {
	let code = "";
	code += `${indent}${outputVar} = (${rawVar} === null)\n`;
	code += `${indent}\t? { promotionId: "", promotionName: "", selectedTerm: 0, finalAmount: 0, monthlyPayment: 0, interestRate: 0, downPayment: 0, contractorFee: 0, commission: 0, selectedBy: "", selectedAt: "" }\n`;
	code += `${indent}\t: {\n`;
	code += `${indent}\t\tpromotionId: String((${rawVar} as { payload: { promotionId?: string } }).payload?.promotionId ?? ""),\n`;
	code += `${indent}\t\tpromotionName: String((${rawVar} as { payload: { promotionName?: string } }).payload?.promotionName ?? ""),\n`;
	code += `${indent}\t\tselectedTerm: Number((${rawVar} as { payload: { selectedTerm?: number } }).payload?.selectedTerm ?? 0),\n`;
	code += `${indent}\t\tfinalAmount: Number((${rawVar} as { payload: { finalAmount?: number } }).payload?.finalAmount ?? 0),\n`;
	code += `${indent}\t\tmonthlyPayment: Number((${rawVar} as { payload: { monthlyPayment?: number } }).payload?.monthlyPayment ?? 0),\n`;
	code += `${indent}\t\tinterestRate: Number((${rawVar} as { payload: { interestRate?: number } }).payload?.interestRate ?? 0),\n`;
	code += `${indent}\t\tdownPayment: Number((${rawVar} as { payload: { downPayment?: number } }).payload?.downPayment ?? 0),\n`;
	code += `${indent}\t\tcontractorFee: Number((${rawVar} as { payload: { contractorFee?: number } }).payload?.contractorFee ?? 0),\n`;
	code += `${indent}\t\tcommission: Number((${rawVar} as { payload: { commission?: number } }).payload?.commission ?? 0),\n`;
	code += `${indent}\t\tselectedBy: String((${rawVar} as { payload: { selectedBy?: string } }).payload?.selectedBy ?? ""),\n`;
	code += `${indent}\t\tselectedAt: String((${rawVar} as { payload: { selectedAt?: string } }).payload?.selectedAt ?? new Date().toISOString()),\n`;
	code += `${indent}\t};\n`;
	return code;
}

/**
 * Generate code for a FlagChange node
 */
function generateFlagChangeStep(
	node: WorkflowNode,
	indent: string,
	retryVarName?: string,
): string {
	const stepName = createStepName(node);
	const flagChanges =
		(node.config.flagChanges as Array<{ flagId: string; optionId: string }>) ||
		[];
	const stepNameExpr = retryVarName
		? retryStepNameExpr(stepName, retryVarName)
		: `"${stepName}"`;

	let code = `${indent}// Flag Change: ${node.title}\n`;
	code += generateProgressCall(
		node,
		indent,
		"in_progress",
		undefined,
		retryVarName,
	);
	code += `${indent}await step.do(${stepNameExpr}, async () => {\n`;
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
	code += generateCaseObjectCall(node, indent, undefined, retryVarName);
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
 *
 * `retryZones` is used to filter out retry back-edges (Reject → Checkpoint)
 * so they do not influence convergence detection.
 */
function findConvergenceNode(
	topStartId: string,
	bottomStartId: string,
	outgoingMap: Map<string, WorkflowEdge[]>,
	retryZones: RetryZone[] = [],
): string | null {
	// Build a set of back-edges to exclude: Reject → Checkpoint edges
	const backEdges = new Set<string>();
	for (const zone of retryZones) {
		backEdges.add(`${zone.rejectNodeId}→${zone.checkpointNodeId}`);
	}

	const forwardEdges = (id: string): string[] =>
		(outgoingMap.get(id) ?? [])
			.filter((e) => !backEdges.has(`${id}→${e.to}`))
			.map((e) => e.to);

	// Collect all nodes reachable from the top branch (excluding back-edges)
	const topReachable = new Set<string>();
	const topQueue: string[] = [topStartId];
	while (topQueue.length > 0) {
		const id = topQueue.shift()!;
		if (topReachable.has(id)) continue;
		topReachable.add(id);
		for (const to of forwardEdges(id)) {
			if (!topReachable.has(to)) topQueue.push(to);
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
		for (const to of forwardEdges(id)) {
			if (!bottomVisited.has(to)) bottomQueue.push(to);
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
			return generateTransformStep(node, indent, retryVar);
		case "Message":
			return generateMessageStep(node, indent);
		case "Checkpoint":
			return generateCheckpointStep(node, indent, retryVar);
		case "Challenge":
			return generateChallengeStep(node, indent, retryVar);
		case "Promotion":
			return generatePromotionStep(node, indent, retryVar);
		case "Decision":
			// Decision generates an if/else, code is handled in traversal
			return "";
		case "NLS":
			return generateNLSStep(node, indent, retryVar);
		case "FlagChange":
			return generateFlagChangeStep(node, indent, retryVar);
		case "Join":
			return generateJoinStep(node, indent, ctx.incomingMap.get(node.id) || []);
		case "End":
			return (
				`${indent}// Workflow completed successfully\n` +
				generateCaseObjectCall(node, indent, undefined, retryVar) +
				generateProgressCall(node, indent, "completed", undefined, retryVar) +
				`${indent}return { success: true, payload: event.payload };\n`
			);
		case "Reject": {
			const zone = ctx.retryZones.find((z) => z.rejectNodeId === node.id);
			if (zone) {
				// Pattern 1: Reject with retry — generate continue/return logic.
				// IMPORTANT: use "in_progress" while retrying so that the cases-svc
				// workflowProgress endpoint does NOT treat this as a terminal rejection
				// (the workflow is still running — the retry loop will restart from the
				// checkpoint). Only emit "completed" on the final (exhausted) rejection.
				const rv = zone.retryVarName;
				if (zone.unlimited) {
					// Unlimited retries: always in_progress (never completed)
					return (
						`${indent}// Workflow rejected — retrying (unlimited)\n` +
						generateCaseObjectCall(node, indent, undefined, rv) +
						generateProgressCall(node, indent, "in_progress", undefined, rv) +
						`${indent}continue; // Unlimited retry from checkpoint\n`
					);
				}
				// Limited retries: in_progress while retrying, completed on last attempt
				return (
					`${indent}// Workflow rejected (retry zone)\n` +
					generateCaseObjectCall(node, indent, undefined, rv) +
					`${indent}if (${rv} < ${zone.maxRetries}) {\n` +
					generateProgressCall(
						node,
						indent + "\t",
						"in_progress",
						undefined,
						rv,
					) +
					`${indent}\tcontinue; // Retry from checkpoint\n` +
					`${indent}}\n` +
					generateProgressCall(node, indent, "completed", undefined, rv) +
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
					? findConvergenceNode(
							topEdge.to,
							bottomEdge.to,
							ctx.outgoingMap,
							ctx.retryZones,
						)
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
		// Handle Challenge nodes (branching based on acceptance/signature)
		else if (node.type === "Challenge" && forwardOutgoing.length === 2) {
			const outputVar = getVarName(node.id);
			const topEdge = forwardOutgoing.find(
				(e: WorkflowEdge) => e.fromPort === "top",
			);
			const bottomEdge = forwardOutgoing.find(
				(e: WorkflowEdge) => e.fromPort === "bottom",
			);

			// Detect convergence point
			const convergenceNodeId =
				topEdge && bottomEdge
					? findConvergenceNode(
							topEdge.to,
							bottomEdge.to,
							ctx.outgoingMap,
							ctx.retryZones,
						)
					: null;

			const innerStop = convergenceNodeId ?? stopAtNodeId;

			// Generate the waitForEvent step first
			code += generateNodeCode(node, indent, ctx);
			code += "\n";

			// Signature challenges use `signed` as the positive-branch discriminator;
			// acceptance challenges use `accepted`. Both share the same top/bottom
			// edge convention: top = positive outcome, bottom = negative.
			const isSignature =
				(node.config as { challengeType?: string }).challengeType ===
				"signature";
			const branchCondition = isSignature
				? `${outputVar}.signed`
				: `${outputVar}.accepted`;

			code += `${indent}if (${branchCondition}) {\n`;

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

// ---------------------------------------------------------------------------
// Branch-scope hoisting analysis
// ---------------------------------------------------------------------------

/**
 * Returns the set of node IDs that live inside at least one Decision or
 * Challenge branch (i.e., are only reachable after a Decision/Challenge
 * fork and before the convergence/join node).
 *
 * These nodes emit `const alias = await step.do(...)` inside an if/else block,
 * so their variable is lexically scoped to that block.  When a downstream
 * consumer (post-merge) references `${alias.field}` the runtime throws
 * `ReferenceError: alias is not defined`.
 *
 * Note: Challenge and Promotion nodes are excluded because they are handled
 * by their own dedicated hoisting block in `generateWorkflowCode`.
 */
function computeBranchScopedNodeIds(
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
): Set<string> {
	const { outgoingMap } = buildAdjacencyMaps(edges);
	const retryZones = detectRetryZones(nodes, edges);
	const branchScoped = new Set<string>();

	for (const node of nodes) {
		if (node.type !== "Decision" && node.type !== "Challenge") continue;

		const outgoing = outgoingMap.get(node.id) ?? [];
		const topEdge = outgoing.find((e) => e.fromPort === "top");
		const bottomEdge = outgoing.find((e) => e.fromPort === "bottom");
		if (!topEdge || !bottomEdge) continue;

		const convergenceNodeId = findConvergenceNode(
			topEdge.to,
			bottomEdge.to,
			outgoingMap,
			retryZones,
		);

		const collectBranch = (startId: string) => {
			const queue: string[] = [startId];
			const visited = new Set<string>();
			while (queue.length > 0) {
				const id = queue.shift()!;
				if (visited.has(id)) continue;
				if (convergenceNodeId && id === convergenceNodeId) continue;
				visited.add(id);
				branchScoped.add(id);
				for (const e of outgoingMap.get(id) ?? []) {
					if (!visited.has(e.to)) queue.push(e.to);
				}
			}
		};

		collectBranch(topEdge.to);
		collectBranch(bottomEdge.to);
	}

	return branchScoped;
}

/**
 * Returns the set of node IDs (Form / API / Transform only) that are
 * branch-scoped AND whose camelCase alias is referenced by at least one
 * node's code/condition/body string.
 *
 * These need a `let alias: Record<string, unknown> | undefined = undefined;`
 * hoisted at the top of `run()`, and their own assignment must drop `const`
 * so it writes to the hoisted binding instead of creating a new block-scoped one.
 */
function computeHoistedNodeIds(
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
	aliasMap: Map<string, string>,
): Set<string> {
	const hoistableTypes = new Set<WorkflowNode["type"]>([
		"Form",
		"API",
		"Transform",
	]);

	const branchScopedIds = computeBranchScopedNodeIds(nodes, edges);

	// Reverse map: camelCase alias → nodeId (for both new-format and legacy IDs)
	const aliasToNodeId = new Map<string, string>();
	for (const [nodeId, alias] of aliasMap) {
		aliasToNodeId.set(alias, nodeId);
		// Also register the legacy hyphen→underscore form as a fallback
		aliasToNodeId.set(nodeId.replace(/-/g, "_"), nodeId);
	}

	const needsHoisting = new Set<string>();

	/** Extract the alias first-segment from every ${...} token in a string. */
	const extractAliases = (str: string): string[] => {
		const aliases: string[] = [];
		for (const match of str.matchAll(/\$\{([^}]+)\}/g)) {
			const path = match[1].trim();
			if (path.startsWith("secret.")) continue;
			const firstSeg = path.split(".")[0].replace(/-/g, "_");
			aliases.push(firstSeg);
		}
		return aliases;
	};

	for (const node of nodes) {
		const stringsToScan: string[] = [];

		if (node.type === "Transform" && node.config.code) {
			stringsToScan.push(node.config.code as string);
		}
		if (node.type === "Decision" && node.config.condition) {
			stringsToScan.push(node.config.condition as string);
		}
		if (node.type === "API") {
			if (node.config.url) stringsToScan.push(node.config.url as string);
			const bodyConfig = node.config.bodyConfig as APIBodyConfig | undefined;
			if (bodyConfig?.rawJson) stringsToScan.push(bodyConfig.rawJson);
			if (bodyConfig?.fieldMappings) {
				for (const m of bodyConfig.fieldMappings as Array<{
					sourceExpression: string;
				}>) {
					if (m.sourceExpression) stringsToScan.push(m.sourceExpression);
				}
			}
			const customHeaders =
				(node.config.customHeaders as APIHeaderEntry[]) ?? [];
			for (const h of customHeaders) {
				if (h.value) stringsToScan.push(h.value);
			}
		}
		if (node.type === "Message") {
			const msgConfig = node.config as MessageNodeConfig | undefined;
			if (msgConfig?.subject) stringsToScan.push(msgConfig.subject);
			if (Array.isArray(msgConfig?.mergeVars)) {
				for (const mv of msgConfig.mergeVars) {
					if (mv.value) stringsToScan.push(mv.value);
				}
			}
		}

		for (const str of stringsToScan) {
			for (const alias of extractAliases(str)) {
				const referencedNodeId = aliasToNodeId.get(alias);
				if (
					referencedNodeId &&
					branchScopedIds.has(referencedNodeId) &&
					// The consuming node itself must be OUTSIDE the branch (e.g. post-merge)
					// so that hoisting is only done when there is a genuine cross-scope reference.
					// If the consumer is also branch-scoped (inside the same or another branch),
					// we still hoist to be safe — unless both are in the same branch context,
					// which is approximated by checking if the consumer is NOT branch-scoped at all.
					!branchScopedIds.has(node.id) &&
					hoistableTypes.has(
						nodes.find((n) => n.id === referencedNodeId)?.type ?? "Start",
					)
				) {
					needsHoisting.add(referencedNodeId);
				}
			}
		}
	}

	return needsHoisting;
}

/**
 * Generate TypeScript Cloudflare Workflow code from visual workflow
 */
export function generateWorkflowCode(
	nodes: WorkflowNode[],
	edges: WorkflowEdge[],
	metadata?: WorkflowMetadata,
	options: CodeGeneratorOptions = {},
	userVariables: Array<{ name: string; isSecret: boolean }> = [],
): GeneratedCode {
	const {
		className = "GeneratedWorkflow",
		includeComments = true,
		includeImports = true,
	} = options;

	const warnings: string[] = [];
	let code = "";

	// Build the alias map once for this generation run so all step generators
	// can resolve `getVarName(node.id)` → camelCase alias.
	_activeAliasMap = buildAliasMap(nodes);

	// Determine which branch-scoped nodes need let-hoisting before traversal.
	// Must run after _activeAliasMap is populated (getVarName depends on it).
	_hoistedNodeIds = computeHoistedNodeIds(nodes, edges, _activeAliasMap);

	// Find start node
	const startNode = nodes.find((n) => n.type === "Start");
	if (!startNode) {
		_activeAliasMap = new Map();
		return {
			code: "// Error: No Start node found in workflow",
			warnings: ["No Start node found in workflow"],
		};
	}

	// Capture the Start node alias so expandVariablePath can rewrite
	// ${<startAlias>.X} → event.payload.X throughout the generated code.
	_startNodeAlias = _activeAliasMap.get(startNode.id) ?? "";

	// Generate imports
	if (includeImports) {
		code += `import {\n\tWorkflowEntrypoint,\n\tWorkflowEvent,\n\tWorkflowStep,\n} from "cloudflare:workers";\n\n`;
	}

	// Generate environment interface
	// Use WorkflowEnv (not Env) to avoid clashing with the global Env type
	// generated by `wrangler types` (worker-configuration.d.ts).
	const hasMessageNodes = nodes.some((n) => n.type === "Message");
	const hasNlsNodes = nodes.some((n) => n.type === "NLS");
	const hasSignatureChallengeNodes = nodes.some(
		(n) =>
			n.type === "Challenge" &&
			(n.config as ChallengeNodeConfig | undefined)?.challengeType ===
				"signature",
	);
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
	if (hasSignatureChallengeNodes) {
		code += `\t\tcreateSignatureRequest: (input: {\n`;
		code += `\t\t\tcaseId: string;\n`;
		code += `\t\t\tworkflowInstanceId: string;\n`;
		code += `\t\t\tworkflowNodeId: string;\n`;
		code += `\t\t\tnodeConfig: Record<string, unknown>;\n`;
		code += `\t\t}) => Promise<void>;\n`;
	}
	code += `\t};\n`;
	if (hasNlsNodes) {
		code += `\tPROXY_SVC: {\n`;
		code += `\t\tnlsCreateLoan: (input: { bearerToken: string; body: Record<string, unknown> }) => Promise<{ success: boolean; raw?: unknown }>;\n`;
		code += `\t\tnlsCancelLoan: (input: { bearerToken: string; body: Record<string, unknown> }) => Promise<{ success: boolean; raw?: unknown }>;\n`;
		code += `\t\tnlsGetAmortization: (input: { bearerToken: string; body: Record<string, unknown> }) => Promise<{\n`;
		code += `\t\t\tLoanAmount: number; CashFlow: string; totalOfPayments: number;\n`;
		code += `\t\t\tregularPaymentAmount: number; firstPaymentApr: string;\n`;
		code += `\t\t\tlastPaymentAmount: number; lastPaymentDate: string | null;\n`;
		code += `\t\t\tOriginationDate: string; apr: number | null;\n`;
		code += `\t\t}>;\n`;
		code += `\t};\n`;
	}
	// User-defined variables and secrets from the variables panel (all are strings at runtime)
	for (const v of userVariables) {
		code += `\t${v.name}: string;\n`;
	}
	code += `}\n\n`;

	// Generate workflow params interface
	code += `interface WorkflowParams {\n`;
	code += `\t[key: string]: unknown;\n`;
	code += `}\n\n`;

	// Promotion nodes share a well-defined event payload forwarded by
	// `cases-svc` after validating the user's selection; declare its type
	// once so the generated code is fully type-checked.
	const hasPromotionNodes = nodes.some((n) => n.type === "Promotion");
	if (hasPromotionNodes) {
		code += `interface PromotionSelectionPayload {\n`;
		code += `\tpromotionId: string;\n`;
		code += `\tpromotionName: string;\n`;
		code += `\tselectedTerm: number;\n`;
		code += `\tfinalAmount: number;\n`;
		code += `\tmonthlyPayment: number;\n`;
		code += `\tinterestRate: number;\n`;
		code += `\tdownPayment: number;\n`;
		code += `\tcontractorFee: number;\n`;
		code += `\tcommission: number;\n`;
		code += `\tselectedBy: string;\n`;
		code += `\tselectedAt: string;\n`;
		code += `}\n\n`;
	}

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
			const outputVar = getVarName(node.id);
			const rawVar = `_${outputVar}Evt`;
			const isSignature =
				(node.config as { challengeType?: string } | undefined)
					?.challengeType === "signature";
			if (isSignature) {
				// Signature challenges have two waitForEvent calls: one for operator
				// acceptance and one for the actual signature event. Both variables
				// must be hoisted so they are visible across if/else branches.
				const acceptVar = `_${outputVar}AcceptEvt`;
				code += `\t\tlet ${acceptVar}: unknown = null;\n`;
				code += `\t\tlet ${rawVar}: unknown = null;\n`;
				// The signature challenge output has different fields from a plain
				// acceptance challenge (signed, rejected, declined, etc.).
				code += `\t\tlet ${outputVar}: { signed: boolean; timedOut: boolean; rejected: boolean; declined: boolean; canceled: boolean; errored: boolean; reason: string | null; signatureRequestId: string | null; documentId: string | null } = { signed: false, timedOut: false, rejected: false, declined: false, canceled: false, errored: false, reason: null, signatureRequestId: null, documentId: null };\n`;
			} else {
				code += `\t\tlet ${rawVar}: unknown = null;\n`;
				// Exposed output object referenced from downstream nodes via
				// `${alias.accepted}`, `${alias.timedOut}`, etc. Hoisted so branches
				// and the convergence path can reference it safely.
				code += `\t\tlet ${outputVar}: { accepted: boolean; timedOut: boolean; respondedBy: string | null; respondedAt: string | null } = { accepted: false, timedOut: false, respondedBy: null, respondedAt: null };\n`;
			}
		}
		code += `\n`;
	}

	// Same pattern for Promotion nodes — hoist the normalized output object
	// so downstream steps can dereference `${alias.promotionId}` safely even
	// across retry/checkpoint loops.
	const promotionNodes = nodes.filter((n) => n.type === "Promotion");
	if (promotionNodes.length > 0) {
		for (const node of promotionNodes) {
			const outputVar = getVarName(node.id);
			const rawVar = `_${outputVar}Evt`;
			code += `\t\tlet ${rawVar}: unknown = null;\n`;
			code += `\t\tlet ${outputVar}: { promotionId: string; promotionName: string; selectedTerm: number; finalAmount: number; monthlyPayment: number; interestRate: number; downPayment: number; contractorFee: number; commission: number; selectedBy: string; selectedAt: string } = { promotionId: "", promotionName: "", selectedTerm: 0, finalAmount: 0, monthlyPayment: 0, interestRate: 0, downPayment: 0, contractorFee: 0, commission: 0, selectedBy: "", selectedAt: "" };\n`;
		}
		code += `\n`;
	}

	// Hoist Form/API/Transform nodes that live inside Decision/Challenge branches
	// but whose alias is referenced post-merge (outside that branch's if/else block).
	// Without this, the runtime throws ReferenceError because `const alias` only
	// exists inside the block where it was declared.
	if (_hoistedNodeIds.size > 0) {
		for (const nodeId of _hoistedNodeIds) {
			const varName = getVarName(nodeId);
			code += `\t\tlet ${varName}: Record<string, unknown> | undefined = undefined;\n`;
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

	// Clear the module-level alias map after generation
	_activeAliasMap = new Map();
	_hoistedNodeIds = new Set();
	_startNodeAlias = "";

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
	userVariables: Array<{ name: string; isSecret: boolean }> = [],
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

	const generated = generateWorkflowCode(
		nodes,
		edges,
		metadata,
		options,
		userVariables,
	);

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
