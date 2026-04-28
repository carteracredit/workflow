import type { OutputSchemaProperty } from "./types";

/**
 * Fixed output schema exposed by every Challenge node with challengeType
 * "acceptance" so downstream nodes can reference the outcome through the
 * VariablePicker, e.g. `${challenge-123.accepted}`.
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
 * Fixed output schema for Challenge nodes with challengeType "signature".
 * The code generator normalises the waitForEvent result into these fields
 * immediately after `step.waitForEvent(...)`:
 *
 *   - `signed`               → `true` when all signers completed the request.
 *   - `timedOut`             → `true` when the request expired.
 *   - `declined`             → `true` when a signer declined the request.
 *   - `canceled`             → `true` when the request was canceled.
 *   - `errored`              → `true` when Dropbox Sign reported an error.
 *   - `reason`               → string describing the outcome ("timedOut" |
 *                              "declined" | "canceled" | "errored" | null).
 *   - `signatureRequestId`   → Dropbox Sign request ID, or null on timeout.
 *   - `documentId`           → Internal CaseDocument ID of the signed PDF,
 *                              or null when not yet available / negative.
 */
export const SIGNATURE_CHALLENGE_OUTPUT_SCHEMA: OutputSchemaProperty[] = [
	{
		id: "sig-challenge-out-signed",
		name: "signed",
		type: "boolean",
		description: "True when all signers completed the signature request",
		readOnly: true,
	},
	{
		id: "sig-challenge-out-timedOut",
		name: "timedOut",
		type: "boolean",
		description:
			"True when the signature request expired without all signers completing it",
		readOnly: true,
	},
	{
		id: "sig-challenge-out-declined",
		name: "declined",
		type: "boolean",
		description: "True when a signer declined the request",
		readOnly: true,
	},
	{
		id: "sig-challenge-out-canceled",
		name: "canceled",
		type: "boolean",
		description: "True when the signature request was canceled",
		readOnly: true,
	},
	{
		id: "sig-challenge-out-errored",
		name: "errored",
		type: "boolean",
		description: "True when Dropbox Sign reported an error on the request",
		readOnly: true,
	},
	{
		id: "sig-challenge-out-reason",
		name: "reason",
		type: "string",
		description:
			'String describing the negative outcome ("timedOut" | "declined" | "canceled" | "errored"), or null on success',
		readOnly: true,
	},
	{
		id: "sig-challenge-out-signatureRequestId",
		name: "signatureRequestId",
		type: "string",
		description: "Dropbox Sign signature request ID (null on timeout)",
		readOnly: true,
	},
	{
		id: "sig-challenge-out-documentId",
		name: "documentId",
		type: "string",
		description:
			"Internal CaseDocument ID of the signed PDF (null when not yet stored or on negative outcome)",
		readOnly: true,
	},
];

/**
 * Returns the appropriate output schema for a Challenge node based on its
 * challengeType. Falls back to the acceptance schema when type is absent.
 */
export function getChallengeOutputSchema(
	challengeType?: string,
): OutputSchemaProperty[] {
	return challengeType === "signature"
		? SIGNATURE_CHALLENGE_OUTPUT_SCHEMA
		: CHALLENGE_OUTPUT_SCHEMA;
}

/**
 * Returns a fresh deep copy of CHALLENGE_OUTPUT_SCHEMA. Use this whenever
 * merging with user-defined properties so consumers never mutate the shared
 * catalog.
 */
export function cloneChallengeOutputSchema(): OutputSchemaProperty[] {
	return CHALLENGE_OUTPUT_SCHEMA.map(cloneProperty);
}

/**
 * Returns a fresh deep copy of the appropriate challenge output schema based
 * on challengeType.
 */
export function cloneChallengeOutputSchemaForType(
	challengeType?: string,
): OutputSchemaProperty[] {
	return getChallengeOutputSchema(challengeType).map(cloneProperty);
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
