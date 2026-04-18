import type { OutputSchemaProperty } from "./types";

/**
 * Fixed output schema exposed by every Challenge node so downstream nodes can
 * reference the outcome of a challenge (accepted/timeout/respondedBy) through
 * the VariablePicker, e.g. `${challenge-123.accepted}`.
 *
 * These fields are populated automatically by the code generator right after
 * `step.waitForEvent(...)`:
 *
 *   - `accepted`     → `true` when the challenge was accepted before timeout.
 *   - `timedOut`     → `true` when waitForEvent returned `null` (no response).
 *   - `respondedBy`  → user/session that accepted the challenge (if provided
 *                      by the emitting service in the event payload), else
 *                      `null`.
 *   - `respondedAt`  → ISO timestamp when the response was observed, else
 *                      `null` on timeout.
 *
 * All entries are marked `readOnly: true` so the properties panel can render
 * them as fixed, non-editable fields (consistent with CASE_VARIABLES).
 */
export const CHALLENGE_OUTPUT_SCHEMA: OutputSchemaProperty[] = [
	{
		id: "challenge-out-accepted",
		name: "accepted",
		type: "boolean",
		description: "True when the challenge was accepted before the timeout",
		readOnly: true,
	},
	{
		id: "challenge-out-timedOut",
		name: "timedOut",
		type: "boolean",
		description:
			"True when the Challenge timed out without receiving a response",
		readOnly: true,
	},
	{
		id: "challenge-out-respondedBy",
		name: "respondedBy",
		type: "string",
		description:
			"Identifier of the user/session that responded (null on timeout or when not provided)",
		readOnly: true,
	},
	{
		id: "challenge-out-respondedAt",
		name: "respondedAt",
		type: "string",
		description:
			"ISO timestamp when the response was observed (null on timeout)",
		readOnly: true,
	},
];

/**
 * Returns a fresh deep copy of CHALLENGE_OUTPUT_SCHEMA. Use this whenever
 * merging with user-defined properties so consumers never mutate the shared
 * catalog.
 */
export function cloneChallengeOutputSchema(): OutputSchemaProperty[] {
	return CHALLENGE_OUTPUT_SCHEMA.map(cloneProperty);
}

function cloneProperty(prop: OutputSchemaProperty): OutputSchemaProperty {
	const copy: OutputSchemaProperty = { ...prop };
	if (prop.properties) {
		copy.properties = prop.properties.map(cloneProperty);
	}
	if (prop.items) {
		copy.items = cloneProperty(prop.items);
	}
	if (prop.enumValues) {
		copy.enumValues = [...prop.enumValues];
	}
	return copy;
}
