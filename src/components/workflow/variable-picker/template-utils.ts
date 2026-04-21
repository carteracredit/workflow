import type { TemplateSegment } from "./variable-template-input";

let _idCounter = 0;
function nextId() {
	return `seg_parsed_${++_idCounter}`;
}

/**
 * Convert a template string (e.g. `"Hello ${event.payload.clientName}"`)
 * back into a `TemplateSegment[]` for use with `VariableTemplateInput`.
 *
 * Variable references follow the `${variablePath}` convention emitted by
 * `VariableTemplateInput`'s internal `outputString` computation.
 */
export function parseTemplateStringToSegments(
	str: string | null | undefined,
): TemplateSegment[] {
	if (!str) return [];

	const segments: TemplateSegment[] = [];
	// Match ${...} placeholders; everything else is literal text
	const regex = /\$\{([^}]+)\}/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(str)) !== null) {
		const before = str.slice(lastIndex, match.index);
		if (before) {
			segments.push({ id: nextId(), type: "text", value: before });
		}
		const path = match[1];
		// Use the last segment of the path as the display name
		const parts = path.split(".");
		const displayName = parts[parts.length - 1] ?? path;
		segments.push({
			id: nextId(),
			type: "variable",
			value: displayName,
			variablePath: path,
		});
		lastIndex = match.index + match[0].length;
	}

	const trailing = str.slice(lastIndex);
	if (trailing) {
		segments.push({ id: nextId(), type: "text", value: trailing });
	}

	return segments;
}

/**
 * Convert a `TemplateSegment[]` to its string representation.
 * Text segments are emitted as-is; variable segments as `${variablePath}`.
 */
export function segmentsToTemplateString(segments: TemplateSegment[]): string {
	return segments
		.map((seg) =>
			seg.type === "variable" ? `\${${seg.variablePath}}` : seg.value,
		)
		.join("");
}
