"use server";

import { getJwt } from "@/lib/auth/getJwt";
import { listSignatureTemplates, getSignatureTemplate } from "./signatures";
import type {
	SignatureTemplateSummary,
	SignatureTemplateDetail,
} from "./signatures";

export type { SignatureTemplateSummary, SignatureTemplateDetail };

/**
 * Server action: list all Dropbox Sign templates from cases-svc.
 */
export async function listSignatureTemplatesAction(): Promise<
	SignatureTemplateSummary[]
> {
	const jwt = await getJwt();
	return listSignatureTemplates({ jwt: jwt ?? undefined });
}

/**
 * Server action: get full details (signer roles + custom fields) for a template.
 */
export async function getSignatureTemplateAction(
	templateId: string,
): Promise<SignatureTemplateDetail> {
	const jwt = await getJwt();
	return getSignatureTemplate(templateId, { jwt: jwt ?? undefined });
}
