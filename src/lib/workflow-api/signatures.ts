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

export interface SignatureTemplateSummary {
	templateId: string;
	title: string;
	signerRoles: Array<{ name: string; order: number | null }>;
	updatedAt: number;
}

export interface SignatureTemplateDetail {
	templateId: string;
	title: string;
	signerRoles: Array<{ name: string; order: number | null }>;
	ccRoles: Array<{ name: string }>;
	customFields: Array<{
		name: string;
		apiId: string;
		type: string;
		required: boolean;
		label: string | null;
	}>;
	updatedAt: number;
}

interface ListTemplatesResult {
	templates: SignatureTemplateSummary[];
	page: number;
	numPages: number;
	numResults: number;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Lists all Dropbox Sign templates available for the account.
 * Calls GET /signatures/templates on cases-svc.
 */
export async function listSignatureTemplates(
	options?: ApiCallOptions & {
		page?: number;
		pageSize?: number;
		bypassCache?: boolean;
	},
): Promise<SignatureTemplateSummary[]> {
	const base = getCasesServiceUrl();
	const url = new URL(`${base}/signatures/templates`);
	if (options?.page) url.searchParams.set("page", String(options.page));
	if (options?.pageSize)
		url.searchParams.set("page_size", String(options.pageSize));
	if (options?.bypassCache) url.searchParams.set("bypass_cache", "true");

	const { json } = await fetchJson<{
		success: boolean;
		result: ListTemplatesResult;
	}>(url.toString(), { jwt: options?.jwt });

	return json.result.templates;
}

/**
 * Gets full details for a single Dropbox Sign template (signer roles + custom fields).
 * Calls GET /signatures/templates/:templateId on cases-svc.
 */
export async function getSignatureTemplate(
	templateId: string,
	options?: ApiCallOptions & { bypassCache?: boolean },
): Promise<SignatureTemplateDetail> {
	const base = getCasesServiceUrl();
	const url = new URL(
		`${base}/signatures/templates/${encodeURIComponent(templateId)}`,
	);
	if (options?.bypassCache) url.searchParams.set("bypass_cache", "true");

	const { json } = await fetchJson<{
		success: boolean;
		result: SignatureTemplateDetail;
	}>(url.toString(), { jwt: options?.jwt });

	return json.result;
}
