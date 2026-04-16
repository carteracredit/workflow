import { fetchJson } from "./http";
import { getWorkflowServiceUrl } from "./config";
import type { ApiResponse, ApiCallOptions } from "./types";

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

export interface FormField {
	id: string;
	type: string;
	label: string;
	labelEs?: string;
	placeholder?: string;
	placeholderEs?: string;
	required: boolean;
	options?: string[];
	properties?: {
		includeMiddleName?: boolean;
		enableAutocomplete?: boolean;
	};
}

export interface FormVersion {
	id: string;
	version: number;
	createdAt: string;
	createdBy: string;
	changelog?: string;
	fields: FormField[];
	schema: {
		input: Record<string, unknown>;
		output: Record<string, unknown>;
	};
}

export interface Form {
	id: string;
	name: string;
	nameEs?: string;
	description: string;
	descriptionEs?: string;
	status: "draft" | "published" | "archived";
	currentVersion: number;
	createdAt: string;
	updatedAt: string;
	tags: string[];
	versions: FormVersion[];
}

export interface ListFormsOptions extends ApiCallOptions {
	search?: string;
	status?: "draft" | "published" | "archived";
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Lists all forms, optionally filtered by search query and status.
 */
export async function listForms(options?: ListFormsOptions): Promise<Form[]> {
	const baseUrl = getWorkflowServiceUrl();
	const url = new URL(`${baseUrl}/forms`);
	if (options?.search) {
		url.searchParams.set("search", options.search);
	}
	if (options?.status) {
		url.searchParams.set("status", options.status);
	}

	const { json } = await fetchJson<ApiResponse<Form[]>>(url.toString(), {
		jwt: options?.jwt,
	});

	return json.result;
}

/**
 * Gets a single form by ID.
 */
export async function getForm(
	formId: string,
	options?: ApiCallOptions,
): Promise<Form> {
	const baseUrl = getWorkflowServiceUrl();

	const { json } = await fetchJson<ApiResponse<Form>>(
		`${baseUrl}/forms/${formId}`,
		{ jwt: options?.jwt },
	);

	return json.result;
}
