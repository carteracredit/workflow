"use server";

import { getJwt } from "@/lib/auth/getJwt";
import {
	listPdfTemplates,
	getPdfTemplateFields,
	listPdfTemplateVersions,
} from "./pdf-templates";
import type {
	PdfTemplateSummary,
	PdfTemplateFieldsResult,
	PdfTemplateVersionSummary,
	PdfFormField,
} from "./pdf-templates";

export type {
	PdfTemplateSummary,
	PdfTemplateFieldsResult,
	PdfTemplateVersionSummary,
	PdfFormField,
};

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
 * Server action: get the AcroForm fields of a PDF template's version
 * (active version by default, or a pinned `versionId`).
 */
export async function getPdfTemplateFieldsAction(
	pdfTemplateId: string,
	options?: { bypassCache?: boolean; versionId?: string },
): Promise<PdfTemplateFieldsResult> {
	const jwt = await getJwt();
	return getPdfTemplateFields(pdfTemplateId, {
		jwt: jwt ?? undefined,
		bypassCache: options?.bypassCache,
		versionId: options?.versionId,
	});
}

/**
 * Server action: list a PDF template's version history from cases-svc, so
 * the GeneratePDF node's panel can offer a version selector.
 */
export async function listPdfTemplateVersionsAction(
	pdfTemplateId: string,
	options?: { bypassCache?: boolean },
): Promise<PdfTemplateVersionSummary[]> {
	const jwt = await getJwt();
	return listPdfTemplateVersions(pdfTemplateId, {
		jwt: jwt ?? undefined,
		bypassCache: options?.bypassCache,
	});
}
