"use client";

/**
 * Module-level in-memory cache for NLS function output fields.
 *
 * graph-utils.ts needs synchronous access to output schemas when building the
 * variable picker, so we maintain a plain Map that is populated once at editor
 * boot via the useNlsFunctionsCache hook and can then be read synchronously by
 * any caller in the same browser session.
 */

import { useEffect } from "react";
import type {
	NlsFunctionSummary,
	NlsFunctionOutputField,
} from "@/lib/workflow-api/nls";

// ---------------------------------------------------------------------------
// Module-level cache — populated by useNlsFunctionsCache on first mount
// ---------------------------------------------------------------------------

const outputFieldsCache = new Map<string, NlsFunctionOutputField[]>();

let cachePopulated = false;

/**
 * Returns the cached output fields for a given NLS function ID, or null if the
 * cache has not been populated yet (editor still loading).
 */
export function getNlsOutputFieldsFromCache(
	functionId: string | undefined,
): NlsFunctionOutputField[] | null {
	if (!functionId) return null;
	return outputFieldsCache.get(functionId) ?? null;
}

/**
 * Populates the module cache from a list of NlsFunctionSummary objects.
 * Called internally by useNlsFunctionsCache after fetching from the server.
 */
export function updateNlsCache(functions: NlsFunctionSummary[]): void {
	for (const fn of functions) {
		outputFieldsCache.set(fn.id, fn.outputFields);
	}
	cachePopulated = true;
}

/** Returns true once the cache has been populated at least once. */
export function isNlsCachePopulated(): boolean {
	return cachePopulated;
}

// ---------------------------------------------------------------------------
// React hook — call once at the root of the workflow editor
// ---------------------------------------------------------------------------

/**
 * Hook that fetches all NLS functions from the server action and populates the
 * module-level cache. Should be called once near the top of the workflow editor
 * (e.g. in the PropertiesPanel component that already loads the function list).
 *
 * @param functions  Already-fetched function summaries passed from the server
 *                   (listNlsFunctionsAction is typically called server-side and
 *                   the result passed as a prop). If provided, the cache is
 *                   populated synchronously during render — no extra fetch needed.
 */
export function useNlsFunctionsCache(functions: NlsFunctionSummary[]): void {
	useEffect(() => {
		if (functions.length > 0) {
			updateNlsCache(functions);
		}
	}, [functions]);
}
