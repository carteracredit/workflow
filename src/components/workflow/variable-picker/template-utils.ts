import type { TemplateSegment } from "./variable-template-input";
import type { VariableSourceNode } from "./types";

let _idCounter = 0;
function nextId() {
	return `seg_parsed_${++_idCounter}`;
}

/**
 * Convert a template string (e.g. `"Hello ${coapplicantForm.phone}"`)
 * back into a `TemplateSegment[]` for use with `VariableTemplateInput`.
 *
 * Variable references follow the `${variablePath}` convention emitted by
 * `VariableTemplateInput`'s internal `outputString` computation.
 *
 * When `sources` is provided, each variable segment is enriched with the
 * `nodeName` and `nodeId` by resolving the first path segment (the alias)
 * against the sources list. Segments whose alias cannot be resolved are
 * marked as orphaned (`orphan: true`).
 */
export function parseTemplateStringToSegments(
	str: string | null | undefined,
	sources?: VariableSourceNode[],
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
		const parts = path.split(".");
		const displayName = parts[parts.length - 1] ?? path;
		const aliasOrId = parts[0] ?? "";

		let nodeName: string | undefined;
		let nodeId: string | undefined;
		let isOrphan: boolean | undefined;

		if (sources && aliasOrId) {
			// `VariableSourceNode.id` is now the camelCase alias after the graph-utils update
			const source = sources.find((s) => s.id === aliasOrId);
			if (source) {
				nodeName = source.name;
				nodeId = source.id;
			} else if (!/^secret$/.test(aliasOrId)) {
				// Not a secret ref and not found in sources → orphaned
				isOrphan = true;
			}
		}

		segments.push({
			id: nextId(),
			type: "variable",
			value: displayName,
			variablePath: path,
			nodeName,
			nodeId,
			...(isOrphan ? { orphan: true } : {}),
		} as TemplateSegment);
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
