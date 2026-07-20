import { fetchJson } from "./http";
import type { ApiCallOptions } from "./types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const getCasesServiceUrl = (): string =>
	process.env.NEXT_PUBLIC_CASES_SERVICE_URL ||
	"https://cases-svc.carteracredit.workers.dev";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PdfFieldType =
	| "text"
	| "checkbox"
	| "radio"
	| "dropdown"
	| "optionList"
	| "unknown";

export interface PdfFormField {
	name: string;
	type: PdfFieldType;
	/** Valid export values for `radio` / `dropdown` / `optionList` fields. */
	options?: string[];
}

export interface PdfTemplateSummary {
	id: string;
	name: string;
	description: string | null;
	activeVersion: {
		id: string;
		version: number;
		fileName: string;
	} | null;
}

export interface PdfTemplateFieldsResult {
	pdfTemplateId: string;
	pdfTemplateVersionId: string;
	version: number;
	fileName: string;
	fields: PdfFormField[];
}

export interface PdfTemplateVersionSummary {
	id: string;
	version: number;
	fileName: string;
	createdAt: string;
	isActive: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Lists PDF templates that have an active version — only these are
 * selectable in the workflow GeneratePDF node.
 * Calls GET /pdf-templates on cases-svc.
 */
export async function listPdfTemplates(
	options?: ApiCallOptions & { bypassCache?: boolean },
): Promise<PdfTemplateSummary[]> {
	const base = getCasesServiceUrl();
	const url = new URL(`${base}/pdf-templates`);
	if (options?.bypassCache) url.searchParams.set("bypass_cache", "true");

	const { json } = await fetchJson<{
		success: boolean;
		result: PdfTemplateSummary[];
	}>(url.toString(), { jwt: options?.jwt });

	return json.result;
}

/**
 * Gets the AcroForm fields discovered in a PDF template's version, so the
 * GeneratePDF node can render a variable mapping input per field. Defaults
 * to the active version; pass `versionId` to load a specific (pinned)
 * version instead. Calls GET /pdf-templates/:id/fields on cases-svc.
 */
export async function getPdfTemplateFields(
	pdfTemplateId: string,
	options?: ApiCallOptions & { bypassCache?: boolean; versionId?: string },
): Promise<PdfTemplateFieldsResult> {
	const base = getCasesServiceUrl();
	const url = new URL(
		`${base}/pdf-templates/${encodeURIComponent(pdfTemplateId)}/fields`,
	);
	if (options?.bypassCache) url.searchParams.set("bypass_cache", "true");
	if (options?.versionId) url.searchParams.set("versionId", options.versionId);

	const { json } = await fetchJson<{
		success: boolean;
		result: PdfTemplateFieldsResult;
	}>(url.toString(), { jwt: options?.jwt });

	return json.result;
}

/**
 * Lists a PDF template's version history, so the GeneratePDF node's panel
 * can offer a version selector (mirrors the Form node's `formVersion`
 * pinning pattern). Calls GET /pdf-templates/:id/versions on cases-svc.
 */
export async function listPdfTemplateVersions(
	pdfTemplateId: string,
	options?: ApiCallOptions & { bypassCache?: boolean },
): Promise<PdfTemplateVersionSummary[]> {
	const base = getCasesServiceUrl();
	const url = new URL(
		`${base}/pdf-templates/${encodeURIComponent(pdfTemplateId)}/versions`,
	);
	if (options?.bypassCache) url.searchParams.set("bypass_cache", "true");

	const { json } = await fetchJson<{
		success: boolean;
		result: PdfTemplateVersionSummary[];
	}>(url.toString(), { jwt: options?.jwt });

	return json.result;
}
