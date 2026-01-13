import type {
	WorkflowNode,
	WorkflowEdge,
	WorkflowMetadata,
	ChallengeNodeConfig,
	APIFailureHandling,
} from "./types";
import { slugify } from "../slugify";

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
 * Helper to escape string for use in generated code
 */
function escapeString(str: string): string {
	return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n");
}

/**
 * Build adjacency maps for graph traversal
 */
function buildAdjacencyMaps(edges: WorkflowEdge[]): {
	outgoingMap: Map<string, WorkflowEdge[]>;
	incomingMap: Map<string, WorkflowEdge[]>;
} {
	const outgoingMap = new Map<string, WorkflowEdge[]>();
	const incomingMap = new Map<string, WorkflowEdge[]>();

	for (const edge of edges) {
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
	code += `${indent}const ${slugify(node.title) || "formData"} = await step.do('${stepName}', async () => {\n`;
	code += `${indent}  // Collect form data from user\n`;
	if (fields.length > 0) {
		code += `${indent}  // Fields: ${fields.join(", ")}\n`;
	}
	code += `${indent}  return await this.env.FORMS.collect({\n`;
	code += `${indent}    formId: '${stepName}',\n`;
	code += `${indent}    roles: [${node.roles.map((r) => `'${r}'`).join(", ")}],\n`;
	code += `${indent}  });\n`;
	code += `${indent}});\n`;

	return code;
}

/**
 * Generate code for an API node
 */
function generateAPIStep(node: WorkflowNode, indent: string): string {
	const stepName = createStepName(node);
	const endpoint = (node.config.endpoint as string) || "/api/endpoint";
	const method = (node.config.method as string) || "POST";
	const failureHandling = node.config.failureHandling as
		| APIFailureHandling
		| undefined;

	let code = `${indent}// API Call: ${node.title}\n`;
	code += `${indent}const ${slugify(node.title) || "apiResult"} = await step.do('${stepName}', async () => {\n`;
	code += `${indent}  const response = await fetch('${escapeString(endpoint)}', {\n`;
	code += `${indent}    method: '${method}',\n`;
	code += `${indent}    headers: { 'Content-Type': 'application/json' },\n`;
	code += `${indent}    body: JSON.stringify(event.payload),\n`;
	code += `${indent}  });\n`;
	code += `${indent}  if (!response.ok) {\n`;
	code += `${indent}    throw new Error(\`API call failed: \${response.status}\`);\n`;
	code += `${indent}  }\n`;
	code += `${indent}  return response.json();\n`;
	code += `${indent}}`;

	// Add retry configuration if specified
	if (failureHandling && failureHandling.maxRetries > 0) {
		code += `, {\n`;
		code += `${indent}  retries: {\n`;
		code += `${indent}    limit: ${failureHandling.maxRetries},\n`;
		code += `${indent}    delay: '1 second',\n`;
		code += `${indent}    backoff: 'exponential',\n`;
		code += `${indent}  },\n`;
		code += `${indent}  timeout: '${Math.round(failureHandling.timeout / 1000)} seconds',\n`;
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
	code += `${indent}const ${slugify(node.title) || "transformed"} = await step.do('${stepName}', async () => {\n`;
	code += `${indent}  ${transformCode.split("\n").join(`\n${indent}  `)}\n`;
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
	code += `${indent}await step.do('${stepName}', async () => {\n`;
	code += `${indent}  await this.env.NOTIFICATIONS.send({\n`;
	code += `${indent}    type: '${messageType}',\n`;
	if (template) {
		code += `${indent}    template: '${escapeString(template)}',\n`;
	}
	code += `${indent}    payload: event.payload,\n`;
	code += `${indent}  });\n`;
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
	code += `${indent}await step.do('${stepName}', async () => {\n`;
	code += `${indent}  // State is automatically persisted at this point\n`;
	if (isSafe) {
		code += `${indent}  // This is a safe checkpoint - workflow can be safely retried from here\n`;
	}
	code += `${indent}  return { checkpoint: '${stepName}', timestamp: Date.now() };\n`;
	code += `${indent}});\n`;

	return code;
}

/**
 * Generate code for a Challenge node (waitForEvent)
 */
function generateChallengeStep(node: WorkflowNode, indent: string): string {
	const stepName = createStepName(node);
	const config = node.config as ChallengeNodeConfig | undefined;
	const challengeType = config?.challengeType || "acceptance";
	const timeout = config?.challengeTimeout;
	const timeoutStr = timeout ? `${timeout.value} ${timeout.unit}` : "24 hours";

	let code = `${indent}// Challenge: ${node.title} (${challengeType})\n`;
	code += `${indent}const ${slugify(node.title) || "challengeResult"} = await step.waitForEvent('${stepName}', {\n`;
	code += `${indent}  type: '${challengeType}',\n`;
	code += `${indent}  timeout: '${timeoutStr}',\n`;
	code += `${indent}});\n`;

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
	code += `${indent}await step.do('${stepName}', async () => {\n`;
	for (const change of flagChanges) {
		code += `${indent}  await this.env.FLAGS.set('${change.flagId}', '${change.optionId}');\n`;
	}
	if (flagChanges.length === 0) {
		code += `${indent}  // Configure flag changes in the workflow editor\n`;
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
	code += `${indent}// Note: In Cloudflare Workflows, parallel branches can be achieved with Promise.all\n`;
	code += `${indent}await step.do('${stepName}', async () => {\n`;
	code += `${indent}  // Merge point for ${branchCount} branches\n`;
	code += `${indent}  return { merged: true };\n`;
	code += `${indent}});\n`;

	return code;
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
			return `${indent}// Workflow rejected\n${indent}return { success: false, reason: '${escapeString(node.title)}' };\n`;
		default:
			ctx.warnings.push(`Unknown node type: ${node.type}`);
			return `${indent}// Unknown node type: ${node.type}\n`;
	}
}

/**
 * Recursively traverse a branch and generate code
 */
function traverseBranch(
	nodeId: string,
	indent: string,
	ctx: TraversalContext,
): string {
	let code = "";

	// Process nodes in a chain until we hit a visited node or end
	let currentNodeId: string | null = nodeId;

	while (currentNodeId) {
		if (ctx.visited.has(currentNodeId)) {
			// Already visited (e.g., Join node from another branch)
			break;
		}
		ctx.visited.add(currentNodeId);

		const node = ctx.nodeMap.get(currentNodeId);
		if (!node) {
			ctx.warnings.push(`Node not found: ${currentNodeId}`);
			break;
		}

		// Get outgoing edges - explicit type to help TypeScript with recursion
		const outgoing: WorkflowEdge[] = ctx.outgoingMap.get(currentNodeId) || [];

		// Handle Decision nodes (branching)
		if (node.type === "Decision") {
			const condition = (node.config.condition as string) || "/* condition */";
			const topEdge = outgoing.find((e: WorkflowEdge) => e.fromPort === "top");
			const bottomEdge = outgoing.find(
				(e: WorkflowEdge) => e.fromPort === "bottom",
			);

			code += `${indent}// Decision: ${node.title}\n`;
			code += `${indent}if (${condition}) {\n`;

			// Generate true branch
			if (topEdge && !ctx.visited.has(topEdge.to)) {
				code += traverseBranch(topEdge.to, indent + "  ", ctx);
			}

			code += `${indent}} else {\n`;

			// Generate false branch
			if (bottomEdge && !ctx.visited.has(bottomEdge.to)) {
				code += traverseBranch(bottomEdge.to, indent + "  ", ctx);
			}

			code += `${indent}}\n\n`;
			break; // Decision handled, stop linear traversal
		}
		// Handle Challenge nodes (branching based on acceptance)
		else if (node.type === "Challenge" && outgoing.length === 2) {
			const varName = slugify(node.title) || "challengeResult";
			const topEdge = outgoing.find((e: WorkflowEdge) => e.fromPort === "top");
			const bottomEdge = outgoing.find(
				(e: WorkflowEdge) => e.fromPort === "bottom",
			);

			// Generate challenge step first
			code += generateNodeCode(node, indent, ctx);
			code += "\n";

			code += `${indent}if (${varName}.accepted) {\n`;

			// Generate accepted branch
			if (topEdge && !ctx.visited.has(topEdge.to)) {
				code += traverseBranch(topEdge.to, indent + "  ", ctx);
			}

			code += `${indent}} else {\n`;

			// Generate rejected branch
			if (bottomEdge && !ctx.visited.has(bottomEdge.to)) {
				code += traverseBranch(bottomEdge.to, indent + "  ", ctx);
			}

			code += `${indent}}\n\n`;
			break; // Challenge handled, stop linear traversal
		}
		// Linear flow
		else {
			// Generate code for current node
			code += generateNodeCode(node, indent, ctx);
			code += "\n";

			// Handle multiple outgoing edges (shouldn't happen for non-branching nodes)
			if (outgoing.length > 1) {
				ctx.warnings.push(
					`Node "${node.title}" has multiple outgoing edges but is not a Decision or Challenge node`,
				);
			}

			// Move to next node
			if (outgoing.length >= 1) {
				currentNodeId = outgoing[0].to;
			} else {
				currentNodeId = null;
			}
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
		code += `import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';\n\n`;
	}

	// Generate environment interface
	code += `interface Env {\n`;
	code += `  // Add your bindings here\n`;
	code += `  FORMS?: any;\n`;
	code += `  NOTIFICATIONS?: any;\n`;
	code += `  FLAGS?: any;\n`;
	code += `  AI?: any;\n`;
	code += `}\n\n`;

	// Generate workflow params interface
	code += `interface WorkflowParams {\n`;
	code += `  // Define your workflow input parameters\n`;
	code += `  [key: string]: unknown;\n`;
	code += `}\n\n`;

	// Add metadata as comments
	if (includeComments && metadata) {
		code += `/**\n`;
		code += ` * ${metadata.name || "Generated Workflow"}\n`;
		if (metadata.description) {
			code += ` * \n`;
			code += ` * ${metadata.description}\n`;
		}
		code += ` * \n`;
		code += ` * Version: ${metadata.version || "1.0.0"}\n`;
		if (metadata.author) {
			code += ` * Author: ${metadata.author}\n`;
		}
		code += ` * Generated: ${new Date().toISOString()}\n`;
		code += ` */\n`;
	}

	// Generate class
	code += `export class ${className} extends WorkflowEntrypoint<Env, WorkflowParams> {\n`;
	code += `  async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep): Promise<unknown> {\n`;

	// Traverse and generate step code
	const { code: stepsCode, warnings: traverseWarnings } = traverseAndGenerate(
		startNode,
		nodes,
		edges,
		"    ",
	);
	code += stepsCode;
	warnings.push(...traverseWarnings);

	// Close class
	code += `  }\n`;
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
