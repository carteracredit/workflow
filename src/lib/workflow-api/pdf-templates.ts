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
 * Gets the AcroForm fields discovered in the active version of a PDF
 * template, so the GeneratePDF node can render a variable mapping input per
 * field. Calls GET /pdf-templates/:id/fields on cases-svc.
 */
export async function getPdfTemplateFields(
	pdfTemplateId: string,
	options?: ApiCallOptions & { bypassCache?: boolean },
): Promise<PdfTemplateFieldsResult> {
	const base = getCasesServiceUrl();
	const url = new URL(
		`${base}/pdf-templates/${encodeURIComponent(pdfTemplateId)}/fields`,
	);
	if (options?.bypassCache) url.searchParams.set("bypass_cache", "true");

	const { json } = await fetchJson<{
		success: boolean;
		result: PdfTemplateFieldsResult;
	}>(url.toString(), { jwt: options?.jwt });

	return json.result;
}
