"use server";

import { getJwt } from "@/lib/auth/getJwt";
import { listPdfTemplates, getPdfTemplateFields } from "./pdf-templates";
import type {
	PdfTemplateSummary,
	PdfTemplateFieldsResult,
} from "./pdf-templates";

export type { PdfTemplateSummary, PdfTemplateFieldsResult };

/**
 * Server action: list PDF templates with an active version from cases-svc.
 */
export async function listPdfTemplatesAction(options?: {
	bypassCache?: boolean;
}): Promise<PdfTemplateSummary[]> {
	const jwt = await getJwt();
	return listPdfTemplates({
		jwt: jwt ?? undefined,
		bypassCache: options?.bypassCache,
	});
}

/**
 * Server action: get the AcroForm fields of a PDF template's active version.
 */
export async function getPdfTemplateFieldsAction(
	pdfTemplateId: string,
	options?: { bypassCache?: boolean },
): Promise<PdfTemplateFieldsResult> {
	const jwt = await getJwt();
	return getPdfTemplateFields(pdfTemplateId, {
		jwt: jwt ?? undefined,
		bypassCache: options?.bypassCache,
	});
}
