"use server";

import { getJwt } from "@/lib/auth/getJwt";
import { listNlsFunctions, getNlsFunction } from "./nls";
import type { NlsFunctionSummary, NlsFunctionDetail } from "./nls";

export type { NlsFunctionSummary, NlsFunctionDetail };

/**
 * Server action: list all NLS functions from proxy-svc.
 */
export async function listNlsFunctionsAction(): Promise<NlsFunctionSummary[]> {
	const jwt = await getJwt();
	return listNlsFunctions({ jwt: jwt ?? undefined });
}

/**
 * Server action: get NLS function details (sections + fields) from proxy-svc.
 */
export async function getNlsFunctionAction(
	functionId: string,
): Promise<NlsFunctionDetail> {
	const jwt = await getJwt();
	return getNlsFunction(functionId, { jwt: jwt ?? undefined });
}
