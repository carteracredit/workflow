import type { WorkflowNode } from "@/lib/workflow/types";

const MIN_NODE_WIDTH = 180;
const MAX_NODE_WIDTH = 320;
const MIN_NODE_HEIGHT = 60;
const PADDING_X = 16;
const ICON_CONTAINER_SIZE = 40;

/**
 * Estimates node dimensions based on its content.
 * This logic must stay in sync with the actual renderer sizing rules.
 */
export const estimateNodeDimensions = (node: WorkflowNode) => {
	const titleWidth = node.title.length * 9;
	const descWidth = node.description ? node.description.length * 7.5 : 0;

	let flagsMaxWidth = 0;
	if (node.type === "FlagChange" && node.config.flagChanges) {
		const flagChanges = node.config.flagChanges as Array<{
			flagId: string;
			optionId: string;
		}>;
		flagChanges.forEach(() => {
			flagsMaxWidth = Math.max(flagsMaxWidth, 150);
		});
	}

	const contentWidth =
		Math.max(titleWidth, descWidth, flagsMaxWidth) +
		ICON_CONTAINER_SIZE +
		12 +
		PADDING_X * 2;
	const width = Math.max(
		MIN_NODE_WIDTH,
		Math.min(MAX_NODE_WIDTH, contentWidth),
	);

	const hasDescription = !!node.description;
	const hasRoles = node.roles.length > 0;
	const flagChangesCount =
		node.type === "FlagChange" && node.config.flagChanges
			? (
					node.config.flagChanges as Array<{
						flagId: string;
						optionId: string;
					}>
				).length
			: 0;
	const hasSpecialBadges =
		(node.type === "Reject" && (node.config.allowRetry as boolean) === true) ||
		flagChangesCount > 0 ||
		(node.type === "API" && node.config.failureHandling) ||
		node.type === "Challenge";

	let height = MIN_NODE_HEIGHT;
	if (hasDescription) height += 22;
	if (hasRoles) {
		const rolesRows = Math.ceil(node.roles.length / 3);
		height += rolesRows * 28;
	}
	if (hasSpecialBadges) {
		if (flagChangesCount > 0) {
			const flagRows = Math.ceil(flagChangesCount / 2);
			height += flagRows * 28;
		} else {
			height += 28;
		}
	}

	return { width, height };
};
