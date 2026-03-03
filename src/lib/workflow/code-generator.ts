import type {
	WorkflowNode,
	WorkflowEdge,
	WorkflowMetadata,
	ChallengeNodeConfig,
	APIFailureHandling,
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

/**
 * Generate code for a Form node
 */
function generateFormStep(node: WorkflowNode, indent: string): string {
	const stepName = createStepName(node);
	const roles = node.roles.length > 0 ? node.roles.join(", ") : "any";
	const fields = (node.config.fields as string[]) || [];

	let code = `${indent}// Form: ${node.title} (roles: ${roles})\n`;
	code += `${indent}await step.do("${stepName}", async () => {\n`;
	code += `${indent}\t// Collect form data from user\n`;
	if (fields.length > 0) {
		code += `${indent}\t// Fields: ${fields.join(", ")}\n`;
	}
	code += `${indent}\tconst forms = this.env.FORMS as { collect: (opts: unknown) => Promise<unknown> };\n`;
	code += `${indent}\treturn await forms.collect({\n`;
	code += `${indent}\t\tformId: "${stepName}",\n`;
	code += `${indent}\t\troles: [${node.roles.map((r) => `"${escapeString(r)}"`).join(", ")}],\n`;
	code += `${indent}\t});\n`;
	code += `${indent}});\n`;

	return code;
}

/**
 * Generate code for an API node
 */
function generateAPIStep(node: WorkflowNode, indent: string): string {
	const stepName = createStepName(node);
	// Properties panel stores the URL as `config.url`; older nodes may still use
	// `config.endpoint` – fall back gracefully for backwards compatibility.
	const endpoint =
		(node.config.url as string) ||
		(node.config.endpoint as string) ||
		"/api/endpoint";
	const method = (node.config.method as string) || "POST";
	const failureHandling = node.config.failureHandling as
		| APIFailureHandling
		| undefined;

	let code = `${indent}// API Call: ${node.title}\n`;
	code += `${indent}await step.do("${stepName}", async () => {\n`;
	code += `${indent}\tconst response = await fetch("${escapeString(endpoint)}", {\n`;
	code += `${indent}\t\tmethod: "${method}",\n`;
	code += `${indent}\t\theaders: { "Content-Type": "application/json" },\n`;
	code += `${indent}\t\tbody: JSON.stringify(event.payload),\n`;
	code += `${indent}\t});\n`;
	code += `${indent}\tif (!response.ok) {\n`;
	code += `${indent}\t\tthrow new Error(\`API call failed: \${response.status}\`);\n`;
	code += `${indent}\t}\n`;
	code += `${indent}\treturn response.json();\n`;
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

	return code;
}

/**
 * Generate code for a Transform node
 */
function generateTransformStep(node: WorkflowNode, indent: string): string {
	const stepName = createStepName(node);
	const transformCode = (node.config.code as string) || "// Transform logic";

	let code = `${indent}// Transform: ${node.title}\n`;
	code += `${indent}await step.do("${stepName}", async () => {\n`;
	code += `${indent}\t${transformCode.split("\n").join(`\n${indent}\t`)}\n`;
	code += `${indent}});\n`;

	return code;
}

/**
 * Generate code for a Message node
 */
function generateMessageStep(node: WorkflowNode, indent: string): string {
	const stepName = createStepName(node);
	const messageType = (node.config.type as string) || "notification";
	const template = (node.config.template as string) || "";

	let code = `${indent}// Message: ${node.title}\n`;
	code += `${indent}await step.do("${stepName}", async () => {\n`;
	code += `${indent}\tconst notifications = this.env.NOTIFICATIONS as {\n`;
	code += `${indent}\t\tsend: (opts: unknown) => Promise<void>;\n`;
	code += `${indent}\t};\n`;
	code += `${indent}\tawait notifications.send({\n`;
	code += `${indent}\t\ttype: "${messageType}",\n`;
	if (template) {
		code += `${indent}\t\ttemplate: "${escapeString(template)}",\n`;
	}
	code += `${indent}\t\tpayload: event.payload,\n`;
	code += `${indent}\t});\n`;
	code += `${indent}});\n`;

	return code;
}

/**
 * Generate code for a Checkpoint node
 */
function generateCheckpointStep(node: WorkflowNode, indent: string): string {
	const stepName = createStepName(node);
	const isSafe = node.checkpointType === "safe";

	let code = `${indent}// Checkpoint: ${node.title}${isSafe ? " (safe)" : ""}\n`;
	code += `${indent}await step.do("${stepName}", async () => {\n`;
	code += `${indent}\t// State is automatically persisted at this point\n`;
	if (isSafe) {
		code += `${indent}\t// This is a safe checkpoint - workflow can be safely retried from here\n`;
	}
	code += `${indent}\treturn { checkpoint: "${stepName}", timestamp: Date.now() };\n`;
	code += `${indent}});\n`;

	return code;
}

/**
 * Generate code for a Challenge node (waitForEvent)
 */
function generateChallengeStep(node: WorkflowNode, indent: string): string {
	const stepName = createStepName(node);
	const varName = createVariableName(node.title, "challengeResult");
	const config = node.config as ChallengeNodeConfig | undefined;
	const challengeType = config?.challengeType || "acceptance";
	const timeout = config?.challengeTimeout;
	const timeoutStr = timeout ? `${timeout.value} ${timeout.unit}` : "24 hours";

	let code = `${indent}// Challenge: ${node.title} (${challengeType})\n`;
	code += `${indent}const ${varName} = await step.waitForEvent<{ accepted: boolean }>(\n`;
	code += `${indent}\t"${stepName}",\n`;
	code += `${indent}\t{\n`;
	code += `${indent}\t\ttype: "${challengeType}",\n`;
	code += `${indent}\t\ttimeout: "${timeoutStr}",\n`;
	code += `${indent}\t},\n`;
	code += `${indent});\n`;

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
	code += `${indent}await step.do("${stepName}", async () => {\n`;
	if (flagChanges.length > 0) {
		code += `${indent}\tconst flags = this.env.FLAGS as {\n`;
		code += `${indent}\t\tset: (id: string, value: string) => Promise<void>;\n`;
		code += `${indent}\t};\n`;
		for (const change of flagChanges) {
			code += `${indent}\tawait flags.set("${escapeString(change.flagId)}", "${escapeString(change.optionId)}");\n`;
		}
	} else {
		code += `${indent}\t// Configure flag changes in the workflow editor\n`;
	}
	code += `${indent}});\n`;

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
	code += `${indent}await step.do("${stepName}", async () => {\n`;
	code += `${indent}\t// Merge point for ${branchCount} branches\n`;
	code += `${indent}\treturn { merged: true };\n`;
	code += `${indent}});\n`;

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
}

/**
 * Generate code for a single node based on its type
 */
function generateNodeCode(
	node: WorkflowNode,
	indent: string,
	ctx: TraversalContext,
): string {
	switch (node.type) {
		case "Start":
			return `${indent}// Workflow started\n`;
		case "Form":
			return generateFormStep(node, indent);
		case "API":
			return generateAPIStep(node, indent);
		case "Transform":
			return generateTransformStep(node, indent);
		case "Message":
			return generateMessageStep(node, indent);
		case "Checkpoint":
			return generateCheckpointStep(node, indent);
		case "Challenge":
			return generateChallengeStep(node, indent);
		case "Decision":
			// Decision generates an if/else, code is handled in traversal
			return "";
		case "FlagChange":
			return generateFlagChangeStep(node, indent);
		case "Join":
			return generateJoinStep(node, indent, ctx.incomingMap.get(node.id) || []);
		case "End":
			return `${indent}// Workflow completed successfully\n${indent}return { success: true, payload: event.payload };\n`;
		case "Reject":
			return `${indent}// Workflow rejected\n${indent}return { success: false, reason: "${escapeString(node.title)}" };\n`;
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
		ctx.visited.add(currentNodeId);

		const node = ctx.nodeMap.get(currentNodeId);
		if (!node) {
			ctx.warnings.push(`Node not found: ${currentNodeId}`);
			break;
		}

		// Get outgoing edges
		const outgoing: WorkflowEdge[] = ctx.outgoingMap.get(currentNodeId) ?? [];

		// Handle Decision nodes (branching)
		if (node.type === "Decision") {
			const condition = (node.config.condition as string) || "/* condition */";
			const topEdge = outgoing.find((e: WorkflowEdge) => e.fromPort === "top");
			const bottomEdge = outgoing.find(
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
			code += `${indent}if (${condition}) {\n`;

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
		else if (node.type === "Challenge" && outgoing.length === 2) {
			const varName = createVariableName(node.title, "challengeResult");
			const topEdge = outgoing.find((e: WorkflowEdge) => e.fromPort === "top");
			const bottomEdge = outgoing.find(
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

			code += `${indent}if (${varName}.payload.accepted) {\n`;

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

			if (outgoing.length > 1) {
				ctx.warnings.push(
					`Node "${node.title}" has multiple outgoing edges but is not a Decision or Challenge node`,
				);
			}

			currentNodeId = outgoing.length >= 1 ? outgoing[0].to : null;
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

	const ctx: TraversalContext = {
		nodeMap,
		outgoingMap,
		incomingMap,
		visited: new Set<string>(),
		warnings: [],
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
	code += `interface WorkflowEnv {\n`;
	code += `\tFORMS?: unknown;\n`;
	code += `\tNOTIFICATIONS?: unknown;\n`;
	code += `\tFLAGS?: unknown;\n`;
	code += `\tAI?: unknown;\n`;
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
