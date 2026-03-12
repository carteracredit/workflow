"use server";

import { getJwt } from "@/lib/auth/getJwt";
import { listForms, getForm } from "./forms";
import type { Form, ListFormsOptions } from "./forms";

// ---------------------------------------------------------------------------
// Server Actions for forms
// ---------------------------------------------------------------------------

/**
 * Server action: list all forms, optionally filtered.
 */
export async function listFormsAction(
	options?: Omit<ListFormsOptions, "jwt">,
): Promise<Form[]> {
	const jwt = await getJwt();
	return listForms({ ...options, jwt: jwt ?? undefined });
}

/**
 * Server action: get a single form by ID.
 */
export async function getFormAction(formId: string): Promise<Form> {
	const jwt = await getJwt();
	return getForm(formId, { jwt: jwt ?? undefined });
}
