import { fetchJson } from "./http";
import type { ApiCallOptions } from "./types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const getProxyServiceUrl = (): string =>
	process.env.NEXT_PUBLIC_PROXY_SERVICE_URL ||
	"https://proxy-svc.carteracredit.workers.dev";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NlsFunctionOutputField {
	id: string;
	label: string;
	type: string;
}

export interface NlsFunctionSummary {
	id: string;
	label: string;
	description: string;
	outputFields: NlsFunctionOutputField[];
}

export interface NlsFunctionFieldOption {
	value: string;
	label: string;
}

export interface NlsFunctionFieldDependsOn {
	fieldId: string;
	equals: string;
}

export interface NlsFunctionField {
	id: string;
	label: string;
	type: string;
	required: boolean;
	defaultValue?: string;
	options?: NlsFunctionFieldOption[];
	hidden?: boolean;
	dependsOn?: NlsFunctionFieldDependsOn;
}

export interface NlsFunctionSection {
	id: string;
	label: string;
	fields: NlsFunctionField[];
}

export interface NlsFunctionDetail {
	id: string;
	label: string;
	description: string;
	sections: NlsFunctionSection[];
	outputFields: NlsFunctionOutputField[];
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function listNlsFunctions(
	options?: ApiCallOptions,
): Promise<NlsFunctionSummary[]> {
	const base = getProxyServiceUrl();
	const { json } = await fetchJson<NlsFunctionSummary[]>(
		`${base}/nls/functions`,
		{ jwt: options?.jwt },
	);
	return json;
}

export async function getNlsFunction(
	functionId: string,
	options?: ApiCallOptions,
): Promise<NlsFunctionDetail> {
	const base = getProxyServiceUrl();
	const { json } = await fetchJson<NlsFunctionDetail>(
		`${base}/nls/functions/${encodeURIComponent(functionId)}`,
		{ jwt: options?.jwt },
	);
	return json;
}
